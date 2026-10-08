<script setup lang="ts">
import { computed, useTemplateRef } from 'vue';
import type { CameraStatus } from '../input/faceTracker';

const props = defineProps<{
  visible: boolean;
  state: CameraStatus['state'];
  faceFound: boolean;
}>();

const statusText = computed(() => {
  if (props.state === 'starting') return '카메라 준비 중…';
  return props.state === 'running' && props.faceFound ? '따라하는 중 · 기기 내 처리' : '얼굴을 보여 주세요';
});

// Kept mounted while hidden so landmarks can be drawn as soon as tracking starts.
const canvas = useTemplateRef<HTMLCanvasElement>('points-canvas');
defineExpose({ canvas });
</script>

<template>
  <aside class="camera-preview" aria-label="얼굴 트래킹 포인트" data-ui :hidden="!visible">
    <canvas ref="points-canvas" width="240" height="320" role="img" aria-label="얼굴의 위치와 표정을 나타내는 트래킹 포인트" />
    <p role="status">{{ statusText }}</p>
  </aside>
</template>
