// src/features/records/journal/routes.ts
import type { RouteRecordRaw } from 'vue-router'

export const journalRoutes: RouteRecordRaw[] = [
  {
    path: '/records/journal/edit',          // ← 与 index.ts 保持一致（不是 /new）
    name: 'records.journal.edit',
    component: () => import('./pages/JournalEditPage.vue'),
    meta: {
      title: '新增奇迹日记',
      tab: 'records',                       // ← 必须有 tab
      backTo: '/records/sticker-wall', // ← 正确的连字符路由名
    },
  },
  {
    path: '/records/journal/:id(\\d+)',
    name: 'records.journal.detail',
    component: () => import('./pages/JournalDetailPage.vue'),
    props: true,
    meta: {
      title: '奇迹日记',
      tab: 'records',                       // ← 必须有 tab
      backTo: '/records/sticker-wall', // ← 正确的连字符路由名
    },
  },
]

export default journalRoutes

