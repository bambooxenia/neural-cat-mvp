// src/features/task-cards/stores/taskCatalog.store.ts
import { defineStore } from 'pinia'
import { TASK_POOL, type TaskCard, type Domain } from '@/entities/task'
import { DEFAULT_TASK_TYPES, TYPE_TO_DOMAINS, type NewTaskInput } from '@/features/task-cards/constants/task-types'
import { taskCardsRepo as repo } from '@/features/task-cards/data/task-cards.repo'
import { getJSON, setJSON } from '@/shared/utils/storage'

const LS_BASE_HIDDEN_BY_TYPE = 'NC_TASK_BASE_HIDDEN_BY_TYPE_V1'
const LS_BASE_OVERRIDES_BY_TYPE = 'NC_TASK_BASE_OVERRIDES_BY_TYPE_V1'

type State = {
  taskTypes: string[]
  selectedTaskType: string
  userTasks: TaskCard[]
  _loaded: boolean

  /** 内置任务的“按类型”定制层 */
  baseHiddenByType: Record<string, number[]> // type -> [baseId]
  baseOverridesByType: Record<
    string,
    Record<number, Partial<Pick<TaskCard, 'title' | 'minutes' | 'domain'>>>
  > // type -> { baseId: patch }
}

type UpdateTaskPatch = Partial<{
  title: string
  minutes: 5 | 10
  domain: Domain
  typeTag: string
}>

