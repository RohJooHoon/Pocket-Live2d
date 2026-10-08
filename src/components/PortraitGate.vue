<script setup lang="ts">
import SheetDialog from './SheetDialog.vue';

defineProps<{ open: boolean }>();
</script>

<template>
  <!-- Non-dismissible, so landscape use is blocked without losing open sheets. -->
  <SheetDialog
    :open="open"
    :dismissible="false"
    class="portrait-gate"
    aria-labelledby="portrait-title"
    aria-describedby="portrait-description"
    tabindex="-1"
  >
    <div class="portrait-message">
      <svg class="portrait-icon" viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <rect x="20" y="8" width="24" height="48" rx="5" stroke="currentColor" stroke-width="3" />
        <path d="M28 49h8" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
      </svg>
      <h2 id="portrait-title">기기를 세로로 돌려 주세요</h2>
      <p id="portrait-description">캐릭터는 세로 화면에서 만날 수 있어요.</p>
    </div>
  </SheetDialog>
</template>
