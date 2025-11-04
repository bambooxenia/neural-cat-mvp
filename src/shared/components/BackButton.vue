//src/shared/components/BackButton.vue

<template>
  <button class="nc-back-btn" type="button" @click="goBack" aria-label="Go Back">
    <span class="chev" aria-hidden="true">‹</span>
    <span class="txt">Back</span>
  </button>
</template>

<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router'

const props = withDefaults(defineProps<{ fallback?: string }>(), { fallback: '/' })

const router = useRouter()
const route  = useRoute()

/** 分区根返回到首页（上一级首页） */
const SECTION_PARENT: Record<string, string> = {
  records: '/home',
  tools: '/home',
  community: '/home',
  account: '/home',
  home: '/home',
}

function nav(to: string) {
  if (!to) to = '/home'
  if (to.startsWith('/')) router.push(to).catch(() => {})
  else router.push({ name: to as any }).catch(() => {})
}

/** 按“路径层级”返回上一级（不走浏览器历史） */
function goBack() {
  // 允许在具体路由自定义：meta.backTo
  const metaBack = route.meta?.backTo as string | undefined
  if (metaBack) return nav(metaBack)

  const clean   = (route.path || '/').replace(/\/+$/, '') || '/'
  const parts   = clean.split('/')              // ['', 'records', 'journal', 'edit']
  const section = parts[1] || ''

  if (parts.length > 2) {
    const parent = parts.slice(0, -1).join('/') || '/'
    // 若正好回到分区根，再向上回到首页
    if (parent === `/${section}` && SECTION_PARENT[section]) return nav(SECTION_PARENT[section])
    return nav(parent)
  }

  if (SECTION_PARENT[section]) return nav(SECTION_PARENT[section])
  return nav(props.fallback || '/')
}
</script>

<style scoped>
/* 纯文本返回样式（无方框） */
.nc-back-btn{
  appearance:none; border:0; background:transparent;
  padding:4px 2px; margin:0;
  display:inline-flex; align-items:center; gap:4px;
  font:inherit; font-size:18px; cursor:pointer;
  color: var(--el-text-color-regular, #606266);
  -webkit-tap-highlight-color: transparent;
}
.nc-back-btn .chev{ font-size:22px; line-height:1; transform: translateY(-1px); }
.nc-back-btn .txt{ font-weight:700; }
.nc-back-btn:hover .txt{ text-decoration: underline; }
.nc-back-btn:focus-visible{ outline:none; text-decoration: underline; }
</style>
