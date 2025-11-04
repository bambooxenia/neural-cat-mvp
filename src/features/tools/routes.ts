import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/tools/breathing',
    name: 'tools.breathing',
    component: () => import('./breathing/pages/BreathingPage.vue'),
    meta: { title: 'Breathing' },
  },
  {
    path: '/tools/pomodoro',
    name: 'tools.pomodoro',
    component: () => import('./pomodoro/pages/PomodoroPage.vue'),
    meta: { title: 'Pomodoro' },
  },
  {
    path: '/tools/mindfulness',
    name: 'tools.mindfulness',
    component: () => import('./mindfulness/pages/MindfulnessPage.vue'),
    meta: { title: 'Mindfulness' },
  },
]

export default routes
