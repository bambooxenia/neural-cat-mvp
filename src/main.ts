// src/main.ts
import { createApp } from 'vue'
import App from './App.vue'

// 路由
import router from '@/app/router'
// UI 组件库
import ElementPlus from 'element-plus'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import 'element-plus/dist/index.css'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import { createPinia } from 'pinia'

// （可选样式）
import '@/app/styles/globals.css'
import '@/features/reward/analytics-adapter'
import '@/features/reward/orchestrator'
import '@/shared/styles/dialogs.css'

const app = createApp(App)

// 先装插件，再挂载
app.use(createPinia())
app.use(router)
app.use(ElementPlus, { locale: zhCn })
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.mount('#app')
