// src/shared/types/mood.ts
export const UI_MOOD_KEYS = [
  'low-energy',   // 精力见底
  'anxious',      // 焦虑糊成一团
  'overwhelmed',  // 被事情压住
  'distracted',   // 注意力到处飞
  'low-mood',     // 心情低落
  'good',         // 不错，想挑战
] as const

export type UIMood = typeof UI_MOOD_KEYS[number]
