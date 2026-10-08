import './style.css';

import { createRenderer } from '@cubism-adapter';
import { loadCharacter } from './characters/loadCharacter';
import privacyPolicy from '../legal/privacy_policy.md?raw';
import termsOfService from '../legal/terms_of_service.md?raw';
import { SERVICE_NAME } from './config';
import { ExclusiveInputModes } from './input/exclusiveInputModes';
import { FaceTracker } from './input/faceTracker';
import { drawFacePoints } from './input/facePoints';
import { HoldToRestore } from './input/holdToRestore';
import { MotionSensors, requestMotionPermission } from './input/motionSensors';
import { TapTracker } from './input/tap';
import { NEUTRAL_ORIENTATION, OrientationFilter, tiltToParameters } from './input/tilt';
import { browserStore, hasAcceptedCurrentTerms, recordAcceptance } from './legal/consent';
import { parseLegalMarkdown, renderLegalBlocks } from './legal/markdown';
import type { CharacterRenderer, RendererStatus } from './live2d/renderer';
import type { OrientationState } from './types';

let character = __CHARACTER__;

const documents = {
  terms: { title: '이용약관', source: termsOfService },
  privacy: { title: '개인정보처리방침', source: privacyPolicy },
} as const;
type DocumentKey = keyof typeof documents;

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing #${id}`);
  return found as T;
}

const canvas = element<HTMLCanvasElement>('character-canvas');
const statusLine = element<HTMLParagraphElement>('status');
const motionToggle = element<HTMLButtonElement>('motion-toggle');
const reactButton = element<HTMLButtonElement>('react-button');
const expressionButton = element<HTMLButtonElement>('expression-button');
const consentDialog = element<HTMLDialogElement>('consent-dialog');
const infoDialog = element<HTMLDialogElement>('info-dialog');
const documentDialog = element<HTMLDialogElement>('document-dialog');
const portraitDialog = element<HTMLDialogElement>('portrait-dialog');
const cameraToggle = element<HTMLButtonElement>('camera-toggle');
const cameraPreview = element('camera-preview');
const cameraStatus = element('camera-status');
const cameraVideo = element<HTMLVideoElement>('camera-video');
const facePointsCanvas = element<HTMLCanvasElement>('face-points');
const mobileLandscape = window.matchMedia('(hover: none) and (pointer: coarse) and (orientation: landscape)');

document.title = SERVICE_NAME;
element('service-name').textContent = SERVICE_NAME;
element('character-name').textContent = '캐릭터';
element('consent-title').textContent = `${SERVICE_NAME} 시작하기`;
element('info-title').textContent = SERVICE_NAME;
element('info-credit').textContent = '';

// --- Status line -----------------------------------------------------------

let rendererMessage: string | null = '캐릭터를 불러오고 있어요.';
let noticeTimer: number | undefined;

function showStatus(): void {
  statusLine.hidden = rendererMessage == null;
  statusLine.textContent = rendererMessage ?? '';
}

function showNotice(message: string): void {
  window.clearTimeout(noticeTimer);
  statusLine.hidden = false;
  statusLine.textContent = message;
  noticeTimer = window.setTimeout(showStatus, 4000);
}

function describeStatus(status: RendererStatus): string | null {
  switch (status.state) {
    case 'loading':
      return '캐릭터를 불러오고 있어요.';
    case 'ready':
      return null;
    case 'sdk_unavailable':
      return 'Live2D SDK가 연결되지 않은 빌드예요. 캐릭터는 SDK를 준비한 빌드에서만 보여요.';
    case 'webgl_unavailable':
      return '이 브라우저에서는 캐릭터를 표시할 수 없어요. (WebGL 미지원)';
    case 'error':
      return '캐릭터를 불러오지 못했어요. 새로고침해 주세요.';
  }
}

// --- Legal documents --------------------------------------------------------

function openDocument(key: DocumentKey): void {
  const { title, source } = documents[key];
  element('document-title').textContent = title;
  const body = element('document-body');
  body.replaceChildren(renderLegalBlocks(parseLegalMarkdown(source)));
  body.scrollTop = 0;
  documentDialog.showModal();
}

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-document]')) {
  button.addEventListener('click', () => openDocument(button.dataset.document as DocumentKey));
}

element('info-button').addEventListener('click', () => infoDialog.showModal());

// --- Character --------------------------------------------------------------

let renderer: CharacterRenderer | null = null;
let ready = false;
let characterStarted = false;

function startCharacter(): void {
  if (characterStarted) return;
  characterStarted = true;
  wirePointer();
  wireButtons();
  wireVisibility();
  void loadAndStartCharacter();
}

