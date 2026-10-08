<script setup lang="ts">
import { computed } from 'vue';
import type { CameraStatus } from '../input/faceTracker';

const props = defineProps<{
  status: string | null;
  ready: boolean;
  motionEnabled: boolean;
  cameraEnabled: boolean;
  cameraState: CameraStatus['state'];
  cameraToggleEnabled: boolean;
}>();
defineEmits<{ toggleMotion: []; toggleCamera: []; react: []; expression: [] }>();

const cameraStarting = computed(() => props.cameraState === 'starting');
const cameraLabel = computed(() =>
  cameraStarting.value ? '준비 취소' : props.cameraEnabled ? '따라하기 끄기' : '따라하기 켜기');
const cameraAriaLabel = computed(() =>
  cameraStarting.value ? '카메라 준비 취소' : props.cameraEnabled ? '얼굴 따라하기 끄기' : '얼굴 따라하기 켜기');
</script>

<template>
  <footer class="bottom-panel" data-ui>
    <p class="status" role="status" :hidden="status == null">{{ status }}</p>
    <nav class="controls" aria-label="캐릭터 조작">
      <button
        type="button"
        :aria-pressed="motionEnabled"
        :aria-label="motionEnabled ? '기울이기·흔들기 끄기' : '기울이기·흔들기 켜기'"
        @click="$emit('toggleMotion')"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="7" y="3" width="10" height="18" rx="3" transform="rotate(15 12 12)" /><path d="M10 17h3" /></svg>
        <span>{{ motionEnabled ? '기울이기 끄기' : '기울이기 켜기' }}</span>
      </button>
      <button
        type="button"
        :aria-pressed="cameraEnabled"
        :aria-label="cameraAriaLabel"
        :disabled="!cameraToggleEnabled"
        @click="$emit('toggleCamera')"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="4" /><circle cx="12" cy="12" r="3.5" /><path d="M8 5l1-2h6l1 2" /></svg>
        <span>{{ cameraLabel }}</span>
      </button>
      <button class="secondary-control" type="button" :disabled="!ready" @click="$emit('react')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3z" /></svg>
        <span>반응</span>
      </button>
      <button class="secondary-control" type="button" :disabled="!ready" @click="$emit('expression')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="M8 14.5c2 2.7 6 2.7 8 0M9 9h.01M15 9h.01" /></svg>
        <span>표정</span>
      </button>
    </nav>
  </footer>
</template>
