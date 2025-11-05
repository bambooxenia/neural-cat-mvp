import type { Domain } from '@/entities/task'

/** 任务卡的“类型”默认集合（UI 可增删） */
export const DEFAULT_TASK_TYPES: string[] = [
  'Foreign Language Study',
  'Environment Tidy-Up',
  'Journal Writing',
  'Light Exercise',
]

/**
 * 类型 → 领域 的映射。
 * 用于从内置 TASK_POOL 中筛选出属于该类型的基础任务。
 * 你可以按实际类型名继续扩展或拆分。
 */
export const TYPE_TO_DOMAINS: Record<string, Domain[]> = {
  'Foreign Language Study': ['study'],
  'Environment Tidy-Up': ['clean'],
  'Journal Writing': ['write'],
  'Light Exercise': ['move'],
}

export type NewTaskInput = {
  title: string
  minutes: 5 | 10
  domain: Domain
  typeTag: string
}
