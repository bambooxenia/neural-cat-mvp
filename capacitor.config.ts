// capacitor.config.ts
import type { CapacitorConfig } from '@capacitor/cli'

const isDev = process.env.NODE_ENV !== 'production'

// 开发期想用 Live Reload，可给 server 赋值；打包时留空即可
const server = isDev
  ? {
      url: 'http://localhost:5173', // 例：192.168.1.8:5173
      cleartext: true,                   // 允许 http
    }
  : undefined

const config: CapacitorConfig = {
  appId: 'com.neuroncat.app',
  appName: '神经猫咪',
  webDir: 'dist',
  plugins: {
    // 可选：启动白屏时间为 0
    SplashScreen: { launchShowDuration: 0 },
  },
}

export default config
