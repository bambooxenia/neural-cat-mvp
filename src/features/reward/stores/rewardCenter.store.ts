// src/features/reward/stores/rewardCenter.ts
import { defineStore } from 'pinia'
import type { StickerReward } from '@/entities/reward'
import { KAOMOJI_POOL, CAPTION_POOL } from '@/features/reward/constants/reward.sticker.meta'

type ConfettiPiece = { id: number; left: number; delay: number; duration: number; color: string }

const pick = <T,>(arr: readonly T[]) => arr[Math.floor(Math.random() * arr.length)]

/** 更稳的 uid：优先 randomUUID，退化到时间戳+随机 */
const uid = () => {
  try {
    if (globalThis.crypto && 'randomUUID' in globalThis.crypto) {
      return globalThis.crypto.randomUUID()
    }
  } catch {}
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

type State = {
  /** 弹窗可见性（展示层） */
  visible: boolean
  /** 展示用：当前贴纸的颜文字（由 _present 统一设置） */
  kaomoji: string
  /** 展示用：当前贴纸的文案（由 _present 统一设置） */
  caption: string
  /** 纸屑开关与数据（由 fireConfetti 控制） */
  confettiOn: boolean
  confetti: ConfettiPiece[]
  /** 当前正在展示的奖励项（语义对象） */
  current: StickerReward | null
  /** 待播奖励队列（先进先出） */
  queue: StickerReward[]
}

export const useRewardStore = defineStore('reward', {
  state: (): State => ({
    visible: false,
    kaomoji: KAOMOJI_POOL[0] as string,
    caption: CAPTION_POOL[0] as string,
    confettiOn: false,
    confetti: [],
    current: null,
    queue: [],
  }),

  actions: {
    /**
     * 入队一个“贴纸奖励”；若当前未展示则立即展示。
     * 统一由本方法负责：
     *  - 随机 KAOMOJI_POOL / CAPTION_POOL
     *  - 触发纸屑
     *  - 管理队列与 current/visible
     */
    enqueueSticker(kaomoji?: string, caption?: string) {
      const reward: StickerReward = {
        id: uid(),
        type: 'sticker',
        payload: {
          // 仅把“展示内容”的最小必要信息放在 payload；caption 由 _present 统一决定
          kaomoji: (kaomoji ?? (pick(KAOMOJI_POOL) as string)),
        },
      }

      if (this.visible || this.current) {
        this.queue.push(reward)
      } else {
        this._present(reward, caption)
      }
    },

    /** 兼容旧 API：立即展示贴纸（内部走 enqueue），DEV 环境下给出降噪提示 */
    showSticker(kaomoji?: string, caption?: string) {
      if (import.meta.env?.DEV) {
        // eslint-disable-next-line no-console
        console.warn(
          '[reward] showSticker() 已废弃，请改为事件→RewardCenter 订阅→enqueueSticker() 的统一路径。'
        )
      }
      this.enqueueSticker(kaomoji, caption)
    },

    /** 关闭当前奖励；若队列尚有待播项则继续展示下一条 */
    hide() {
      this.visible = false
      this.confettiOn = false
      this.current = null

      const next = this.queue.shift()
      if (next) this._present(next)
    },

    /**
     * 用户确认接收 → 返回当前奖励对象（由调用方决定如何落库/发币/加徽章）
     * 注意：本函数会推进队列到下一条
     */
    accept() {
      const r = this.current
      this.hide()
      return r
    },

    /**
     * 用户暂不接收（但同样关闭当前并推进队列）
     */
    dismiss() {
      const r = this.current
      this.hide()
      return r
    },

    /* ------------------------- 内部：展示与纸屑 ------------------------- */
    _present(reward: StickerReward, caption?: string) {
      this.current = reward
      this.kaomoji = reward.payload.kaomoji
      // 文案始终在展示时统一决定（若外部未传，则随机池子）
      this.caption = (caption ?? (pick(CAPTION_POOL) as string))
      this.visible = true
      this.fireConfetti()
    },

    fireConfetti() {
      // 颜色集合可按主题替换；这里给一个和谐的默认组
      const colors = ['#ff7aa2', '#ffd37e', '#8dd3ff', '#bde8c9', '#c7b9ff']
      const pieces = 48 // 适中数量，避免卡顿
      const arr: ConfettiPiece[] = []
      for (let i = 0; i < pieces; i++) {
        arr.push({
          id: i,
          left: Math.random() * 100,
          delay: Math.random() * 220,
          duration: 1500 + Math.random() * 900,
          color: colors[i % colors.length],
        })
      }
      this.confetti = arr
      this.confettiOn = true
      // 关门定时器（略大于最长 duration）
      setTimeout(() => (this.confettiOn = false), 2800)
    },
  },
})
