// src/app/router/index.ts
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import MainLayout from '@/app/layout/MainLayout.vue'
import RouterOutlet from '@/app/router/RouterOutlet.vue'

// Home
import HomePage from '@/features/home/pages/HomePage.vue'
import MoodPage from '@/features/mood-baits/pages/MoodPage.vue'
import BaitsPage from '@/features/mood-baits/pages/BaitsPage.vue'
import TaskCardsPage from '@/features/task-cards/pages/TaskCardsPage.vue'
import BreakdownPage from '@/features/task-breakdown/pages/BreakdownPage.vue'
import IdeaNestPage from '@/features/idea-nest/pages/IdeaNestPage.vue'
import TaskTypePage from '@/features/task-cards/pages/TaskTypePage.vue'

// Records
import StickerWallPage from '@/features/records/sticker-wall/pages/StickerWallPage.vue'
import JournalEditPage from '@/features/records/journal/pages/JournalEditPage.vue'
import JournalDetailPage from '@/features/records/journal/pages/JournalDetailPage.vue'
import HistoryPage from '@/features/records/history/pages/HistoryPage.vue'
import AnalyticsPage from '@/features/records/analytics/pages/AnalyticsPage.vue'

// Tools
import BreathingPage from '@/features/tools/breathing/pages/BreathingPage.vue'
import PomodoroPage from '@/features/tools/pomodoro/pages/PomodoroPage.vue'
import MindfulnessPage from '@/features/tools/mindfulness/pages/MindfulnessPage.vue'

// Community
import ShareHomePage from '@/features/community/share/pages/ShareHomePage.vue'
import StickerExchangePage from '@/features/community/exchange/pages/StickerExchangePage.vue'
import SocialHomePage from '@/features/community/social/pages/SocialHomePage.vue'

