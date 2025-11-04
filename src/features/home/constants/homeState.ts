import type { MoodKey } from '@/entities/mood'

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
    line: '🐱「我只有 5% 电了…翻个身都累喵」',
    action: '先投一条小鱼干，唤醒一点点注意力',
    recEntry: 'mood',
    icon: '🐟',
  },
  anxious: {
    line: '😿「毛线团打结了，我已经开始咬电线了…」',
    action: '从最小的一步解开毛线团',
    recEntry: 'breakdown',
    icon: '🧶',
  },
  overwhelmed: {
    line: '🙀「一堆箱子压着我，动不了啦…」',
    action: '先拆出一个最小的箱子开始',
    recEntry: 'breakdown',
    icon: '📦',
  },
  distracted: {
    line: '😼「我刚追蝴蝶，又盯小鱼干，还想挠毛线…」',
    action: '先随缘抽一张小卡片，锁定一件事',
    recEntry: 'tasks',
    icon: '🎯',
  },
  'low-mood': {
    line: '🥶「像没解冻的鱼，我啥都不想干…」',
    action: '不急，窝在壁炉旁吃小鱼干，慢慢暖起来',
    recEntry: 'mood',
    icon: '🔥',
  },
  good: {
    line: '🐈「像打了猫薄荷，冲啊喵～」',
    action: '拆个任务、推进一大步，再去记录今天的闪光',
    recEntry: 'breakdown', // 或者拆分后再跳 Journal
    icon: '🚀',
  },
}
