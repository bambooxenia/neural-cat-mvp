//src/shared/components/PageHeader.vue

<template>
  <header class="nc-page-hd">
    <div class="left">
      <BackButton :fallback="fallback" />
      <!-- ✅ 默认不显示标题；需要时显式传 showTitle -->
      <h2 v-if="showTitle && title" class="title">{{ title }}</h2>
    </div>
    <div class="right">
      <slot name="extra" />
    </div>
  </header>
</template>

<script setup lang="ts">
import BackButton from './BackButton.vue'

const props = withDefaults(
  defineProps<{
    title?: string
    fallback?: string
    /** 是否显示标题（默认不显示） */
    showTitle?: boolean
  }>(),
  {
    fallback: '/',
    showTitle: false,
  }
)
</script>

<style scoped>
.nc-page-hd {
  display:flex; align-items:center; justify-content:space-between;
  margin-bottom:10px;
}
.left { display:flex; align-items:center; gap:8px }
.title { margin:0; font-size:20px; font-weight:800 }
.right :deep(> *) { margin-left: 8px; }
</style>
