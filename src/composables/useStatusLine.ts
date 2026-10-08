import { computed, onBeforeUnmount, ref } from 'vue';

const NOTICE_MS = 4000;

/** One status line: the renderer's lasting message, briefly replaced by notices. */
export function useStatusLine() {
  const rendererMessage = ref<string | null>(null);
  const notice = ref<string | null>(null);
  let noticeTimer: ReturnType<typeof setTimeout> | undefined;

  function clearNotice(): void {
    clearTimeout(noticeTimer);
    notice.value = null;
  }

  /** A new renderer state replaces any notice still on screen. */
  function setRendererMessage(message: string | null): void {
    clearNotice();
    rendererMessage.value = message;
  }

  function showNotice(message: string): void {
    clearTimeout(noticeTimer);
    notice.value = message;
    noticeTimer = setTimeout(clearNotice, NOTICE_MS);
  }

  onBeforeUnmount(() => clearTimeout(noticeTimer));

  return {
    message: computed(() => notice.value ?? rendererMessage.value),
    setRendererMessage,
    showNotice,
  };
}

export type StatusLine = ReturnType<typeof useStatusLine>;
