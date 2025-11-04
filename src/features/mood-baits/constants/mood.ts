// src/features/mood-baits/constants/mood.ts
import type { MoodKey } from '@/entities/mood'

export type MoodMeta = {
  label: string
  icon: string
  sub: string
}

/** 与 UIMood 完全一一对应的元数据常量 */
export const MOOD_META: Record<MoodKey, MoodMeta> = {
  'low-energy': {
    label: '精力见底',
    icon: '🔋5%',
    sub: '像手机只剩 5% 电量，动一下都吃力。',
  },
  anxious: {
    label: '焦虑糊成一团',
    icon: '😵‍💫',
    sub: '脑子在打转，总担心“要完了”。',
  },
  overwhelmed: {
    label: '被事情压住',
    icon: '🧱',
    sub: '信息太多，不知道第一步从哪儿开始。',
  },
  distracted: {
    label: '注意力到处飞',
    icon: '🪁',
    sub: '开了十个标签页，一个都没做完。',
  },
  'low-mood': {
    label: '心情低落',
    icon: '🌧️',
    sub: '提不起兴趣，做什么都没意思。',
  },
  good: {
    label: '不错，想挑战',
    icon: '🚀',
    sub: '有点劲儿，想推进点像样的东西。',
  },
}
