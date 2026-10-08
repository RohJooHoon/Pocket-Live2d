<script setup lang="ts">
import type { LegalDocumentKey } from '../legal/documents';

defineEmits<{ open: [key: LegalDocumentKey] }>();
</script>

<template>
  <div class="link-row">
    <button type="button" class="link-button" @click="$emit('open', 'terms')">이용약관</button>
    <button type="button" class="link-button" @click="$emit('open', 'privacy')">개인정보처리방침</button>
  </div>
</template>
