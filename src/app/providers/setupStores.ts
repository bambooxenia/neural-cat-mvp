// src/app/providers/setupStores.ts
import { useRewardStore } from '@/features/reward/stores/rewardCenter.store'
import { logRewardAccepted } from '@/app/analytics'

let _registered = false
let _unsubscribers: Array<() => void> = []

/**
 * 在应用启动（Pinia 安装后）调用一次即可。
 * 作用：把领域事件（如 reward.accept）转成 analytics 事件。
 */
export function setupStoresSubscriptions() {
  if (_registered) return
  _registered = true

  const reward = useRewardStore()

  // 订阅 reward.accept → 记一次“确认领取奖励”的事件
  const offReward = reward.$onAction(({ name, after, onError }) => {
    if (name !== 'accept') return

    after((ret: any) => {
      // ret 是 reward.accept() 的返回值，按你的实现可能含有 id/type/rarity/payload
      // 这里只做事件采集；聚合/报表放在 metrics 模块
      try {
        logRewardAccepted({
          id: ret?.id,
          type: ret?.type, // 例如 'xp' | 'sticker' | 'badge'
          rarity: ret?.rarity, // 例如 'common' | 'rare' | 'epic'
          amount: ret?.payload?.amount ?? 1,
        })
      } catch {
        /* 避免打断主流程 */
      }
    })

    onError(() => {
      // 可选：这里上报一个错误事件或进行告警
      // logEvent('REWARD_ACCEPT_ERROR', {})
    })
  })

  _unsubscribers.push(offReward)

  // --- HMR：热更时自动解绑并允许重新注册 ---
  if (import.meta?.hot) {
    import.meta.hot.dispose(() => {
      _unsubscribers.forEach((off) => {
        try {
          off()
        } catch {}
      })
      _unsubscribers = []
      _registered = false
    })
  }
}
