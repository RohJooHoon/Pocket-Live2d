<script setup lang="ts">
import { computed, useTemplateRef } from 'vue';
import type { CameraStatus } from '../input/faceTracker';

const props = defineProps<{
  visible: boolean;
  state: CameraStatus['state'];
  faceFound: boolean;
  bodyFound: boolean;
  bodyAvailable: boolean;
}>();

const statusText = computed(() => {
  if (props.state === 'starting') return '카메라 준비 중…';
  if (props.state !== 'running') return '얼굴과 상체를 보여 주세요';
  if (!props.bodyAvailable) return props.faceFound ? '얼굴 추적 중 · 상체 추적 준비 실패' : '얼굴을 보여 주세요';
  if (props.faceFound && props.bodyFound) return '얼굴·몸 따라하는 중 · 기기 내 처리';
  if (props.bodyFound) return '몸 따라하는 중 · 얼굴을 보여 주세요';
  return props.faceFound ? '어깨와 허리도 보여 주세요' : '얼굴과 상체를 보여 주세요';
});

// Kept mounted while hidden so landmarks can be drawn as soon as tracking starts.
const canvas = useTemplateRef<HTMLCanvasElement>('points-canvas');
defineExpose({ canvas });
</script>

<template>
  <aside class="camera-preview" aria-label="얼굴과 상체 트래킹 포인트" data-ui :hidden="!visible">
    <canvas ref="points-canvas" width="240" height="320" role="img" aria-label="얼굴과 상체의 위치를 나타내는 트래킹 포인트" />
    <p role="status">{{ statusText }}</p>
  </aside>
</template>
