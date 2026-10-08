import { onBeforeUnmount, onMounted } from 'vue';

/** Block browser zoom gestures while allowing ordinary clicks and sheet scrolling. */
export function useZoomGuard(): void {
  const preventZoom = (event: Event): void => event.preventDefault();
  const onWheel = (event: WheelEvent): void => {
    // Desktop trackpad pinch gestures arrive as Ctrl+wheel.
    if (event.ctrlKey) event.preventDefault();
  };

  onMounted(() => {
    document.addEventListener('dblclick', preventZoom);
    document.addEventListener('gesturestart', preventZoom, { passive: false });
    document.addEventListener('gesturechange', preventZoom, { passive: false });
    document.addEventListener('wheel', onWheel, { passive: false });
  });

  onBeforeUnmount(() => {
    document.removeEventListener('dblclick', preventZoom);
    document.removeEventListener('gesturestart', preventZoom);
    document.removeEventListener('gesturechange', preventZoom);
    document.removeEventListener('wheel', onWheel);
  });
}
