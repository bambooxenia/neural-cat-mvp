// src/features/task-cards/data/task-cards.repo.ts
import { TASK_POOL, type TaskCard } from '@/entities/task'
import type { Domain } from '@/entities/task'
import { getJSON, setJSON, getLS, setLS } from '@/shared/utils/storage'
import { DEFAULT_TASK_TYPES, TYPE_TO_DOMAINS } from '@/features/task-cards/constants/task-types'

const LS_TASK_TYPES = 'NC_TASK_TYPES_V1'
const LS_SELECTED   = 'NC_TASK_SELECTED_V1'
const LS_USER_TASKS = 'NC_TASK_USER_TASKS_V1'

function safe<T>(fn: () => T, fallback: T): T {
  try { return fn() } catch { return fallback }
}

export const taskCardsRepo = {
  // —— 任务类型 —— //
  async getTaskTypes(): Promise<string[]> {
    return safe(() => getJSON<string[]>(LS_TASK_TYPES, []), [])
  },
  async setTaskTypes(list: string[]): Promise<void> {
    setJSON(LS_TASK_TYPES, Array.from(new Set(list)))
  },
  async getSelectedType(): Promise<string> {
    return safe(() => getLS(LS_SELECTED, ''), '')
  },
  async setSelectedType(name: string): Promise<void> {
    setLS(LS_SELECTED, name)
  },

  // —— 用户任务 —— //
  async getUserTasks(): Promise<TaskCard[]> {
    const arr = safe(() => getJSON<TaskCard[]>(LS_USER_TASKS, []), [])
    // 最小清洗
    return arr.filter(x => x && typeof x.id === 'number' && typeof x.title === 'string')
  },
  async setUserTasks(list: TaskCard[]): Promise<void> {
    setJSON(LS_USER_TASKS, list)
  },

  // —— 合并池 —— //
  async getMergedPoolByType(typeName: string): Promise<TaskCard[]> {
    const domains = TYPE_TO_DOMAINS[typeName] ?? []
    const base = domains.length
      ? TASK_POOL.filter(t => (domains as Domain[]).includes(t.domain as Domain))
      : []
    const user = (await this.getUserTasks()).filter(t => t.typeTag === typeName)
    return [...base, ...user]
  },
  async getAllPool(): Promise<TaskCard[]> {
    const user = await this.getUserTasks()
    return [...TASK_POOL, ...user]
  },

  // —— ID 生成 —— //
  makeId(): number {
    return Date.now()
  },
}