export const useTaskCatalogStore = defineStore('task-catalog', {
  state: (): State => ({
    taskTypes: [],
    selectedTaskType: '',
    userTasks: [],
    _loaded: false,

    baseHiddenByType: {},
    baseOverridesByType: {},
  }),

  getters: {
    /** 是否已加载完本地数据（避免页面首屏空读） */
    isReady: (s) => s._loaded,

    /** 全池（内置 + 用户） */
    allPool: (s): TaskCard[] => [...TASK_POOL, ...s.userTasks],

    /**
     * 依据类型构建抽卡池：
     * - 若该类型在 TYPE_TO_DOMAINS 中有映射：使用内置池(按 domain) + 应用隐藏/覆盖
     * - 若无映射：内置池为空（只用自建任务）
     */
    getTaskPoolByType:
      (s) =>
      (typeName: string): TaskCard[] => {
        const domains = TYPE_TO_DOMAINS[typeName] as Domain[] | undefined

        // 基础池（只有当存在映射且非空时才引入内置任务）
        let base: TaskCard[] = []
        if (domains && domains.length) {
          base = TASK_POOL.filter((t) => domains.includes(t.domain as Domain))

          // 应用隐藏
          const hidden = new Set(s.baseHiddenByType[typeName] || [])
          base = base.filter((t) => !hidden.has(t.id))

          // 应用覆盖
          const overrides = s.baseOverridesByType[typeName] || {}
          base = base.map((t) => (overrides[t.id] ? { ...t, ...overrides[t.id] } : t))
        }

        // 自建（要求 typeTag 命中）
        const user = s.userTasks.filter((t) => t.typeTag === typeName)

        return [...base, ...user]
      },

    /** 管理页用的合并列表（包含内置与自建，带来源标记；无映射时只有自建） */
    getManageListByType:
      (s) =>
      (typeName: string): (TaskCard & { source: 'base' | 'user' })[] => {
        const domains = TYPE_TO_DOMAINS[typeName] as Domain[] | undefined
        const hidden = new Set(s.baseHiddenByType[typeName] || [])
        const overrides = s.baseOverridesByType[typeName] || {}

        const baseRows =
          domains && domains.length
            ? TASK_POOL
                .filter((t) => domains.includes(t.domain as Domain))
                .filter((t) => !hidden.has(t.id))
                .map((t) => {
                  const merged = overrides[t.id] ? { ...t, ...overrides[t.id] } : t
                  return { ...merged, source: 'base' as const }
                })
            : []

        const userRows = s.userTasks
          .filter((t) => t.typeTag === typeName)
          .map((t) => ({ ...t, source: 'user' as const }))

        return [...baseRows, ...userRows]
      },

    /** 是否存在指定类型 */
    hasType:
      (s) =>
      (name: string): boolean =>
        s.taskTypes.includes((name || '').trim()),
  },

  actions: {
    /* ----------------------------- 持久化工具 ----------------------------- */
    async _persistTypes() {
      try {
        await repo.setTaskTypes(this.taskTypes)
      } catch {}
    },
    async _persistSelected() {
      try {
        await repo.setSelectedType(this.selectedTaskType)
      } catch {}
    },
    async _persistUserTasks() {
      try {
        await repo.setUserTasks(this.userTasks)
      } catch {}
    },

    /* ----------------------- 内置任务定制（本地持久化） ----------------------- */
    _loadBaseCustomFromLS() {
      try {
        this.baseHiddenByType = getJSON<Record<string, number[]>>(LS_BASE_HIDDEN_BY_TYPE, {})
      } catch {
        this.baseHiddenByType = {}
      }
      try {
        this.baseOverridesByType = getJSON<
          Record<string, Record<number, Partial<Pick<TaskCard, 'title' | 'minutes' | 'domain'>>>>
        >(LS_BASE_OVERRIDES_BY_TYPE, {})
      } catch {
        this.baseOverridesByType = {}
      }
    },
    _persistBaseCustomToLS() {
      try {
        setJSON(LS_BASE_HIDDEN_BY_TYPE, this.baseHiddenByType)
      } catch {}
      try {
        setJSON(LS_BASE_OVERRIDES_BY_TYPE, this.baseOverridesByType)
      } catch {}
    },

    /* ------------------------------- 初始化 ------------------------------- */
    async load() {
      const types = await repo.getTaskTypes().catch(() => [])
      this.taskTypes = types.length ? types : Array.from(DEFAULT_TASK_TYPES)
      if (!types.length) await this._persistTypes()

      const selected = await repo.getSelectedType().catch(() => '')
      this.selectedTaskType = this.taskTypes.includes(selected) ? selected : this.taskTypes[0] || ''
      if (this.selectedTaskType !== selected) await this._persistSelected()

      this.userTasks = (await repo.getUserTasks().catch(() => [])) as TaskCard[]

      // 从本地读取内置任务定制
      this._loadBaseCustomFromLS()

      this._loaded = true
      return true
    },

    /* ----------------------------- 类型选择 ----------------------------- */
    async setTaskType(name: string) {
      const n = (name || '').trim()
      this.selectedTaskType = n
      await this._persistSelected()
    },

    /* ------------------------------- 类型增删改 ------------------------------- */
    async addTaskType(name: string): Promise<{ ok: boolean; reason?: string }> {
      const n = (name || '').trim()
      if (!n) return { ok: false, reason: 'empty' }
      if (n.length > 16) return { ok: false, reason: 'too_long' }
      if (this.taskTypes.includes(n)) return { ok: false, reason: 'duplicated' }

      this.taskTypes = [n, ...this.taskTypes]
      await this._persistTypes()
      return { ok: true }
    },

    async renameTaskType(oldName: string, newName: string): Promise<{ ok: boolean; reason?: string }> {
      const o = (oldName || '').trim()
      const n = (newName || '').trim()
      if (!o || !n) return { ok: false, reason: 'invalid' }
      if (n.length > 16) return { ok: false, reason: 'too_long' }
      if (o === n) return { ok: true }
      if (!this.taskTypes.includes(o)) return { ok: false, reason: 'invalid' }
      if (this.taskTypes.includes(n)) return { ok: false, reason: 'duplicated' }

      // 替换列表并持久化
      this.taskTypes = this.taskTypes.map((t) => (t === o ? n : t))
      await this._persistTypes()

      // 迁移自建任务的 typeTag
      let changed = false
      this.userTasks = this.userTasks.map((t) => {
        if (t.typeTag === o) {
          changed = true
          return { ...t, typeTag: n }
        }
        return t
      })
      if (changed) await this._persistUserTasks()

      // 修正当前选中
      if (this.selectedTaskType === o) {
        this.selectedTaskType = n
        await this._persistSelected()
      }

      // 迁移定制层并持久化
      if (this.baseHiddenByType[o]) {
        this.baseHiddenByType[n] = this.baseHiddenByType[o]
        delete this.baseHiddenByType[o]
      }
      if (this.baseOverridesByType[o]) {
        this.baseOverridesByType[n] = this.baseOverridesByType[o]
        delete this.baseOverridesByType[o]
      }
      this._persistBaseCustomToLS()

      return { ok: true }
    },

    async removeTaskType(name: string) {
      if (this.taskTypes.length <= 1) return

      const before = this.taskTypes.length
      this.taskTypes = this.taskTypes.filter((t) => t !== name)
      if (this.taskTypes.length !== before) {
        await this._persistTypes()
      }

      if (this.selectedTaskType === name) {
        this.selectedTaskType = ''
        await this._persistSelected()
      }

      const beforeU = this.userTasks.length
      this.userTasks = this.userTasks.filter((t) => t.typeTag !== name)
      if (this.userTasks.length !== beforeU) {
        await this._persistUserTasks()
      }

      if (this.baseHiddenByType[name]) delete this.baseHiddenByType[name]
      if (this.baseOverridesByType[name]) delete this.baseOverridesByType[name]
      this._persistBaseCustomToLS()
    },

    /* ------------------------------- 任务增删改（自建） ------------------------------- */
    /** 新增用户自建任务
     *  映射存在 → 校验 domain 属于映射
     *  映射不存在/为空 → 放行（允许任意 Domain）
     */
    async addUserTask(input: NewTaskInput): Promise<{ ok: boolean; reason?: string }> {
      const title = (input.title || '').trim()
      if (!title) return { ok: false, reason: 'empty_title' }
      if (title.length > 60) return { ok: false, reason: 'title_too_long' }
      if (input.minutes !== 5 && input.minutes !== 10) return { ok: false, reason: 'invalid_minutes' }
      if (!this.taskTypes.includes(input.typeTag)) return { ok: false, reason: 'unknown_type' }

      const domains = TYPE_TO_DOMAINS[input.typeTag] as Domain[] | undefined
      if (domains && domains.length && !domains.includes(input.domain as Domain)) {
        return { ok: false, reason: 'invalid_domain_for_type' }
      }

      const id = typeof repo.makeId === 'function' ? repo.makeId() : Date.now()
      const task: TaskCard = {
        id,
        title,
        minutes: input.minutes,
        domain: input.domain as Domain,
        typeTag: input.typeTag,
      }

      this.userTasks = [task, ...this.userTasks]
      await this._persistUserTasks()
      return { ok: true }
    },

    /** 更新用户自建任务（与上面同样：映射存在才校验） */
    async updateUserTask(id: number, patch: UpdateTaskPatch): Promise<{ ok: boolean; reason?: string }> {
      const idx = this.userTasks.findIndex((t) => t.id === id)
      if (idx === -1) return { ok: false, reason: 'not_found' }

      const current = this.userTasks[idx]
      const next: TaskCard = { ...current }

      if (patch.title !== undefined) {
        const title = String(patch.title || '').trim()
        if (!title) return { ok: false, reason: 'empty_title' }
        if (title.length > 60) return { ok: false, reason: 'title_too_long' }
        next.title = title
      }

      if (patch.minutes !== undefined) {
        const m = patch.minutes
        if (m !== 5 && m !== 10) return { ok: false, reason: 'invalid_minutes' }
        next.minutes = m
      }

      if (patch.typeTag !== undefined) {
        const t = String(patch.typeTag || '').trim()
        if (!this.taskTypes.includes(t)) return { ok: false, reason: 'unknown_type' }
        next.typeTag = t

        const domains = TYPE_TO_DOMAINS[t] as Domain[] | undefined
        const newDomain = (patch.domain ?? next.domain) as Domain
        if (domains && domains.length && !domains.includes(newDomain)) {
          return { ok: false, reason: 'invalid_domain_for_type' }
        }
        next.domain = newDomain
      } else if (patch.domain !== undefined) {
        const curType = next.typeTag
        if (!curType || !this.taskTypes.includes(curType)) return { ok: false, reason: 'unknown_type' }
        const domains = TYPE_TO_DOMAINS[curType] as Domain[] | undefined
        if (domains && domains.length && !domains.includes(patch.domain as Domain)) {
          return { ok: false, reason: 'invalid_domain_for_type' }
        }
        next.domain = patch.domain as Domain
      }

      this.userTasks.splice(idx, 1, next)
      await this._persistUserTasks()
      return { ok: true }
    },

    async removeUserTask(id: number) {
      const before = this.userTasks.length
      this.userTasks = this.userTasks.filter((t) => t.id !== id)
      if (this.userTasks.length !== before) {
        await this._persistUserTasks()
      }
    },

    /* ------------------------------- 内置任务定制（按类型） ------------------------------- */
    async hideBaseTaskForType(typeName: string, baseId: number) {
      const list = this.baseHiddenByType[typeName] || []
      if (!list.includes(baseId)) {
        this.baseHiddenByType[typeName] = [baseId, ...list]
        this._persistBaseCustomToLS()
      }
    },

    async unhideBaseTaskForType(typeName: string, baseId: number) {
      const list = this.baseHiddenByType[typeName] || []
      this.baseHiddenByType[typeName] = list.filter((id) => id !== baseId)
      this._persistBaseCustomToLS()
    },

    async updateBaseTaskForType(
      typeName: string,
      baseId: number,
      patch: Partial<Pick<TaskCard, 'title' | 'minutes' | 'domain'>>
    ): Promise<{ ok: boolean; reason?: string }> {
      const domains = TYPE_TO_DOMAINS[typeName] as Domain[] | undefined
      if (patch.minutes !== undefined) {
        const m = patch.minutes
        if (m !== 5 && m !== 10) return { ok: false, reason: 'invalid_minutes' }
      }
      if (patch.title !== undefined) {
        const t = String(patch.title || '').trim()
        if (!t) return { ok: false, reason: 'empty_title' }
        if (t.length > 60) return { ok: false, reason: 'title_too_long' }
      }
      if (patch.domain !== undefined && domains && domains.length) {
        if (!domains.includes(patch.domain as Domain)) {
          return { ok: false, reason: 'invalid_domain_for_type' }
        }
      }

      const bucket = (this.baseOverridesByType[typeName] ||= {})
      const prev = bucket[baseId] || {}
      bucket[baseId] = { ...prev, ...patch }
      this._persistBaseCustomToLS()
      return { ok: true }
    },

    async resetBaseOverrideForType(typeName: string, baseId: number) {
      const bucket = this.baseOverridesByType[typeName]
      if (bucket && bucket[baseId]) {
        delete bucket[baseId]
        this._persistBaseCustomToLS()
      }
    },
  },
})
