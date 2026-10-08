<script setup lang="ts">
import { computed, nextTick, useTemplateRef, watch } from 'vue';
import { legalDocuments, type LegalDocumentKey } from '../legal/documents';
import IconClose from './IconClose.vue';
import LegalDocument from './LegalDocument.vue';
import SheetDialog from './SheetDialog.vue';

const props = defineProps<{ documentKey: LegalDocumentKey }>();
const open = defineModel<boolean>('open', { required: true });

const selected = computed(() => legalDocuments[props.documentKey]);
const body = useTemplateRef<HTMLElement>('document-body');

watch([open, () => props.documentKey], async ([isOpen]) => {
  if (!isOpen) return;
  await nextTick();
  if (body.value) body.value.scrollTop = 0;
});
</script>

<template>
  <SheetDialog v-model:open="open" class="sheet document" aria-labelledby="document-title">
    <header>
      <h2 id="document-title">{{ selected.title }}</h2>
      <form method="dialog"><button class="icon-button" aria-label="닫기"><IconClose /></button></form>
    </header>
    <article id="document-body" ref="document-body">
      <LegalDocument :source="selected.source" />
    </article>
  </SheetDialog>
</template>
