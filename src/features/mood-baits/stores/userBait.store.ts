// src/features/home/mood-baits/stores/userBait.store.ts
import { defineStore } from 'pinia'
import * as repo from '@/features/mood-baits/data/mood.repo'
import { BAIT_POOL } from '@/entities/bait' // ✅ 新增：系统内置诱饵池

export type UserBait = repo.UserBait

/** 生成更稳的数值型 ID：毫秒 * 1000 + 随机 0~999，规避同毫秒新增碰撞 */
function genId(): number {
  return Date.now() * 1000 + Math.floor(Math.random() * 1000)
}

/** 规范化并去重一组心情键（⚠️ 大小写不敏感去重；保留首次出现的原始大小写） */
function normalizeMoods(arr: unknown): string[] {
  if (!Array.isArray(arr)) return []
  const seenLower = new Set<string>()
  const out: string[] = []
  for (const v of arr) {
    const k = String(v ?? '').trim()
    if (!k) continue
    const low = k.toLowerCase()
    if (seenLower.has(low)) continue
    seenLower.add(low)
    out.push(k)
  }
  return out
}

/** 在数组中把 oldKey 替换为 newKey（保持去重） */
function replaceKey(list: string[], oldKey: string, newKey: string): string[] {
  const out = list.map((k) => (k === oldKey ? newKey : k))
  return normalizeMoods(out)
}

/** 从数组中移除某个 key（严格等值移除） */
function removeKey(list: string[], key: string): string[] {
  return list.filter((k) => k !== key)
}

