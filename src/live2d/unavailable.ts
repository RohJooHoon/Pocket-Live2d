import type { CharacterRenderer, CreateRenderer } from './renderer';

/**
 * Used when the Cubism SDK for Web is not staged under vendor/cubism/ (public
 * CI and fresh clones). The page still works and explains that the SDK is missing.
 */
export const createRenderer: CreateRenderer = (options) => {
  queueMicrotask(() => options.onStatus({ state: 'sdk_unavailable' }));
  const renderer: CharacterRenderer = {
    lookAt: () => {},
    releaseLook: () => {},
    tap: () => false,
    setTiltOffsets: () => {},
    playMotion: () => {},
    cycleExpression: () => null,
    setPaused: () => {},
    dispose: () => {},
  };
  return renderer;
};
