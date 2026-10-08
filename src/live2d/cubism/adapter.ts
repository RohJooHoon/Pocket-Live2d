// Vite swaps this in for '@cubism-adapter' only when vendor/cubism/ holds the
// Cubism SDK for Web (see vite.config.ts). It must not import the Framework
// directly: Framework modules read Cubism Core when they load, so a missing or
// failed Core script would otherwise stop the whole page.
import { DeferredRenderer } from '../deferred';
import type { CreateRenderer } from '../renderer';

export const createRenderer: CreateRenderer = (options) => {
  const renderer = new DeferredRenderer();
  options.onStatus({ state: 'loading' });

  if (typeof Live2DCubismCore === 'undefined' || Live2DCubismCore == null) {
    queueMicrotask(() => options.onStatus({ state: 'sdk_unavailable' }));
    return renderer;
  }

  import('./cubismRenderer')
    .then(({ CubismCharacterRenderer }) => renderer.attach(new CubismCharacterRenderer(options)))
    .catch((error: unknown) =>
      options.onStatus({
        state: 'error',
        message: error instanceof Error ? error.message : String(error),
      }),
    );
  return renderer;
};
