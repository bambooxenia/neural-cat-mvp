import type { UIMood as MoodKey } from '@/entities/mood'

export type HomeStateMeta = {
  /** 猫咪人格化台词（首页顶部展示） */
  line: string
  /** 推荐行动卡的文案 */
  action: string
  /** 推荐功能入口（对应 HomePage 里的 R.breakdown / R.mood / R.tasks / R.journal） */
  recEntry: 'breakdown' | 'mood' | 'tasks' | 'journal'
  /** S2 推荐行动用的图标（根据“内容”选，避免与 S3/S4 重复） */
  icon: string
}

/** 与 6 种默认情绪一一对应的首页状态池 */
export const HOME_STATE_META: Record<MoodKey, HomeStateMeta> = {
  'low-energy': {
    line: '🐱 "I have only 5% battery left... even rolling over feels exhausting, meow."',
    action: 'Offer a small fish snack first to wake up a bit of focus.',
    recEntry: 'mood',
    icon: '🐟',
  },
  anxious: {
    line: '😿 "The yarn ball is in knots and I have started chewing the cables..."',
    action: 'Untangle the yarn starting with the tiniest step.',
    recEntry: 'breakdown',
    icon: '🧶',
  },
  overwhelmed: {
    line: '🙀 "A pile of boxes is pressing me down; I cannot move..."',
    action: 'Open the smallest box first to get going.',
    recEntry: 'breakdown',
    icon: '📦',
  },
  distracted: {
    line: '😼 "I just chased a butterfly, stared at the fish snack, and still want to claw the yarn..."',
    action: 'Draw a random mini card to lock onto one task first.',
    recEntry: 'tasks',
    icon: '🎯',
  },
  'low-mood': {
    line: '🥶 "I feel like an unthawed fish; nothing sounds appealing..."',
    action: 'Do not rush—curl up by the fireplace with a fish snack and warm up slowly.',
    recEntry: 'mood',
    icon: '🔥',
  },
  good: {
    line: '🐈 "Catnip boost! Charge ahead, meow~"',
    action: "Break down a task, make a big push, then record today's highlights.",
    recEntry: 'breakdown', 
    icon: '🚀',
  },
}
