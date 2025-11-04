// 奖励触发策略：按“事件名（来自 analytics）”可独立配置
// 你现在的 EventName 见 src/app/analytics/index.ts
export type StickerRule =
  | 'never'
  | 'always'
  | 'firstOfDay'
  | { chance: number }       // 0~1

export type ConfettiRule = 'off' | 'on' | 'big'

export type TokensRule = {
  delta: number              // 完成后直接加多少（0 表示不加）
  on?: 'completed' | 'accepted'  // 何时结算（留口，当前未强制实现）
}

export type LimitRule = {
  perDay?: number            // 每日上限
  cooldownMs?: number        // 触发后冷却
}

export type RewardPolicy = {
  confetti: ConfettiRule
  sticker: StickerRule
  tokens?: TokensRule
  limit?: LimitRule
  // 可选：不同事件用不同文案/表情池
  captionPool?: readonly string[]
  kaomojiPool?: readonly string[]
}

// 默认策略：可按需扩展/覆盖
export const REWARD_POLICY: Record<string, RewardPolicy> = {
  // 诱饵完成：默认“每日首贴”，无需彩带
  BAIT_COMPLETED: {
    confetti: 'off',
    sticker: 'firstOfDay',
    tokens: { delta: 0 },
    limit: { perDay: 6, cooldownMs: 6_000 },
  },

  // 任务完成：默认每次奖励 + 彩带
  TASK_COMPLETED: {
    confetti: 'on',
    sticker: 'always',
    tokens: { delta: 0 }, // 若接代币，可调成 1
    limit: { perDay: 99 },
  },
}
