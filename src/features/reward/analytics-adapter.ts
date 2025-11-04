// src/features/reward/analytics-adapter.ts
import {
  registerAdapter,
  unregisterAdapter,
  type AnalyticsEvent,
} from '@/app/analytics'

const ADAPTER_ID = 'reward-center-adapter'

// HMR 下先移除旧适配器，防止保留旧逻辑
if (import.meta.hot) {
  try { unregisterAdapter(ADAPTER_ID) } catch {}
}

/**
 * 这个适配器现在仅用于“监听并可做分析用途”，
 * 不再直接触达 UI（不要再弹奖励）。
 * 奖励 UI 统一由 RewardCenter.vue 订阅领域事件（如 `reward.bait.completed`）后入队处理。
 */
registerAdapter({
  id: ADAPTER_ID,
  track(evt: AnalyticsEvent) {
    try {
      // 按需做分析/调试；不要触 UI。
      // 例如：可以在这里做内部计数、debug 标记等（可留空）。
      // if (import.meta.env?.DEV && evt.name === 'BAIT_COMPLETED') {
      //   console.debug('[analytics-adapter] bait completed observed', evt);
      // }
      return
    } catch {
      // 静默，避免影响主流程
    }
  },
})

// HMR：当前模块被替换时卸载本适配器，下一版会在新模块执行时重新注册
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    try { unregisterAdapter(ADAPTER_ID) } catch {}
  })
}
