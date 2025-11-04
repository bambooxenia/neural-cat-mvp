// src/features/home/mood-baits/stores/moodCatalog.store.ts

import { defineStore } from 'pinia'
import { UI_MOOD_KEYS, type UIMood } from '@/entities/mood'
import { MOOD_META, type MoodMeta } from '@/features/mood-baits/constants/mood'
import { buildMoodCards, ensureMoodInList } from '@/features/mood-baits/services/mood.service'
import type { MoodCardView } from '@/features/mood-baits/services/mood.service'
import * as repo from '@/features/mood-baits/data/mood.repo'
import {
  loadMoodCatalog,
  saveMoodCatalog,
  type MoodCatalogDTO,
} from '@/features/mood-baits/services/mood.service'

/** 压平别名链，避免 A→B→C 的长链与环 */
function resolveAlias(key: string, aliasMap: Record<string, string>): string {
  let cur = String(key || '')
  const seen = new Set<string>()
  while (aliasMap[cur] && !seen.has(cur)) {
    seen.add(cur)
    cur = aliasMap[cur]
  }
  return cur
}

/** 对 aliasMap 做路径压缩：把所有指向 old 的项直接指到最终 new */
function compressAliasMap(map: Record<string, string>) {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(map)) {
    const target = resolveAlias(v, map)
    if (k !== target) out[k] = target
  }
  return out
}

