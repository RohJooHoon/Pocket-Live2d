<script setup lang="ts">
import { SERVICE_NAME } from '../config';

defineProps<{ characterName: string }>();
defineEmits<{ hideUi: []; openInfo: [] }>();
</script>

<template>
  <header class="top-bar" data-ui>
    <div>
      <span class="brand-label">{{ SERVICE_NAME }}</span>
      <h1>{{ characterName }}</h1>
    </div>
    <div class="header-actions">
      <button
        class="hide-ui-button"
        type="button"
        title="화면을 8초 누르면 UI가 다시 나타나요"
        aria-label="UI 숨기기. 화면을 8초 동안 길게 누르면 다시 표시됩니다."
        @click="$emit('hideUi')"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.4 5.3A11 11 0 0 1 12 5c6 0 10 7 10 7a18 18 0 0 1-3.1 3.7M6 6a20 20 0 0 0-4 6s4 7 10 7a11 11 0 0 0 5-1.2" /></svg>
        <span>UI 숨기기</span>
      </button>
      <button class="icon-button" type="button" aria-label="정보" @click="$emit('openInfo')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5M12 8h.01" /></svg>
      </button>
    </div>
  </header>
</template>
