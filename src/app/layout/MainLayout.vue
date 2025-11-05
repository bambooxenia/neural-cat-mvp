<!-- src/app/layout/MainLayout.vue -->
<template>
  <div class="layout">
    <!-- Topbar (no home link or title) -->
    <header class="topbar safe-top" aria-label="App Topbar">
      <div class="topbar-left" aria-hidden="true"></div>
      <div class="top-actions"><!-- right slot --></div>
    </header>

    <!-- Page content -->
    <main class="page">
      <router-view />
    </main>

    <!-- Bottom tabbar -->
    <nav class="tabbar safe-bottom" role="navigation" aria-label="Main Tabs">
      <button
        v-for="t in tabs"
        :key="t.key"
        class="tab"
        :class="{ active: isActive(t), disabled: !canGo(t) }"
        :aria-current="isActive(t) ? 'page' : undefined"
        :aria-label="t.label"
        :disabled="!canGo(t)"
        @click="canGo(t) && go(t)"
      >
        <span class="icon" aria-hidden="true">{{ t.icon }}</span>
        <span class="label">{{ t.label }}</span>
      </button>
    </nav>
  </div>
  </template>

<script setup lang="ts">
import { watch } from 'vue'
import { useRoute, useRouter, type RouteLocationRaw } from 'vue-router'

// Base title
const BASE_TITLE = 'Neural Cat'

// Feature flags (future features)
const FEATURE_FLAGS: Record<Tab['key'], boolean> = {
  home: true,
  records: true,
  tools: true,
  community: true,
  account: true,
}

type To = { name: string } | { path: string }
type Tab = {
  key: 'home' | 'records' | 'tools' | 'community' | 'account'
  to: To
  label: string
  icon: string
  match?: (path: string) => boolean
}

const router = useRouter()
const route = useRoute()

// Bottom tabs
const tabs: Tab[] = [
  { key: 'home',      to: { name: 'home.index' },             label: 'Home',      icon: '🏠',  match: p => p.startsWith('/home') },
  { key: 'records',   to: { path: '/records/sticker-wall' },  label: 'Records',   icon: '📖',  match: p => p.startsWith('/records') },
  { key: 'tools',     to: { name: 'tools.pomodoro' },         label: 'Tools',     icon: '🛠️', match: p => p.startsWith('/tools') },
  { key: 'community', to: { name: 'community.share' },        label: 'Community', icon: '👥',  match: p => p.startsWith('/community') },
  { key: 'account',   to: { name: 'account.index' },          label: 'Account',   icon: '👤',  match: p => p.startsWith('/account') },
]

// Availability
const canGo = (t: Tab) => {
  if (t.key in FEATURE_FLAGS && !FEATURE_FLAGS[t.key]) return false
  if ('name' in t.to) return router.hasRoute(t.to.name)
  return true
}

// Active state
const isActive = (t: Tab) => {
  const tab = route.meta?.tab as Tab['key'] | undefined
  if (tab) return tab === t.key
  if (t.match) return t.match(route.path)
  const resolved = router.resolve(t.to as RouteLocationRaw)
  const base = resolved.path.replace(/\/+$/, '') || '/'
  const curr = route.path.replace(/\/+$/, '') || '/'
  return curr === base || curr.startsWith(base + '/')
}

// Navigate
const go = (t: Tab) => router.push(t.to).catch(() => {})

// Document title
watch(
  () => route.meta?.title as string | undefined,
  (title) => { document.title = title ? `${BASE_TITLE} · ${title}` : BASE_TITLE },
  { immediate: true }
)
</script>

<style scoped>
:root {
  --layout-footer-h: 56px;
  --shadow-sm: 0 6px 10px rgba(0,0,0,.04), 0 1px 3px rgba(0,0,0,.08);
  --border: 1px solid rgba(0,0,0,.06);
}

.layout {
  min-height: 100svh;
  display: grid;
  grid-template-rows: auto 1fr auto;
  background: var(--bg, #fff);
}

/* Topbar */
.topbar {
  position: sticky;
  top: 0;
  height: 48px;
  padding: 0 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  backdrop-filter: blur(6px);
  background: color-mix(in srgb, #fff 85%, transparent);
  border-bottom: var(--border);
  z-index: 10;
}
.topbar-left { width: 1px; height: 1px; }
.top-actions { display: flex; align-items: center; gap: 8px; }

/* Page content */
.page { padding: 12px 12px calc(var(--layout-footer-h) + 12px); }

/* Tabbar */
.tabbar {
  position: sticky;
  bottom: 0;
  height: var(--layout-footer-h);
  border-top: var(--border);
  background: #fff;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  align-items: stretch;
  box-shadow: var(--shadow-sm);
  z-index: 20;
}
.tab {
  border: 0;
  background: transparent;
  padding: 6px 2px 4px;
  display: grid;
  grid-auto-flow: row;
  justify-items: center;
  gap: 2px;
  font-size: 12px;
  color: #666;
  cursor: pointer;
  user-select: none;
}
.tab .icon { font-size: 18px; line-height: 1; }
.tab.active { color: #111; font-weight: 600; }

.tab.disabled { opacity: .45; cursor: not-allowed; }

/* Safe areas */
.safe-bottom { padding-bottom: env(safe-area-inset-bottom); }
.safe-top { padding-top: env(safe-area-inset-top); }

/* Wide */
@media (min-width: 768px) {
  .layout { max-width: 720px; margin: 0 auto; border-left: var(--border); border-right: var(--border); }
  .page { padding-left: 16px; padding-right: 16px; }
}
</style>

