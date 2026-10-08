import { computed, onBeforeUnmount, onMounted, readonly, ref, shallowRef, watch, type Ref } from 'vue';
import { createRenderer } from '@cubism-adapter';
import { loadCharacter } from '../characters/loadCharacter';
import { SERVICE_NAME } from '../config';
import { ExclusiveInputModes } from '../input/exclusiveInputModes';
import { drawFacePoints } from '../input/facePoints';
import { FaceTracker, type CameraStatus } from '../input/faceTracker';
import { HoldToRestore } from '../input/holdToRestore';
import { MotionSensors, requestMotionPermission, type MotionPermission } from '../input/motionSensors';
import { TapTracker } from '../input/tap';
import { NEUTRAL_ORIENTATION, OrientationFilter, tiltToParameters } from '../input/tilt';
import type { CharacterRenderer } from '../live2d/renderer';
import { describeRendererStatus } from '../live2d/statusMessage';
import type { CharacterConfig, OrientationState } from '../types';
import type { StatusLine } from './useStatusLine';

export interface CharacterStageElements {
  canvas: Readonly<Ref<HTMLCanvasElement | null>>;
  video: Readonly<Ref<HTMLVideoElement | null>>;
  facePoints: () => HTMLCanvasElement | null;
}

export interface CharacterStageOptions {
  landscape: Readonly<Ref<boolean>>;
  status: StatusLine;
}

const MOTION_PERMISSION_NOTICES: Record<MotionPermission, string> = {
  granted: '지금 기기를 든 자세가 기준이 돼요. 기울이거나 흔들어 보세요.',
  denied: '동작 및 방향 접근이 거부됐어요. 브라우저 설정에서 허용해 주세요.',
  insecure: '기울이기는 https 주소에서만 쓸 수 있어요.',
  unsupported: '이 기기에서는 기울이기를 지원하지 않아요.',
};

/**
 * Owns the Live2D renderer and every input that drives it: taps, tilt and
 * shake, camera face tracking and the hidden-UI long press. Renderer, sensors
 * and trackers stay plain objects; only what the template shows is reactive.
 */
