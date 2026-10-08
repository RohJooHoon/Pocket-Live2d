<script setup lang="ts">
import { computed } from 'vue';
import type { CameraStatus } from '../input/faceTracker';

const props = defineProps<{
  status: string | null;
  automaticMotionEnabled: boolean;
  motionEnabled: boolean;
  cameraEnabled: boolean;
  cameraState: CameraStatus['state'];
  cameraToggleEnabled: boolean;
}>();
defineEmits<{ toggleAutomaticMotion: []; toggleMotion: []; toggleCamera: [] }>();

const cameraStarting = computed(() => props.cameraState === 'starting');
const cameraLabel = computed(() =>
  cameraStarting.value ? '준비 취소' : '따라하기');
</script>

<template>
  <footer class="bottom-panel" data-ui>
    <p class="status" role="status" :hidden="status == null">{{ status }}</p>
    <nav class="controls" aria-label="캐릭터 조작">
      <button
        type="button"
        :aria-pressed="automaticMotionEnabled"
        aria-label="자동모션"
        @click="$emit('toggleAutomaticMotion')"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 5l11 7-11 7V5z" /></svg>
        <span>자동모션</span>
      </button>
      <button
        type="button"
        :aria-pressed="motionEnabled"
        aria-label="기울이기"
        @click="$emit('toggleMotion')"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="7" y="3" width="10" height="18" rx="3" transform="rotate(15 12 12)" /><path d="M10 17h3" /></svg>
        <span>기울이기</span>
      </button>
      <button
        type="button"
        :aria-pressed="cameraEnabled"
        :aria-label="cameraLabel"
        :disabled="!cameraToggleEnabled"
        @click="$emit('toggleCamera')"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="4" /><circle cx="12" cy="12" r="3.5" /><path d="M8 5l1-2h6l1 2" /></svg>
        <span>{{ cameraLabel }}</span>
      </button>
    </nav>
  </footer>
</template>
