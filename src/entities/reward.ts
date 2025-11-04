// src/entities/reward.ts
export type RewardKind = 'sticker' // 以后扩展：| 'xp' | 'badge' ...
export interface Reward<T extends RewardKind = RewardKind, P = any> {
  id: string
  type: T
  payload: P
}
export type StickerReward = Reward<'sticker', { kaomoji: string }>
