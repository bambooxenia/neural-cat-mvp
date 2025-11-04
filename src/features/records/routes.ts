import type { RouteRecordRaw } from 'vue-router'
import RouterOutlet from '@/app/router/RouterOutlet.vue'

// 先用“静态导入”，排除懒加载 chunk 404 的可能
import StickerWallPage   from './sticker-wall/pages/StickerWallPage.vue'
import JournalEditPage   from './journal/pages/JournalEditPage.vue'
import JournalDetailPage from './journal/pages/JournalDetailPage.vue'
import HistoryPage       from './history/pages/HistoryPage.vue'
import AnalyticsPage     from './analytics/pages/AnalyticsPage.vue'

const recordsRoutes: RouteRecordRaw = {
  // ✅ 相对路径（不要以 / 开头）
  path: 'records',
  component: RouterOutlet,
  meta: { tab: 'records' },
  redirect: { name: 'records.sticker-wall' },
  children: [
    // —— 诊断用：务必能看到这条 —— //
    {
      path: '__ping',
      name: 'records.__ping',
      // 内联组件：只要路由生效，这行字一定会出现
      component: { template: '<div style="padding:12px;font-weight:700;color:#2b7">PING OK</div>' },
      meta: { title: 'Ping', tab: 'records' },
    },

    {
      path: 'sticker-wall',
      name: 'records.sticker-wall',
      component: StickerWallPage,
      meta: { title: '贴纸墙', tab: 'records' },
    },
    {
      path: 'journal',
      component: RouterOutlet,
      redirect: { name: 'records.journal.list' },
      children: [
        {
          path: 'edit',
          name: 'records.journal.edit',
          component: JournalEditPage,
          meta: { title: '编辑日记', tab: 'records' },
        },
        {
          path: ':id',
          name: 'records.journal.detail',
          component: JournalDetailPage,
          props: true,
          meta: { title: '日记详情', tab: 'records' },
        },
      ],
    },
    {
      path: 'history',
      name: 'records.history',
      component: HistoryPage,
      meta: { title: '时间线', tab: 'records' },
    },
    {
      path: 'analytics',
      name: 'records.analytics',
      component: AnalyticsPage,
      meta: { title: '统计', tab: 'records' },
    },
  ],
}

export default recordsRoutes
