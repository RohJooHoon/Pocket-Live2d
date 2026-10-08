import { createRenderer as createVueRenderer, nextTick, ref } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRenderer } from '@cubism-adapter';
import { loadCharacter } from '../src/characters/loadCharacter';
import { useCharacterStage } from '../src/composables/useCharacterStage';
import { useStatusLine } from '../src/composables/useStatusLine';
import { useZoomGuard } from '../src/composables/useZoomGuard';
import type { CharacterRenderer } from '../src/live2d/renderer';

vi.mock('@cubism-adapter', () => ({ createRenderer: vi.fn() }));
vi.mock('../src/characters/loadCharacter', () => ({ loadCharacter: vi.fn() }));

// Mount the real composable with Vue lifecycle hooks, without a browser DOM.
const host = createVueRenderer<object, object>({
  createElement: () => ({}), createText: () => ({}), createComment: () => ({}),
  insert: () => {}, remove: () => {}, setText: () => {}, setElementText: () => {},
  patchProp: () => {}, parentNode: () => null, nextSibling: () => null,
});
const cleanup: Array<() => void> = [];

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('window', Object.assign(new EventTarget(), {
    location: { pathname: '/mark', origin: 'https://example.com' },
  }));
  vi.stubGlobal('document', Object.assign(new EventTarget(), { visibilityState: 'visible', activeElement: null }));
  vi.stubGlobal('HTMLElement', class {});
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});

