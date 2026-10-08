import { onBeforeUnmount, onMounted, readonly, ref } from 'vue';

const MOBILE_LANDSCAPE = '(hover: none) and (pointer: coarse) and (orientation: landscape)';

function tryPortraitLock(): void {
  if (!window.matchMedia('(hover: none) and (pointer: coarse)').matches) return;
  const orientation = screen.orientation as ScreenOrientation & {
    lock?: (orientation: 'portrait') => Promise<void>;
  };
  // Unsupported and fullscreen-only browsers use the portrait gate instead.
  if (typeof orientation?.lock === 'function') void orientation.lock('portrait').catch(() => {});
}

/**
 * Whether a phone or tablet is held sideways. Ordinary browser tabs cannot
 * reliably lock orientation (notably on iPhone), so the page shows a gate.
 */
export function useMobileLandscape() {
  const query = window.matchMedia(MOBILE_LANDSCAPE);
  const landscape = ref(query.matches);
  const update = () => {
    landscape.value = query.matches;
  };

  onMounted(() => {
    query.addEventListener('change', update);
    document.addEventListener('fullscreenchange', tryPortraitLock);
    tryPortraitLock();
  });
  onBeforeUnmount(() => {
    query.removeEventListener('change', update);
    document.removeEventListener('fullscreenchange', tryPortraitLock);
  });

  return readonly(landscape);
}
