import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/community/share',
    name: 'community.share',
    component: () => import('./share/pages/ShareHomePage.vue'),
    meta: { title: 'Share' },
  },
  {
    path: '/community/exchange',
    name: 'community.exchange',
    component: () => import('./exchange/pages/StickerExchangePage.vue'),
    meta: { title: 'Sticker Exchange' },
  },
  {
    path: '/community/social',
    name: 'community.social',
    component: () => import('./social/pages/SocialHomePage.vue'),
    meta: { title: 'Social' },
  },
]

export default routes
