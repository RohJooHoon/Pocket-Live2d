<script setup lang="ts">
import { SERVICE_NAME } from '../config';
import type { LegalDocumentKey } from '../legal/documents';
import IconClose from './IconClose.vue';
import LegalLinks from './LegalLinks.vue';
import SheetDialog from './SheetDialog.vue';

defineProps<{ credit: string }>();
defineEmits<{ openDocument: [key: LegalDocumentKey] }>();
const open = defineModel<boolean>('open', { required: true });
</script>

<template>
  <SheetDialog v-model:open="open" class="sheet" aria-labelledby="info-title">
    <header class="sheet-header">
      <h2 id="info-title">{{ SERVICE_NAME }}</h2>
      <form method="dialog"><button class="icon-button" aria-label="닫기"><IconClose /></button></form>
    </header>
    <p id="info-credit" class="fine-print">{{ credit }}</p>
    <p class="fine-print">‘UI 숨기기’를 누르면 캐릭터만 보여요. 켜 둔 얼굴 따라하기는 계속 작동해요. 화면을 꾹 누르고 있으면 UI가 다시 나타나요. 키보드에서는 Escape로 돌아올 수 있어요.</p>
    <p class="fine-print">
      캐릭터 표시에 Live2D Cubism SDK를 사용합니다. Live2D는 Live2D Inc.의 상표이며, 이 페이지는 Live2D Inc.가 만들거나 인증한 것이 아닙니다.
    </p>
    <LegalLinks @open="$emit('openDocument', $event)" />
    <p class="fine-print">얼굴 따라하기에는 MediaPipe를 사용해요. <a href="/face/NOTICE.txt" target="_blank" rel="noopener">오픈소스 고지</a></p>
  </SheetDialog>
</template>
