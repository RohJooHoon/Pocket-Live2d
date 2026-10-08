<script setup lang="ts">
import { computed } from 'vue';
import { groupLegalBlocks, parseLegalMarkdown } from '../legal/markdown';

const props = defineProps<{ source: string }>();

// Text is interpolated, never parsed as HTML.
const nodes = computed(() => groupLegalBlocks(parseLegalMarkdown(props.source)));
</script>

<template>
  <template v-for="(node, index) in nodes" :key="index">
    <ul v-if="node.type === 'list'">
      <li v-for="(item, itemIndex) in node.items" :key="itemIndex">
        {{ item.text }}
        <ul v-if="item.children.length > 0">
          <li v-for="(child, childIndex) in item.children" :key="childIndex">{{ child }}</li>
        </ul>
      </li>
    </ul>
    <h2 v-else-if="node.type === 'heading1'">{{ node.text }}</h2>
    <h3 v-else-if="node.type === 'heading2'">{{ node.text }}</h3>
    <p v-else>{{ node.text }}</p>
  </template>
</template>