afterEach(() => {
  cleanup.splice(0).forEach((unmount) => unmount());
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

async function fixture() {
  const renderer: CharacterRenderer = {
    lookAt: vi.fn(), releaseLook: vi.fn(), tap: vi.fn(() => true),
    setAutomaticMotionEnabled: vi.fn(),
    setTiltOffsets: vi.fn(), setFaceParameters: vi.fn(), playMotion: vi.fn(),
    cycleExpression: vi.fn(() => null), setPaused: vi.fn(), dispose: vi.fn(),
  };
  vi.mocked(loadCharacter).mockResolvedValue({ character: __CHARACTER__, modelDirectory: '/model/' });
  vi.mocked(createRenderer).mockImplementation((options) => {
    options.onStatus({ state: 'ready' });
    return renderer;
  });
  const captures = new Set<number>();
  const canvas = {
    setPointerCapture: vi.fn((id: number) => captures.add(id)),
    hasPointerCapture: (id: number) => captures.has(id),
    releasePointerCapture: vi.fn((id: number) => captures.delete(id)),
    getBoundingClientRect: () => ({ left: 20, top: 30 }),
  };
  let stage!: ReturnType<typeof useCharacterStage>;
  const app = host.createApp({
    setup() {
      useZoomGuard();
      stage = useCharacterStage({
        canvas: ref(canvas as unknown as HTMLCanvasElement),
        video: ref({ pause: vi.fn(), srcObject: null } as unknown as HTMLVideoElement), facePoints: () => null,
      }, { landscape: ref(false), status: useStatusLine() });
      return () => null;
    },
  });
  app.mount({});
  cleanup.push(() => app.unmount());
  stage.start();
  await nextTick();
  const event = (overrides: Partial<PointerEvent> = {}) => ({
    pointerId: 1, pointerType: 'touch', isPrimary: true, button: 0,
    clientX: 100, clientY: 100, timeStamp: Date.now(), currentTarget: canvas, preventDefault: vi.fn(),
    ...overrides,
  }) as unknown as PointerEvent;
  return { stage, renderer, canvas, app, event };
}

describe('character stage hidden UI', () => {
  it('defaults automatic motion to off and forwards toggle changes to the renderer', async () => {
    const { stage, renderer } = await fixture();
    expect(stage.automaticMotionEnabled.value).toBe(false);
    expect(renderer.setAutomaticMotionEnabled).toHaveBeenLastCalledWith(false);
    stage.toggleAutomaticMotion();
    expect(stage.automaticMotionEnabled.value).toBe(true);
    expect(renderer.setAutomaticMotionEnabled).toHaveBeenLastCalledWith(true);
    stage.toggleAutomaticMotion();
    expect(renderer.setAutomaticMotionEnabled).toHaveBeenLastCalledWith(false);
  });

  it('shows the restore hint for four seconds each time UI is hidden', async () => {
    const { stage } = await fixture();
    stage.setUiHidden(true);
    expect(stage.restoreHintVisible.value).toBe(true);
    vi.advanceTimersByTime(3999);
    expect(stage.restoreHintVisible.value).toBe(true);
    vi.advanceTimersByTime(1);
    expect(stage.restoreHintVisible.value).toBe(false);
    expect(stage.uiHidden.value).toBe(true);
    stage.setUiHidden(false);
    stage.setUiHidden(true);
    expect(stage.restoreHintVisible.value).toBe(true);
    window.dispatchEvent(new KeyboardEventStub('Escape'));
    expect(stage.restoreHintVisible.value).toBe(false);
    expect(stage.uiHidden.value).toBe(false);
  });

  it('forwards only short taps for hit testing, with no drag or gaze input in both UI modes', async () => {
    const { stage, renderer, canvas, event } = await fixture();
    for (const hidden of [false, true]) {
      stage.setUiHidden(hidden);
      stage.pointer.onPointerDown(event());
      vi.advanceTimersByTime(100);
      stage.pointer.onPointerUp(event());
      stage.pointer.onPointerDown(event());
      stage.pointer.onPointerMove(event({ clientX: 180 }));
      stage.pointer.onPointerUp(event());
    }
    expect(renderer.tap).toHaveBeenCalledTimes(2);
    expect(renderer.tap).toHaveBeenCalledWith(80, 70);
    expect(renderer.lookAt).not.toHaveBeenCalled();
    expect(renderer.releaseLook).not.toHaveBeenCalled();
    expect(canvas.hasPointerCapture(1)).toBe(false);
  });

  it('restores UI at ten seconds and releases capture without a character action on release', async () => {
    const { stage, renderer, canvas, event } = await fixture();
    stage.setUiHidden(true);
    stage.pointer.onPointerDown(event());
    vi.advanceTimersByTime(9999);
    expect(stage.uiHidden.value).toBe(true);
    vi.advanceTimersByTime(1);
    expect(stage.uiHidden.value).toBe(false);
    expect(stage.restoreHintVisible.value).toBe(false);
    expect(canvas.hasPointerCapture(1)).toBe(false);
    stage.pointer.onPointerUp(event());
    expect(renderer.tap).not.toHaveBeenCalled();
    expect(renderer.lookAt).not.toHaveBeenCalled();
  });

  it.each(['release', 'drag', 'cancel', 'lost capture', 'second finger', 'blur'])(
    'cancels the ten-second hold on %s', async (interruption) => {
      const { stage, event } = await fixture();
      stage.setUiHidden(true);
      stage.pointer.onPointerDown(event());
      vi.advanceTimersByTime(9000);
      switch (interruption) {
        case 'release': stage.pointer.onPointerUp(event()); break;
        case 'drag': stage.pointer.onPointerMove(event({ clientX: 130 })); break;
        case 'cancel': stage.pointer.onPointerCancel(event()); break;
        case 'lost capture': stage.pointer.onLostPointerCapture(event()); break;
        case 'second finger': stage.pointer.onPointerDown(event({ pointerId: 2, isPrimary: false })); break;
        case 'blur': window.dispatchEvent(new Event('blur')); break;
      }
      vi.advanceTimersByTime(10000);
      expect(stage.uiHidden.value).toBe(true);
    },
  );

  it('clears hint and hold timers when unmounted', async () => {
    const { stage, app, canvas, event } = await fixture();
    stage.setUiHidden(true);
    stage.pointer.onPointerDown(event());
    app.unmount();
    expect(vi.getTimerCount()).toBe(0);
    expect(canvas.hasPointerCapture(1)).toBe(false);
  });

  it('blocks double-click and pinch zoom without blocking normal wheel scrolling', async () => {
    const { app } = await fixture();
    for (const type of ['dblclick', 'gesturestart', 'gesturechange']) {
      const event = new Event(type, { cancelable: true });
      document.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
    }
    const pinch = Object.assign(new Event('wheel', { cancelable: true }), { ctrlKey: true });
    document.dispatchEvent(pinch);
    expect(pinch.defaultPrevented).toBe(true);
    const scroll = Object.assign(new Event('wheel', { cancelable: true }), { ctrlKey: false });
    document.dispatchEvent(scroll);
    expect(scroll.defaultPrevented).toBe(false);
    app.unmount();
    const afterUnmount = new Event('dblclick', { cancelable: true });
    document.dispatchEvent(afterUnmount);
    expect(afterUnmount.defaultPrevented).toBe(false);
  });
});

class KeyboardEventStub extends Event {
  constructor(readonly key: string) { super('keydown'); }
}
