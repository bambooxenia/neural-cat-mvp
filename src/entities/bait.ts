// src/entities/bait.ts
import type { MoodKey } from '@/entities/mood'
import { M } from 'vitest/dist/chunks/environment.LoooBwUu.js'

export type BaitKind = 'sensory' | 'action' | 'environment'
export type BaitCard = {
  id: string
  title: string
  minutes: 5 | 10
  kind: BaitKind
  mood: MoodKey[] // 这张诱饵卡适配哪些心情（此处都是单个心情）
}

// 每种 mood 5 条；minutes 都是 5 或 10；kind 方便你做 UI 筛选
const byMood: Record<MoodKey, Omit<BaitCard, 'mood'>[]> = {
  'low-energy': [
    { id: 'le-1', title: '喝一杯水＋颈肩伸展', minutes: 5, kind: 'action' },
    { id: 'le-2', title: '洗脸/梳头，开窗换气', minutes: 5, kind: 'environment' },
    { id: 'le-3', title: '站到窗边晒光＋缓慢呼吸', minutes: 5, kind: 'sensory' },
    { id: 'le-4', title: '只清理桌面一小块“A5 区域”', minutes: 5, kind: 'action' },
    { id: 'le-5', title: '跟着音乐轻走动＋摆臂', minutes: 10, kind: 'action' },
  ],
  anxious: [
    { id: 'an-1', title: '4-7-8 呼吸法 3 轮', minutes: 5, kind: 'sensory' },
    { id: 'an-2', title: '写下最担心的3件事＋各1个下一步', minutes: 10, kind: 'action' },
    { id: 'an-3', title: '5-4-3-2-1 感官锚定', minutes: 5, kind: 'sensory' },
    { id: 'an-4', title: '设 10 分钟计时器，只做一件小事', minutes: 10, kind: 'action' },
    { id: 'an-5', title: '把杂念写进“收件箱”，不做判断', minutes: 5, kind: 'action' },
  ],
  overwhelmed: [
    { id: 'ov-1', title: '把当前任务拆成 3 小步，圈出第一步', minutes: 5, kind: 'action' },
    { id: 'ov-2', title: '只保留 1 个标签/文档，其余最小化', minutes: 5, kind: 'environment' },
    { id: 'ov-3', title: '整理工作区 1 个“手掌区”', minutes: 5, kind: 'environment' },
    { id: 'ov-4', title: '10 分钟“启动计时器”，只做第一步', minutes: 10, kind: 'action' },
    { id: 'ov-5', title: '把非今日事项移到“停车场清单”', minutes: 5, kind: 'action' },
  ],
  distracted: [
    { id: 'di-1', title: '开启勿扰 10 分钟＋手机离身', minutes: 10, kind: 'environment' },
    { id: 'di-2', title: '关闭无关应用/标签，仅保留一个', minutes: 5, kind: 'environment' },
    { id: 'di-3', title: '写下 3 行下一步，并做第 1 行', minutes: 5, kind: 'action' },
    { id: 'di-4', title: '60 秒桌面清理＋4 分钟单任务冲刺', minutes: 5, kind: 'action' },
    { id: 'di-5', title: '戴耳机播白噪/Lo-fi 专注 10 分钟', minutes: 10, kind: 'sensory' },
  ],
  'low-mood': [
    { id: 'lm-1', title: '泡一杯热饮，窗边坐一会儿', minutes: 5, kind: 'sensory' },
    { id: 'lm-2', title: '给自己写 3 句温柔的话', minutes: 5, kind: 'action' },
    { id: 'lm-3', title: '放一首喜欢的歌，边听边收拾桌面', minutes: 5, kind: 'action' },
    { id: 'lm-4', title: '出门走一小圈，回来即止', minutes: 10, kind: 'action' },
    { id: 'lm-5', title: '拉开窗帘/开灯，整理床铺', minutes: 5, kind: 'environment' },
  ],
  good: [
    { id: 'gd-1', title: '主任务推进 10 分钟', minutes: 10, kind: 'action' },
    { id: 'gd-2', title: '为当前工作写一个小提纲', minutes: 5, kind: 'action' },
    { id: 'gd-3', title: '工作区深度清理 10 分钟', minutes: 10, kind: 'environment' },
    { id: 'gd-4', title: '完成一封“一直拖着”的邮件/决策', minutes: 5, kind: 'action' },
    { id: 'gd-5', title: '复盘昨天＋制定今日三要事', minutes: 10, kind: 'action' },
  ],
}

// 导出“扁平池”：BAIT_POOL + 类型 BaitCard
export const BAIT_POOL: BaitCard[] = Object.entries(byMood).flatMap(([mood, arr]) =>
  (arr as Omit<BaitCard, 'mood'>[]).map((x) => ({ ...x, mood: [mood as MoodKey] }))
)

// 按 mood 拿子池的帮助函数（可选）
export const getBaitPool = (mood: MoodKey): BaitCard[] =>
  (byMood[mood] || []).map((x) => ({ ...x, mood: [mood] }))

// “按 mood 索引”的版本（可选）
export const BAIT_BY_MOOD: Record<MoodKey, BaitCard[]> = Object.fromEntries(
  Object.entries(byMood).map(([m, arr]) => [m, arr.map((x) => ({ ...x, mood: [m as MoodKey] }))])
) as Record<MoodKey, BaitCard[]>
