// src/shared/types/mood.ts
export const UI_MOOD_KEYS = [
  'low-energy',
  'anxious',
  'overwhelmed',
  'distracted',
  'low-mood',
  'good',         
] as const

export type UIMood = typeof UI_MOOD_KEYS[number]