export const useUserBaitStore = defineStore('user-bait', {
  state: () => ({
    list: repo.getUserBaits() as UserBait[],
  }),

  getters: {
    /** 便捷：按心情筛选该心情下的所有诱饵（字面匹配；别名归一化由编排层负责） */
    byMood: (state) => (mood: string) => state.list.filter((b) => b.mood?.includes(mood)),
  },

  actions: {
    load() {
      this.list = repo.getUserBaits()
    },

    /** ✅ 新增：当列表为空时，把系统内置 BAIT_POOL 预置为“我的诱饵”。
     *  - 若传入 visibleKeys，则只预置这些心情下的诱饵；否则预置全部（6 种官方）。
     *  - 只在当前 list 为空时生效，避免二次污染。
     *  - 返回 { seeded } 便于统计或调试。
     */
    ensureSeededFromDefaults(visibleKeys?: readonly string[]): { seeded: number } {
      if (this.list.length > 0) return { seeded: 0 }
      const allow =
        Array.isArray(visibleKeys) && visibleKeys.length > 0
          ? new Set(visibleKeys.map((s) => String(s)))
          : null

      const seed = BAIT_POOL.filter((c) =>
        allow ? c.mood.some((m) => allow.has(String(m))) : true
      ).map<UserBait>((c) => ({
        id: genId(),
        title: c.title,
        mood: normalizeMoods(c.mood),
      }))

      if (seed.length > 0) {
        this.list = repo.saveUserBaits(seed)
      }
      return { seeded: seed.length }
    },

    /** 新增；允许官方或自建心情（string[]） */
    add(title: string, moods: string[]): boolean {
      const t = (title ?? '').trim()
      const m = normalizeMoods(moods)
      if (!t || m.length === 0) return false

      const item: UserBait = { id: genId(), title: t, mood: m }
      const next = [item, ...this.list]
      this.list = repo.saveUserBaits(next)
      return true
    },

    /** 按 id 更新（仅修改提供的字段；更新前做强校验，避免静默丢失） */
    update(patch: Partial<UserBait> & { id: number }): boolean {
      const idx = this.list.findIndex((x) => x.id === patch.id)
      if (idx < 0) return false

      const cur = this.list[idx]
      const nextTitle = (patch.title ?? cur.title).trim()
      const nextMood = patch.mood ? normalizeMoods(patch.mood) : cur.mood

      // 前置强校验：标题与 mood 均需有效
      if (!nextTitle || !Array.isArray(nextMood) || nextMood.length === 0) {
        return false
      }

      const next: UserBait = { id: cur.id, title: nextTitle, mood: nextMood }
      const arr = this.list.slice()
      arr.splice(idx, 1, next)
      this.list = repo.saveUserBaits(arr)
      return true
    },

    /** 批量替换（例如表单编辑完成后整体提交） */
    replace(next: UserBait[]) {
      this.list = repo.saveUserBaits(next)
    },

    remove(id: number) {
      const next = this.list.filter((b) => b.id !== id)
      this.list = repo.saveUserBaits(next)
    },

    clear() {
      this.list = repo.saveUserBaits([])
    },

    /* --------------------------- 引用完整性维护（供编排层调用） --------------------------- */

    /**
     * 心情“重命名”迁移：
     * - 将所有诱饵的 mood[] 中的 oldKey 替换为 newKey，并去重
     * - 返回受影响的条数
     */
    migrateOnRename(oldKey: string, newKey: string): number {
      const oldK = String(oldKey || '')
      const newK = String(newKey || '').trim()
      if (!oldK || !newK || oldK === newK) return 0

      let touched = 0
      const next = this.list.map((b) => {
        if (!b.mood?.includes(oldK)) return b
        touched++
        return { ...b, mood: replaceKey(b.mood, oldK, newK) }
      })

      if (touched > 0) this.list = repo.saveUserBaits(next)
      return touched
    },

    /**
     * 心情“删除/隐藏”迁移：
     * - 从每条诱饵的 mood[] 移除该 key
     * - 若出现 mood 为空：
     *   - 默认策略：删除这条诱饵（onEmpty='drop-bait'）
     *   - 可选：指定 fallback，把空诱饵改为 [fallback]（onEmpty='assign-fallback'）
     * - 返回 { updated, removed }
     *
     * 兼容性兜底：当指定 assign-fallback 但 fallback 无效（空或与待删键相同），自动降级为 drop-bait。
     */
    purgeOnRemove(
      key: string,
      opts?: { onEmpty?: 'drop-bait' | 'assign-fallback'; fallback?: string }
    ): { updated: number; removed: number } {
      const k = String(key || '')
      if (!k) return { updated: 0, removed: 0 }

      const rawMode = opts?.onEmpty ?? 'drop-bait'
      const fbRaw = String(opts?.fallback ?? '').trim()
      const mode = rawMode === 'assign-fallback' && (!fbRaw || fbRaw === k) ? 'drop-bait' : rawMode
      const fb = mode === 'assign-fallback' ? fbRaw : ''

      let updated = 0
      let removed = 0

      const next: UserBait[] = []
      for (const b of this.list) {
        if (!b.mood?.includes(k)) {
          next.push(b)
          continue
        }
        const moods = removeKey(b.mood, k)
        if (moods.length === 0) {
          if (mode === 'assign-fallback') {
            next.push({ ...b, mood: [fb] })
            updated++
          } else {
            removed++
          }
        } else {
          next.push({ ...b, mood: moods })
          updated++
        }
      }

      if (updated > 0 || removed > 0) {
        this.list = repo.saveUserBaits(next)
      }
      return { updated, removed }
    },

    /**
     * 将所有诱饵的 mood[] 通过一个解析器进行归一化（用于 aliasMap 生效后的一次性清理）
     * - resolver: (k) => currentKey
     * - 返回被更新的条数
     */
    normalizeByResolver(resolver: (k: string) => string): number {
      if (typeof resolver !== 'function') return 0
      let touched = 0
      const next = this.list.map((b) => {
        const mapped = normalizeMoods(b.mood.map(resolver))
        if (mapped.length === b.mood.length && mapped.every((v, i) => v === b.mood[i])) return b
        touched++
        return { ...b, mood: mapped }
      })
      if (touched > 0) this.list = repo.saveUserBaits(next)
      return touched
    },
  },
})
