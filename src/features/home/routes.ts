import type { RouteRecordRaw } from 'vue-router'
import HomePage from './pages/HomePage.vue'

const homeRoutes: RouteRecordRaw[] = [{ // 注意这里变成了数组
  path: 'home',
  name: 'home.index',
  component: HomePage,
  meta: { title: '首页', tab: 'home' },
}]

export default homeRoutes