// Account
import AccountHomePage from '@/features/account/pages/AccountHomePage.vue'
import FriendsPage from '@/features/account/friends/pages/FriendsPage.vue'
import CollectionsPage from '@/features/account/collections/pages/CollectionsPage.vue'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: MainLayout,
    children: [
      { path: '', redirect: '/home' },

      // 首页（父级 + 子路由）
      {
        path: 'home',
        component: RouterOutlet,
        meta: { tab: 'home' },
        children: [
          {
            path: '',
            name: 'home.index',
            component: HomePage,
            meta: { title: 'Home', tab: 'home' },
          },

          // 先到 心情选择页（MoodPage）
          {
            path: 'mood',
            name: 'home.mood',
            component: MoodPage,
            meta: { title: 'Mood Bait', tab: 'home', backTo: 'home.index' },
          },

          // 再到 诱饵池（BaitsPage）
          {
            path: 'mood/baits',
            name: 'home.mood.baits',
            component: BaitsPage,
            meta: { title: '诱饵池', tab: 'home', backTo: 'home.mood' },
          },

          /* ==================== 任务：类型 -> 抽卡 ==================== */
          {
            path: 'tasks',
            component: RouterOutlet,
            meta: { title: 'Tasks', tab: 'home', backTo: 'home.index' },
            children: [
              // 默认子路由 = 类型页，并使用你菜单里一直在用的名字 'home.tasks'
              {
                path: '/home/tasks',
                name: 'home.tasks',
                component: TaskTypePage,
                meta: { title: 'Task Types', tab: 'home', backTo: 'home.index' },
              },

              {
                path: 'card',
                name: 'home.tasks.card',
                component: () => import('@/features/task-cards/pages/TaskCardsPage.vue'),
                meta: { title: 'Task Cards', tab: 'home', backTo: 'home.tasks' },
                // 没选类型就回类型页
                beforeEnter: async () => {
                  const { useTaskCatalogStore } = await import(
                    '@/features/task-cards/stores/taskCatalog.store'
                  )
                  const catalog = useTaskCatalogStore()
                  if (!catalog.isReady) await catalog.load()
                  if (!catalog.selectedTaskType) {
                    return { name: 'home.tasks', query: { redirect: '/home/tasks/card' } }
                  }
                  return true
                },
              },
            ],
          },

          {
            path: 'breakdown',
            name: 'home.breakdown',
            component: BreakdownPage,
            meta: { title: 'Task Breakdown', tab: 'home', backTo: 'home.index' },
          },
          {
            path: 'ideas',
            name: 'home.ideas',
            component: IdeaNestPage,
            meta: { title: 'Idea Nest', tab: 'home', backTo: 'home.index' },
          },
        ],
      },

      // 兼容旧路径（可保留一段时间后移除）
      { path: 'mood', redirect: '/home/mood' },
      { path: 'tasks', redirect: '/home/tasks' },
      { path: 'breakdown', redirect: '/home/breakdown' },
      { path: 'ideas', redirect: '/home/ideas' },
      { path: 'bait', redirect: '/home/mood' },
      { path: 'baits', redirect: '/home/mood' },

      // 📖 记录
      {
        path: 'records',
        component: RouterOutlet,
        meta: { tab: 'records' },
        children: [
          { path: '', redirect: { name: 'records.sticker-wall' } },
          {
            path: 'sticker-wall',
            name: 'records.sticker-wall',
            component: StickerWallPage,
            meta: { title: '贴纸墙&奇迹日记', tab: 'records' },
          },
          {
            path: 'journal',
            component: RouterOutlet,
            redirect: { name: 'records.sticker-wall' },
            children: [
              {
                path: 'edit',
                name: 'records.journal.edit',
                component: JournalEditPage,
                meta: { title: '编辑日记', tab: 'records', backTo: '/records/sticker-wall' },
              },
              {
                path: ':id',
                name: 'records.journal.detail',
                component: JournalDetailPage,
                props: true,
                meta: { title: '日记详情', tab: 'records', backTo: '/records/sticker-wall' },
              },
            ],
          },
          {
            path: 'history',
            name: 'records.history',
            component: HistoryPage,
            meta: { title: '时间轴', tab: 'records' },
          },
          {
            path: 'analytics',
            name: 'records.analytics',
            component: AnalyticsPage,
            meta: { title: '数据分析', tab: 'records' },
          },
        ],
      },

      // 🛠️ 工具
      { path: 'tools', redirect: '/tools/pomodoro' },
      {
        path: 'tools/pomodoro',
        name: 'tools.pomodoro',
        component: PomodoroPage,
        meta: { title: '番茄钟', tab: 'tools' },
      },
      {
        path: 'tools/breathing',
        name: 'tools.breathing',
        component: BreathingPage,
        meta: { title: '呼吸练习', tab: 'tools' },
      },
      {
        path: 'tools/mindfulness',
        name: 'tools.mindfulness',
        component: MindfulnessPage,
        meta: { title: '正念练习', tab: 'tools' },
      },

      // 👥 社区
      { path: 'community', redirect: '/community/share' },
      {
        path: 'community/share',
        name: 'community.share',
        component: ShareHomePage,
        meta: { title: '分享', tab: 'community' },
      },
      {
        path: 'community/exchange',
        name: 'community.exchange',
        component: StickerExchangePage,
        meta: { title: '贴纸交换', tab: 'community' },
      },
      {
        path: 'community/social',
        name: 'community.social',
        component: SocialHomePage,
        meta: { title: '互动', tab: 'community' },
      },

      // 👤 我的
      {
        path: 'account',
        name: 'account.index',
        component: AccountHomePage,
        meta: { title: '我的', tab: 'account' },
      },
      {
        path: 'account/friends',
        name: 'account.friends',
        component: FriendsPage,
        meta: { title: '好友', tab: 'account' },
      },
      {
        path: 'account/collections',
        name: 'account.collections',
        component: CollectionsPage,
        meta: { title: '收藏', tab: 'account' },
      },

      // 诊断
      {
        path: '__ping',
        name: '__ping',
        component: { template: '<div style="padding:12px;color:#2b7">PING</div>' },
      },
    ],
  },

  // 兜底
  { path: '/:pathMatch(.*)*', redirect: '/home' },
]

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

router.beforeEach((to, from, next) => {
  console.log('[ROUTER] beforeEach:', from.fullPath, '→', to.fullPath, 'name=', to.name)
  next()
})
router.afterEach((to, from, failure) => {
  console.log('[ROUTER] afterEach:', from?.fullPath ?? '(start)', '→', to.fullPath, 'name=', to.name, 'failure=', failure)
})


export default router
