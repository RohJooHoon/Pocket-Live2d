<script setup lang="ts">
import { onMounted, useTemplateRef, watch } from 'vue';

const props = withDefaults(defineProps<{
  /** False keeps the dialog open until the parent closes it (Escape is ignored). */
  dismissible?: boolean;
}>(), { dismissible: true });

const open = defineModel<boolean>('open', { required: true });
const dialog = useTemplateRef<HTMLDialogElement>('dialog-element');

// A native modal <dialog> keeps focus trapping, the backdrop and Escape handling.
function sync(): void {
  const element = dialog.value;
  if (!element) return;
  if (open.value && !element.open) element.showModal();
  else if (!open.value && element.open) element.close();
}

function onCancel(event: Event): void {
  if (!props.dismissible) event.preventDefault();
}

function onClose(): void {
  if (!open.value) return;
  // Browsers may skip a repeated cancel event; reopen what must stay open.
  if (!props.dismissible) dialog.value?.showModal();
  else open.value = false;
}

onMounted(sync);
watch(open, sync, { flush: 'post' });
</script>

<template>
  <dialog ref="dialog-element" @cancel="onCancel" @close="onClose">
    <slot />
  </dialog>
</template>
