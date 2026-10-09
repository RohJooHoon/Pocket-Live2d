<script setup lang="ts">
import { onMounted, ref, useTemplateRef, watch } from 'vue';
import ConsentSheet from './components/ConsentSheet.vue';
import ControlBar from './components/ControlBar.vue';
import DocumentSheet from './components/DocumentSheet.vue';
import FacePreview from './components/FacePreview.vue';
import InfoSheet from './components/InfoSheet.vue';
import PortraitGate from './components/PortraitGate.vue';
import TopBar from './components/TopBar.vue';
import { useCharacterStage } from './composables/useCharacterStage';
import { useMobileLandscape } from './composables/useMobileLandscape';
import { useStatusLine } from './composables/useStatusLine';
import { useZoomGuard } from './composables/useZoomGuard';
import { SERVICE_NAME } from './config';
import { browserStore, hasAcceptedCurrentTerms, recordAcceptance } from './legal/consent';
import type { LegalDocumentKey } from './legal/documents';

document.title = SERVICE_NAME;
useZoomGuard();

const canvas = useTemplateRef<HTMLCanvasElement>('character-canvas');
const video = useTemplateRef<HTMLVideoElement>('camera-video');
const facePreview = useTemplateRef<InstanceType<typeof FacePreview>>('face-preview');

const landscape = useMobileLandscape();
const status = useStatusLine();
const stage = useCharacterStage(
  { canvas, video, facePoints: () => facePreview.value?.canvas ?? null },
  { landscape, status },
);
const { character, automaticMotionEnabled, motionEnabled, uiHidden, restoreHintVisible, pointer } = stage;
const { enabled: cameraEnabled, state: cameraState, faceFound, canToggle: cameraCanToggle } = stage.camera;
const statusMessage = status.message;

const store = browserStore();
const accepted = ref(hasAcceptedCurrentTerms(store));

function accept(): void {
  recordAcceptance(store);
  accepted.value = true;
  stage.start();
}

const infoOpen = ref(false);
const documentOpen = ref(false);
const documentKey = ref<LegalDocumentKey>('terms');

function openDocument(key: LegalDocumentKey): void {
  documentKey.value = key;
  documentOpen.value = true;
}

watch(uiHidden, (hidden) => {
  if (!hidden) return;
  infoOpen.value = false;
  documentOpen.value = false;
});

onMounted(() => {
  if (accepted.value) stage.start();
});
</script>

<template>
  <main class="stage" :class="{ 'ui-hidden': uiHidden }">
    <canvas
      id="character-canvas"
      ref="character-canvas"
      aria-label="캐릭터"
      @pointerdown="pointer.onPointerDown"
      @pointermove="pointer.onPointerMove"
      @pointerup="pointer.onPointerUp"
      @pointercancel="pointer.onPointerCancel"
      @lostpointercapture="pointer.onLostPointerCapture"
      @contextmenu="pointer.onContextMenu"
    />

    <Transition name="restore-hint">
      <p v-if="restoreHintVisible" class="restore-hint" role="status">
        화면을 꾹 누르고 있으면 UI 숨기기가 해제됩니다.
      </p>
    </Transition>

    <TopBar :character-name="character?.name ?? '캐릭터'" @hide-ui="stage.setUiHidden(true)" @open-info="infoOpen = true" />

    <video id="camera-video" ref="camera-video" autoplay muted playsinline hidden aria-hidden="true" />
    <FacePreview ref="face-preview" :visible="cameraEnabled" :state="cameraState" :face-found="faceFound" />

    <ControlBar
      :status="statusMessage"
      :automatic-motion-enabled="automaticMotionEnabled"
      :motion-enabled="motionEnabled"
      :camera-enabled="cameraEnabled"
      :camera-state="cameraState"
      :camera-toggle-enabled="cameraCanToggle"
      @toggle-automatic-motion="stage.toggleAutomaticMotion"
      @toggle-motion="stage.toggleMotion"
      @toggle-camera="stage.toggleCamera"
    />
  </main>

  <ConsentSheet :open="!accepted" @accept="accept" @open-document="openDocument" />
  <InfoSheet v-model:open="infoOpen" :credit="character?.credit ?? ''" @open-document="openDocument" />
  <DocumentSheet v-model:open="documentOpen" :document-key="documentKey" />
  <PortraitGate :open="landscape" />
</template>