async function loadAndStartCharacter(): Promise<void> {
  showStatus();
  let modelDirectory: string;
  try {
    const selected = await loadCharacter(window.location.pathname, __MODEL_BASE_URL__, __CHARACTER__, window.location.origin);
    character = selected.character;
    modelDirectory = selected.modelDirectory;
    document.title = `${character.name} · ${SERVICE_NAME}`;
    element('character-name').textContent = character.name;
    element('info-credit').textContent = character.credit ?? '';
  } catch (error) {
    console.error('Character:', error);
    rendererMessage = error instanceof Error ? error.message : '캐릭터를 불러오지 못했어요.';
    showStatus();
    return;
  }
  renderer = createRenderer({
    canvas,
    modelDirectory,
    modelFile: character.model,
    shaderDirectory: '/cubism/shaders/WebGL/',
    idleMotion: character.idleMotion,
    tapMotion: character.tapMotion,
    onStatus: (status) => {
      if (status.state === 'error') console.error('Live2D:', status.message);
      ready = status.state === 'ready';
      reactButton.disabled = !ready;
      expressionButton.disabled = !ready;
      cameraToggle.disabled = !ready && !camera.isEnabled;
      rendererMessage = describeStatus(status);
      showStatus();
      if (status.state === 'error' && camera.isEnabled) camera.stop();
    },
  });
  syncRuntimeState();
}

function canvasPoint(event: PointerEvent): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

const taps = new TapTracker();
let uiHidden = false;
const restoreHold = new HoldToRestore(() => {
  cancelPointerGesture();
  setUiHidden(false);
});

function cancelPointerGesture(): void {
  restoreHold.cancelAll();
  const pointerId = taps.activePointerId;
  if (pointerId != null) {
    taps.cancel(pointerId);
    if (canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
  }
  renderer?.releaseLook();
}

function setUiHidden(hidden: boolean): void {
  restoreHold.cancelAll();
  uiHidden = hidden;
  if (hidden) {
    if (infoDialog.open) infoDialog.close();
    if (documentDialog.open) documentDialog.close();
    // Do not leave keyboard focus on a control which has become invisible.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  }
  document.body.classList.toggle('ui-hidden', hidden);
}

element('hide-ui-button').addEventListener('click', () => setUiHidden(true));
window.addEventListener('blur', cancelPointerGesture);
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && uiHidden) setUiHidden(false);
});

function wirePointer(): void {
  canvas.addEventListener('pointerdown', (event) => {
    if (isRuntimePaused()) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (uiHidden) {
      event.preventDefault();
      if (event.isPrimary) restoreHold.down(event.pointerId, event.clientX, event.clientY);
      else restoreHold.cancelAll();
    }
    if (!taps.down(event.pointerId, event.clientX, event.clientY, event.timeStamp)) return;
    canvas.setPointerCapture(event.pointerId);
    const point = canvasPoint(event);
    renderer?.lookAt(point.x, point.y);
  });

  canvas.addEventListener('pointermove', (event) => {
    restoreHold.move(event.pointerId, event.clientX, event.clientY);
    if (!taps.move(event.pointerId, event.clientX, event.clientY)) return;
    const point = canvasPoint(event);
    renderer?.lookAt(point.x, point.y);
  });

  canvas.addEventListener('pointerup', (event) => {
    restoreHold.cancel(event.pointerId);
    const result = taps.up(event.pointerId, event.timeStamp);
    if (!result.tracked) return;
    renderer?.releaseLook();
    if (result.tap && ready) {
      const point = canvasPoint(event);
      renderer?.tap(point.x, point.y);
    }
  });

  canvas.addEventListener('pointercancel', (event) => {
    restoreHold.cancel(event.pointerId);
    if (taps.cancel(event.pointerId)) renderer?.releaseLook();
  });
  canvas.addEventListener('lostpointercapture', (event) => {
    restoreHold.cancel(event.pointerId);
    if (taps.cancel(event.pointerId)) renderer?.releaseLook();
  });
  canvas.addEventListener('contextmenu', (event) => {
    if (uiHidden) event.preventDefault();
  });
}

// --- Tilt and shake ---------------------------------------------------------

const tiltFilter = new OrientationFilter();
let tiltTarget: OrientationState = { ...NEUTRAL_ORIENTATION };
let tiltFrame = 0;
let lastTiltTime = 0;
let motionEnabled = false;

const sensors = new MotionSensors({
  onTilt: (state) => {
    tiltTarget = state;
  },
  onShake: () => {
    if (ready) renderer?.playMotion(character.shakeMotion);
  },
});

function tiltLoop(time: number): void {
  const deltaSeconds = lastTiltTime ? (time - lastTiltTime) / 1000 : 0;
  lastTiltTime = time;
  renderer?.setTiltOffsets(tiltToParameters(tiltFilter.update(tiltTarget, deltaSeconds)));
  tiltFrame = requestAnimationFrame(tiltLoop);
}

function setMotionEnabled(enabled: boolean): void {
  motionEnabled = enabled;
  motionToggle.setAttribute('aria-pressed', String(enabled));
  motionToggle.setAttribute('aria-label', enabled ? '기울이기·흔들기 끄기' : '기울이기·흔들기 켜기');
  element('motion-label').textContent = enabled ? '기울이기 끄기' : '기울이기 켜기';
  syncRuntimeState();
}

function isRuntimePaused(): boolean {
  return document.visibilityState === 'hidden' || mobileLandscape.matches;
}