export const useMoodCatalogStore = defineStore('mood-catalog', {
  state: () => ({
    /** UI 可见的心情键（顺序即展示顺序；官方 + 自建；不含隐藏项） */
    moodList: [] as string[],
    /** 展示元数据（官方默认可被覆盖 + 自建） */
    moodMeta: {} as Record<string, MoodMeta>,
    /** 只读：官方 6 种 */
    baseKeys: UI_MOOD_KEYS as readonly UIMood[],
    /** 统计兼容：旧键 → 新键（仅自建重命名产生） */
    aliasMap: {} as Record<string, string>,
    /** 软隐藏集合（含基础/自建），支持恢复 */
    removed: new Set<string>(),
  }),

  getters: {
    /** 是否官方 6 种之一（type guard） */
    isBase:
      (state) =>
      (v: string): v is UIMood =>
        state.baseKeys.includes(v as UIMood),

    /** 统一的别名解析入口（统计与展示都应先过这里） */
    resolveKey(state) {
      return (key: string) => resolveAlias(key, state.aliasMap)
    },

    /** 提供给视图的卡片（只用可见列表；别名不影响可见列表） */
    moodCards(state): MoodCardView[] {
      return buildMoodCards(state.moodList, state.moodMeta, MOOD_META, state.baseKeys)
    },

    /** 读取 meta（先做别名解析） */
    getMeta(state) {
      return (key: string): MoodMeta => {
        const real = resolveAlias(key, state.aliasMap)
        return (
          state.moodMeta[real] ||
          (state.baseKeys.includes(real as UIMood) ? MOOD_META[real as UIMood] : undefined) || {
            label: real,
            icon: '✨',
            sub: '自定义心情',
          }
        )
      }
    },
  },

  actions: {
    /** 从仓库层加载（与 alias/removed 的持久化合并），并做最小有效性保障 */
    load() {
      const { moodList, moodMeta } = repo.loadState()
      // 先接管主存结果
      this.moodList = Array.isArray(moodList) && moodList.length > 0 ? moodList : [...UI_MOOD_KEYS]
      this.moodMeta = moodMeta || {}

      // 辅助 DTO（alias/removed & userMeta）
      const dto = loadMoodCatalog()
      this.aliasMap = dto?.aliasMap ? compressAliasMap(dto.aliasMap) : {}
      this.removed = new Set(dto?.removed || [])

      // === P1-6 选 B：合并 DTO.userMeta 到运行态 ===
      if (dto && dto.version === 1 && dto.userMeta && typeof dto.userMeta === 'object') {
        // 1) 先把 userMeta 的键做一次别名归一化（避免旧键残留）
        const mappedUserMeta: Record<string, MoodMeta> = {}
        for (const [k, m] of Object.entries(dto.userMeta)) {
          const real = resolveAlias(k, this.aliasMap)
          const label = (m?.label ?? '').toString().trim()
          const icon = (m?.icon ?? '').toString().trim()
          const sub = (m?.sub ?? '').toString().trim()
          const clean: MoodMeta = {
            label: label || (undefined as any),
            icon: icon || (undefined as any),
            sub: sub || (undefined as any),
          }
          // 合并策略：后写优先（用户覆盖优先），字段级覆盖（空值不覆盖）
          const prev =
            this.moodMeta[real] ??
            (this.baseKeys.includes(real as UIMood)
              ? MOOD_META[real as UIMood]
              : { label: real, icon: '✨', sub: '自定义心情' })
          mappedUserMeta[real] = {
            label: clean.label ? clean.label : prev.label,
            icon: clean.icon ? clean.icon : prev.icon,
            sub: clean.sub ? clean.sub : prev.sub,
          }
        }

        // 2) 将 mappedUserMeta 覆写回 moodMeta（仅对可见或官方键保留，避免“悬挂键”）
        const visibleOrBase = new Set<string>([...this.moodList, ...(this.baseKeys as string[])])
        const nextMeta: Record<string, MoodMeta> = { ...this.moodMeta }
        for (const [k, m] of Object.entries(mappedUserMeta)) {
          if (visibleOrBase.has(k)) {
            nextMeta[k] = m
          }
        }

        // 3) 再补官方默认（防止被覆盖掉某字段）
        for (const base of this.baseKeys) {
          if (!nextMeta[base]) nextMeta[base] = { ...MOOD_META[base] }
          else {
            nextMeta[base] = {
              label: nextMeta[base].label ?? MOOD_META[base].label,
              icon: nextMeta[base].icon ?? MOOD_META[base].icon,
              sub: nextMeta[base].sub ?? MOOD_META[base].sub,
            }
          }
        }

        // 4) 写回内存并持久化（确保刷新有效）
        this.moodMeta = repo.saveMoodMeta(nextMeta)
        // 同步刷新 DTO 的时间戳等
        this.persistAux()
      }

      // 额外保护：若被“隐藏”导致可见列表为空，自动恢复一个默认键
      if (this.moodList.length === 0) {
        this.moodList = repo.saveMoodList([UI_MOOD_KEYS[0]])
      }
    },

    /** 内部：持久化 alias/removed（与现有 repo 的 list/meta 持久化并行） */
    persistAux() {
      const dto: MoodCatalogDTO = {
        userMeta: this.moodMeta, // 存当前运行态一份快照（简化：不做diff）
        removed: Array.from(this.removed),
        aliasMap: compressAliasMap(this.aliasMap),
        version: 1,
        updatedAt: Date.now(),
      }
      saveMoodCatalog(dto)
    },

    /** 一次性替换列表（不建议外部直接用；确保最终不为空） */
    setMoodList(list: string[]) {
      const next = repo.saveMoodList(list)
      if (next.length === 0) {
        // 强约束：至少保留 1 个
        this.moodList = repo.saveMoodList([UI_MOOD_KEYS[0]])
      } else {
        this.moodList = next
      }
      this.persistAux()
    },

    /** 确保某个 mood 出现在可见列表（用于选择时自动补回） */
    ensureContains(mood: string) {
      const next = ensureMoodInList(this.moodList, mood, 'head')
      if (next !== this.moodList) {
        this.moodList = repo.saveMoodList(next)
        this.persistAux()
      }
    },

    /** 新增自建心情（前插 + 写 meta；大小写不敏感去重） */
    addCustomMood(key: string, meta?: Partial<MoodMeta>): boolean {
      const k = String(key || '').trim()
      if (!k) return false
      const exists = this.moodList.some((x) => x.toLowerCase() === k.toLowerCase())
      if (exists) return false

      // 前插到可见列表
      this.moodList = repo.saveMoodList([k, ...this.moodList])
      // 清除隐藏状态（若曾被隐藏过）
      this.removed.delete(k)

      // 写 meta（自建默认）
      const m: MoodMeta = {
        label: meta?.label?.trim() || k,
        icon: meta?.icon?.toString() || '✨',
        sub: meta?.sub?.trim() || '自定义心情',
      }
      const nextMeta = { ...this.moodMeta, [k]: m }
      this.moodMeta = repo.saveMoodMeta(nextMeta)

      this.persistAux()
      return true
    },

    /** 编辑展示元数据（官方/自建皆可；官方等价于覆盖默认） */
    editMoodMeta(key: string, patch: Partial<MoodMeta>) {
      const next = repo.upsertMoodMeta(key, patch)
      this.moodMeta = { ...this.moodMeta, [key]: next }
      this.persistAux()
    },

    /**
     * 重命名：
     * - 自建：改 key + 迁移 meta + 记录 aliasMap(old→new)（统计兼容）
     * - 官方：不改 key，仅当作“改 label”
     * 说明：不在此处迁移 userBait；由上层 orchestrator 统一处理。
     * 额外：新增最小防环校验，避免 aliasMap 形成环。
     */
    renameCustomMood(oldKey: string, newKey: string): boolean {
      const oldK = String(oldKey)
      const newK = String(newKey || '').trim()
      if (!newK) return false

      if (this.isBase(oldK)) {
        // 官方：不改 key，只改 label
        this.editMoodMeta(oldK, { label: newK })
        return true
      }

      // 防重名（可见列表大小写不敏感）
      if (this.moodList.some((x) => x.toLowerCase() === newK.toLowerCase())) return false

      // ✅ 最小防环：若 newK 的最终指向是 oldK，则拒绝（避免 A→B、B→A）
      const finalOfNew = resolveAlias(newK, this.aliasMap)
      if (finalOfNew === oldK) return false

      // 列表替换
      const list = this.moodList.slice()
      const idx = list.findIndex((x) => x === oldK)
      if (idx < 0) return false
      list.splice(idx, 1, newK)
      this.moodList = repo.saveMoodList(list)

      // 元数据迁移
      const nextMeta = { ...this.moodMeta }
      if (nextMeta[oldK]) {
        nextMeta[newK] = nextMeta[oldK]
        delete nextMeta[oldK]
        this.moodMeta = repo.saveMoodMeta(nextMeta)
      }

      // 写入别名映射 + 压缩；并确保新键不是隐藏态
      this.aliasMap[oldK] = newK
      this.aliasMap = compressAliasMap(this.aliasMap)
      this.removed.delete(newK)

      this.persistAux()
      return true
    },

    /**
     * 移除（软隐藏）：
     * - 官方 & 自建：均从可见列表移除，并加入 removed；meta 保留以供历史展示与恢复
     * - 强约束：可见列表至少保留 1 个（否则拒绝本次移除）
     * 返回是否成功
     */
    removeMood(key: string): boolean {
      const k = String(key)
      const nextList = this.moodList.filter((x) => x !== k)

      // 至少保留 1 个可见键
      if (nextList.length === 0) return false

      this.moodList = repo.saveMoodList(nextList)
      this.removed.add(k)

      // 自建项的 meta 不再物理删除，改为保留（方便历史展示与恢复）

      this.persistAux()
      return true
    },

    /** 恢复一个被隐藏的键；若不在可见列表则前插 */
    restoreMood(key: string) {
      const k = String(key)
      this.removed.delete(k)
      const next = ensureMoodInList(this.moodList, k, 'head')
      if (next !== this.moodList) {
        this.moodList = repo.saveMoodList(next)
      }
      this.persistAux()
    },
  },
})
