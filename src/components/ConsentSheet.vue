<script setup lang="ts">
import { SERVICE_NAME } from '../config';
import type { LegalDocumentKey } from '../legal/documents';
import LegalLinks from './LegalLinks.vue';
import SheetDialog from './SheetDialog.vue';

defineProps<{ open: boolean }>();
defineEmits<{ accept: []; openDocument: [key: LegalDocumentKey] }>();
</script>

<template>
  <!-- The consent sheet cannot be dismissed without accepting. -->
  <SheetDialog :open="open" :dismissible="false" class="sheet" aria-labelledby="consent-title">
    <div class="sheet-symbol" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="6" /><path d="M8 14c2 2.5 6 2.5 8 0M8 9h.01M16 9h.01" /></svg>
    </div>
    <h2 id="consent-title">{{ SERVICE_NAME }} 시작하기</h2>
    <p class="sheet-intro">계정 없이, 바로 만나보세요.</p>
    <ul class="consent-details">
      <li>기울이기·흔들기는 직접 켠 동안에만 센서를 사용해요.</li>
      <li>따라하기를 켜고 권한을 허용하면 카메라를 사용해요. 영상은 기기 안에서만 처리하고 녹화·전송하지 않아요. 마이크도 사용하지 않아요.</li>
      <li>얼굴 추적 도구(MediaPipe)의 성능·사용 지표는 Google로 전송될 수 있어요. 자세한 내용은 개인정보처리방침에 안내해요.</li>
      <li>캐릭터와 Live2D Cubism Core를 분석하거나 추출해서 배포하면 안 돼요.</li>
    </ul>
    <LegalLinks @open="$emit('openDocument', $event)" />
    <p class="fine-print">‘동의하고 시작하기’를 누르면 이용약관과 개인정보처리방침에 동의하게 돼요.</p>
    <button id="consent-accept" type="button" class="primary" @click="$emit('accept')">동의하고 시작하기</button>
  </SheetDialog>
</template>
