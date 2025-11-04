import type { Domain } from '@/entities/task'

/** 任务卡的“类型”默认集合（UI 可增删） */
export const DEFAULT_TASK_TYPES: string[] = [
  '学习外语',
  '整理环境',
  '日记写作',
  '轻运动',
]

/**
 * 类型 → 领域 的映射。
 * 用于从内置 TASK_POOL 中筛选出属于该类型的基础任务。
 * 你可以按实际类型名继续扩展或拆分。
 */
export const TYPE_TO_DOMAINS: Record<string, Domain[]> = {
  '学习外语': ['study'],
  '整理环境': ['clean'],
  '日记写作': ['write'],
  '轻运动': ['move'],
}

export type NewTaskInput = {
  title: string
  minutes: 5 | 10
  domain: Domain
  typeTag: string
}
