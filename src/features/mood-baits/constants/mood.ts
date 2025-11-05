// src/features/mood-baits/constants/mood.ts
import type { UIMood as MoodKey } from '@/entities/mood'

export type MoodMeta = {
  label: string
  icon: string
  sub: string
}

/** 与 UIMood 完全一一对应的元数据常量 */
export const MOOD_META: Record<MoodKey, MoodMeta> = {
  'low-energy': {
    label: 'Energy depleted',
    icon: '🔋5%',
    sub: 'Like a phone stuck at 5% battery; every move feels heavy.',
  },
  anxious: {
    label: 'Anxious and frazzled',
    icon: '😵‍💫',
    sub: 'Mind spinning, constantly worried the worst is coming.',
  },
  overwhelmed: {
    label: 'Buried by tasks',
    icon: '🧱',
    sub: 'Too much input, no idea where to take the first step.',
  },
  distracted: {
    label: 'Attention scattered',
    icon: '🪁',
    sub: 'Ten tabs open and not a single one finished.',
  },
  'low-mood': {
    label: 'Feeling low',
    icon: '🌧️',
    sub: 'No spark of interest; everything feels pointless.',
  },
  good: {
    label: 'Ready for a challenge',
    icon: '🚀',
    sub: 'Got some momentum and want to push something meaningful forward.',
  },
}