function syncRuntimeState(): void {
  const paused = isRuntimePaused();
  if (paused) inputModes.cancelPendingMotion();
  renderer?.setPaused(paused);
  if (paused) cancelPointerGesture();
  if (paused && camera.isEnabled) {
    camera.stop();
    return;
  }
  cancelAnimationFrame(tiltFrame);
  if (motionEnabled && !paused && !camera.isEnabled) {
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

function wireButtons(): void {
  motionToggle.addEventListener('click', () => { void inputModes.toggleMotion(); });

  reactButton.addEventListener('click', () => renderer?.playMotion(character.tapMotion));
  expressionButton.addEventListener('click', () => renderer?.cycleExpression());
}

function wireVisibility(): void {
  document.addEventListener('visibilitychange', syncRuntimeState);
}

// Ordinary browser tabs cannot reliably lock orientation (notably on iPhone).
// The non-dismissible modal prevents landscape use without losing open sheets.
function refreshPortraitGate(): void {
  if (mobileLandscape.matches) {
    if (!portraitDialog.open) portraitDialog.showModal();
  } else if (portraitDialog.open) {
    portraitDialog.close();
  }
  syncRuntimeState();
}

function tryPortraitLock(): void {
  if (!window.matchMedia('(hover: none) and (pointer: coarse)').matches) return;
  const orientation = screen.orientation as ScreenOrientation & {
    lock?: (orientation: 'portrait') => Promise<void>;
  };
  // Unsupported and fullscreen-only browsers use the portrait gate instead.
  if (typeof orientation?.lock === 'function') void orientation.lock('portrait').catch(() => {});
}

// --- Camera -----------------------------------------------------------------

let cameraWasEnabled = false;
const camera = new FaceTracker({
  video: cameraVideo,
  onParameters: (parameters) => renderer?.setFaceParameters(parameters),
  onLandmarks: (points) => drawFacePoints(facePointsCanvas, points, cameraVideo),
  onStatus: (status) => {
    const enabled = camera.isEnabled;
    cameraToggle.setAttribute('aria-pressed', String(enabled));
    cameraToggle.setAttribute('aria-label', status.state === 'starting' ? '카메라 준비 취소' :
      enabled ? '얼굴 따라하기 끄기' : '얼굴 따라하기 켜기');
    element('camera-label').textContent = status.state === 'starting' ? '준비 취소' :
      enabled ? '따라하기 끄기' : '따라하기 켜기';
    cameraToggle.disabled = !ready && !enabled;
    cameraPreview.hidden = !enabled;
    cameraStatus.textContent = status.state === 'starting' ? '카메라 준비 중…' :
      status.state === 'running' && status.faceFound ? '따라하는 중 · 기기 내 처리' : '얼굴을 보여 주세요';
    if (status.state === 'error') showNotice(status.message);
    // Inference reports status every frame. Only mode changes affect playback.
    if (cameraWasEnabled !== enabled) {
      cameraWasEnabled = enabled;
      syncRuntimeState();
    }
  },
});

const inputModes = new ExclusiveInputModes({
  motionEnabled: () => motionEnabled,
  setMotionEnabled,
  cameraEnabled: () => camera.isEnabled,
  startCamera: () => camera.start(),
  stopCamera: () => camera.stop(),
  canStartCamera: () => ready,
  paused: isRuntimePaused,
  requestMotionPermission,
  onMotionPermission: (permission) => {
    if (permission === 'granted') {
      showNotice('지금 기기를 든 자세가 기준이 돼요. 기울이거나 흔들어 보세요.');
    } else if (permission === 'denied') {
      showNotice('동작 및 방향 접근이 거부됐어요. 브라우저 설정에서 허용해 주세요.');
    } else if (permission === 'insecure') {
      showNotice('기울이기는 https 주소에서만 쓸 수 있어요.');
    } else {
      showNotice('이 기기에서는 기울이기를 지원하지 않아요.');
    }
  },
});
cameraToggle.addEventListener('click', () => inputModes.toggleCamera());
window.addEventListener('pagehide', () => {
  inputModes.cancelPendingMotion();
  cancelPointerGesture();
  camera.stop();
  setMotionEnabled(false);
  renderer?.setPaused(true);
});
window.addEventListener('pageshow', syncRuntimeState);

// --- Consent gate -----------------------------------------------------------

const store = browserStore();
if (hasAcceptedCurrentTerms(store)) {
  startCharacter();
} else {
  // The consent sheet cannot be dismissed without accepting.
  consentDialog.addEventListener('cancel', (event) => event.preventDefault());
  element('consent-accept').addEventListener('click', () => {
    recordAcceptance(store);
    consentDialog.close();
    startCharacter();
  });
  rendererMessage = null;
  showStatus();
  consentDialog.showModal();
}

portraitDialog.addEventListener('cancel', (event) => event.preventDefault());
mobileLandscape.addEventListener('change', refreshPortraitGate);
document.addEventListener('fullscreenchange', tryPortraitLock);
refreshPortraitGate();
tryPortraitLock();
