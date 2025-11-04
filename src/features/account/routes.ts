import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/account',
    name: 'account.index',
    component: () => import('./pages/AccountHomePage.vue'),
    meta: { title: 'Account' },
  },
  {
    path: '/account/friends',
    name: 'account.friends',
    component: () => import('./friends/pages/FriendsPage.vue'),
    meta: { title: 'Friends' },
  },
  {
    path: '/account/collections',
    name: 'account.collections',
    component: () => import('./collections/pages/CollectionsPage.vue'),
    meta: { title: 'Collections' },
  },
]

export default routes