export function useCharacterStage(elements: CharacterStageElements, { landscape, status }: CharacterStageOptions) {
  const character = shallowRef<CharacterConfig | null>(null);
  const ready = ref(false);
  const automaticMotionEnabled = ref(false);
  const motionEnabled = ref(false);
  const cameraEnabled = ref(false);
  const cameraState = ref<CameraStatus['state']>('stopped');
  const faceFound = ref(false);
  const uiHidden = ref(false);
  const restoreHintVisible = ref(false);
  let restoreHintTimer: ReturnType<typeof setTimeout> | undefined;

  let renderer: CharacterRenderer | null = null;
  let camera: FaceTracker | null = null;
  let inputModes: ExclusiveInputModes | null = null;
  let started = false;
  let unmounted = false;

  function isRuntimePaused(): boolean {
    return document.visibilityState === 'hidden' || landscape.value;
  }

  // --- Character ------------------------------------------------------------

  function start(): void {
    if (started) return;
    started = true;
    void loadAndStart();
  }

  async function loadAndStart(): Promise<void> {
    status.setRendererMessage('캐릭터를 불러오고 있어요.');
    let selected: Awaited<ReturnType<typeof loadCharacter>>;
    try {
      selected = await loadCharacter(window.location.pathname, __MODEL_BASE_URL__, __CHARACTER__, window.location.origin);
    } catch (error) {
      console.error('Character:', error);
      status.setRendererMessage(error instanceof Error ? error.message : '캐릭터를 불러오지 못했어요.');
      return;
    }
    const canvas = elements.canvas.value;
    if (unmounted || !canvas) return;
    character.value = selected.character;
    document.title = `${selected.character.name} · ${SERVICE_NAME}`;
    renderer = createRenderer({
      canvas,
      modelDirectory: selected.modelDirectory,
      modelFile: selected.character.model,
      shaderDirectory: '/cubism/shaders/WebGL/',
      idleMotion: selected.character.idleMotion,
      tapMotion: selected.character.tapMotion,
      onStatus: (rendererStatus) => {
        if (rendererStatus.state === 'error') console.error('Live2D:', rendererStatus.message);
        ready.value = rendererStatus.state === 'ready';
        status.setRendererMessage(describeRendererStatus(rendererStatus));
        if (rendererStatus.state === 'error' && camera?.isEnabled) camera.stop();
      },
    });
    renderer.setAutomaticMotionEnabled(automaticMotionEnabled.value);
    syncRuntimeState();
  }

  function toggleAutomaticMotion(): void {
    automaticMotionEnabled.value = !automaticMotionEnabled.value;
    renderer?.setAutomaticMotionEnabled(automaticMotionEnabled.value);
  }

  // --- Hidden UI --------------------------------------------------------------

  const taps = new TapTracker();
  const restoreHold = new HoldToRestore(() => {
    setUiHidden(false);
  });

  function cancelPointerGesture(): void {
    restoreHold.cancelAll();
    const pointerId = taps.activePointerId;
    if (pointerId != null) {
      taps.cancel(pointerId);
      const canvas = elements.canvas.value;
      if (canvas?.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
    }
  }

  function setUiHidden(hidden: boolean): void {
    cancelPointerGesture();
    clearTimeout(restoreHintTimer);
    uiHidden.value = hidden;
    restoreHintVisible.value = hidden;
    if (hidden) {
      restoreHintTimer = setTimeout(() => { restoreHintVisible.value = false; }, 4000);
    }
    // Do not leave keyboard focus on a control which has become invisible.
    if (hidden && document.activeElement instanceof HTMLElement) document.activeElement.blur();
  }

  function onPointerDown(event: PointerEvent): void {
    if (!started || isRuntimePaused()) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    if (!event.isPrimary || taps.activePointerId != null) {
      cancelPointerGesture();
      return;
    }
    taps.down(event.pointerId, event.clientX, event.clientY, event.timeStamp);
    if (uiHidden.value) restoreHold.down(event.pointerId, event.clientX, event.clientY);
    (event.currentTarget as HTMLCanvasElement).setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent): void {
    restoreHold.move(event.pointerId, event.clientX, event.clientY);
    taps.move(event.pointerId, event.clientX, event.clientY);
  }

  function onPointerUp(event: PointerEvent): void {
    restoreHold.cancel(event.pointerId);
    const result = taps.up(event.pointerId, event.timeStamp);
    if (!result.tracked) return;
    const canvas = elements.canvas.value;
    if (canvas?.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    if (result.tap && ready.value) {
      const rect = (event.currentTarget as HTMLCanvasElement).getBoundingClientRect();
      renderer?.tap(event.clientX - rect.left, event.clientY - rect.top);
    }
  }

  function onPointerCancel(event: PointerEvent): void {
    if (taps.activePointerId === event.pointerId) cancelPointerGesture();
  }

  function onContextMenu(event: Event): void {
    if (uiHidden.value) event.preventDefault();
  }

  // --- Tilt and shake ---------------------------------------------------------

  const tiltFilter = new OrientationFilter();
  let tiltTarget: OrientationState = { ...NEUTRAL_ORIENTATION };
  let tiltFrame = 0;
  let lastTiltTime = 0;

  const sensors = new MotionSensors({
    onTilt: (state) => {
      tiltTarget = state;
    },
    onShake: () => {
      if (ready.value && character.value) renderer?.playMotion(character.value.shakeMotion);
    },
  });

  function tiltLoop(time: number): void {
    const deltaSeconds = lastTiltTime ? (time - lastTiltTime) / 1000 : 0;
    lastTiltTime = time;
    renderer?.setTiltOffsets(tiltToParameters(tiltFilter.update(tiltTarget, deltaSeconds)));
    tiltFrame = requestAnimationFrame(tiltLoop);
  }

  function setMotionEnabled(enabled: boolean): void {
    motionEnabled.value = enabled;
    syncRuntimeState();
  }

  function syncRuntimeState(): void {
    const paused = isRuntimePaused();
    if (paused) inputModes?.cancelPendingMotion();
    renderer?.setPaused(paused);
    if (paused) cancelPointerGesture();
    if (paused && camera?.isEnabled) {
      camera.stop();
      return;
    }
    cancelAnimationFrame(tiltFrame);
    if (motionEnabled.value && !paused && !camera?.isEnabled) {
      tiltTarget = { ...NEUTRAL_ORIENTATION };
      tiltFilter.reset();
      sensors.start();
      lastTiltTime = 0;
      tiltFrame = requestAnimationFrame(tiltLoop);
    } else {
      sensors.stop();
      tiltFilter.reset();
      renderer?.setTiltOffsets(null);
    }
  }

  // --- Camera -----------------------------------------------------------------

  function createCamera(video: HTMLVideoElement): FaceTracker {
    let wasEnabled = false;
    const tracker: FaceTracker = new FaceTracker({
      video,
      onParameters: (parameters) => renderer?.setFaceParameters(parameters),
      onLandmarks: (points) => {
        const canvas = elements.facePoints();
        if (canvas) drawFacePoints(canvas, points, video);
      },
      onStatus: (cameraStatus) => {
        const enabled = tracker.isEnabled;
        cameraEnabled.value = enabled;
        cameraState.value = cameraStatus.state;
        faceFound.value = cameraStatus.state === 'running' && cameraStatus.faceFound;
        if (cameraStatus.state === 'error') status.showNotice(cameraStatus.message);
        // Inference reports status every frame. Only mode changes affect playback.
        if (wasEnabled !== enabled) {
          wasEnabled = enabled;
          syncRuntimeState();
        }
      },
    });
    return tracker;
  }

  function toggleMotion(): void {
    void inputModes?.toggleMotion();
  }

  function toggleCamera(): void {
    inputModes?.toggleCamera();
  }

  // --- Page lifecycle -----------------------------------------------------------

  function onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && uiHidden.value) setUiHidden(false);
  }

  function onPageHide(): void {
    inputModes?.cancelPendingMotion();
    cancelPointerGesture();
    camera?.stop();
    setMotionEnabled(false);
    renderer?.setPaused(true);
  }

  watch(landscape, syncRuntimeState);

  onMounted(() => {
    const video = elements.video.value;
    if (!video) throw new Error('Missing camera video element');
    const tracker = createCamera(video);
    camera = tracker;
    inputModes = new ExclusiveInputModes({
      motionEnabled: () => motionEnabled.value,
      setMotionEnabled,
      cameraEnabled: () => tracker.isEnabled,
      startCamera: () => tracker.start(),
      stopCamera: () => tracker.stop(),
      canStartCamera: () => ready.value,
      paused: isRuntimePaused,
      requestMotionPermission,
      onMotionPermission: (permission) => status.showNotice(MOTION_PERMISSION_NOTICES[permission]),
    });
    window.addEventListener('blur', cancelPointerGesture);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('pageshow', syncRuntimeState);
    document.addEventListener('visibilitychange', syncRuntimeState);
    syncRuntimeState();
  });

  onBeforeUnmount(() => {
    unmounted = true;
    window.removeEventListener('blur', cancelPointerGesture);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('pagehide', onPageHide);
    window.removeEventListener('pageshow', syncRuntimeState);
    document.removeEventListener('visibilitychange', syncRuntimeState);
    cancelPointerGesture();
    clearTimeout(restoreHintTimer);
    cancelAnimationFrame(tiltFrame);
    sensors.stop();
    camera?.stop();
    renderer?.dispose();
    renderer = null;
  });

  return {
    character: readonly(character),
    ready: readonly(ready),
    automaticMotionEnabled: readonly(automaticMotionEnabled),
    motionEnabled: readonly(motionEnabled),
    camera: {
      enabled: readonly(cameraEnabled),
      state: readonly(cameraState),
      faceFound: readonly(faceFound),
      canToggle: computed(() => ready.value || cameraEnabled.value),
    },
    uiHidden: readonly(uiHidden),
    restoreHintVisible: readonly(restoreHintVisible),
    start,
    setUiHidden,
    toggleAutomaticMotion,
    toggleMotion,
    toggleCamera,
    pointer: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onLostPointerCapture: onPointerCancel,
      onContextMenu,
    },
  };
}
