// src/features/mood-baits/services/mood.service.ts

import type { MoodKey } from '@/entities/mood'
import type { MoodMeta } from '@/features/mood-baits/constants/mood'
import { NC_MOOD_CATALOG_V1 } from '@/shared/constants/ls-keys'

/** 供界面使用的卡片视图类型（值 + 元数据 + 是否官方内置） */
export type MoodCardView = {
  value: string
  meta: MoodMeta
  isBase: boolean
}

/** 判断是否为官方 6 种之一（基于传入的 baseKeys 判断，避免耦合全局常量） */
export function isBaseMood(value: string, baseKeys: readonly string[]): value is MoodKey {
  return baseKeys.includes(value)
}

/**
 * 清洗心情列表：
 * - 转 string、trim
 * - 去空、去重
 * - 若提供 allowedKeys，则仅保留其中包含的值（常用于“只保留官方 6 种”）
 */
export function sanitizeMoodList(list: unknown, allowedKeys?: readonly string[]): string[] {
  if (!Array.isArray(list)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of list) {
    const v = String(raw ?? '').trim()
    if (!v) continue
    if (allowedKeys && !allowedKeys.includes(v)) continue
    if (!seen.has(v)) {
      seen.add(v)
      out.push(v)
    }
  }
  return out
}

/**
 * 规范化“设置当前心情”的结果：
 * - 若 current 存在且在 list 中，返回 current
 * - 否则若 list 非空，返回 list[0]
 * - 否则回退到 fallbackKeys[0]（例如 UI_MOOD_KEYS[0]）
 */
export function normalizeOnSetMood(
  current: string | null | undefined,
  list: readonly string[],
  fallbackKeys: readonly string[]
): string {
  const cur = String(current ?? '').trim()
  if (cur && list.includes(cur)) return cur
  if (list.length > 0) return list[0]
  return fallbackKeys[0] ?? ''
}

/**
 * 生成界面卡片数据：
 * - list 为要渲染的键集合（官方 + 自建）
 * - meta 为用户/运行期元数据表
 * - baseMeta 为官方 6 种的默认元数据（用于兜底）
 * - baseKeys 可选；不传则用 baseMeta 的键来判断“是否内置”
 */
export function buildMoodCards(
  list: readonly string[],
  meta: Readonly<Record<string, MoodMeta>>,
  baseMeta: Readonly<Record<MoodKey, MoodMeta>>,
  baseKeys?: readonly MoodKey[]
): MoodCardView[] {
  const baseSet = new Set<string>((baseKeys ?? (Object.keys(baseMeta) as MoodKey[])) as string[])
  return list.map((value) => {
    const isBase = baseSet.has(value)
    const m = meta[value] ??
      (isBase ? baseMeta[value as MoodKey] : undefined) ?? {
        label: value,
        icon: '✨',
        sub: '自定义心情',
      }
    return { value, isBase, meta: m }
  })
}

/**
 * 若目标 mood 不在列表中，则按策略加入：
 * - 默认插到列表头（可根据需求改为尾部）
 * - 保证去重
 */
export function ensureMoodInList(
  list: readonly string[],
  mood: string,
  insert: 'head' | 'tail' = 'head'
): string[] {
  const v = String(mood ?? '').trim()
  if (!v) return [...list]
  const has = list.includes(v)
  if (has) return [...list]
  return insert === 'head' ? [v, ...list] : [...list, v]
}

/**
 * 当某个 mood 从目录移除后，如何“回退当前值”：
 * - 若 current 仍存在于列表：保持不变
 * - 若不存在：若列表非空 → 取列表第 1 个；否则 → 取 fallbackKeys[0]
 */
export function resolveCurrentAfterRemoval(
  current: string | null | undefined,
  nextList: readonly string[],
  fallbackKeys: readonly string[]
): string {
  const cur = String(current ?? '').trim()
  if (cur && nextList.includes(cur)) return cur
  if (nextList.length > 0) return nextList[0]
  return fallbackKeys[0] ?? ''
}

/* -------------------------------------------------------------------------------------------------
 * 目录持久化（与 moodCatalog.store.ts 配套）
 * 说明：
 * - 这里只提供 DTO 与读写 localStorage 的纯函数；
 * - 具体的业务逻辑（别名压缩、隐藏集合管理）放在 store 内部完成。
 * ------------------------------------------------------------------------------------------------- */

/** 目录存档 DTO（只保存“用户变化”与辅助映射；基础常量由程序内置） */
export type MoodCatalogDTO = {
  /** 用户覆盖/新增的 meta（官方默认不必入库，除非被用户覆盖） */
  userMeta: Record<string, MoodMeta>
  /** 被隐藏的键（软删除）；加载时可转为 Set 使用 */
  removed: string[]
  /** 统计兼容：旧键 → 新键（仅自定义重命名产生；可能形成链） */
  aliasMap: Record<string, string>
  /** 版本号（向后兼容用） */
  version: 1
  /** 最近一次更新时间戳 */
  updatedAt: number
}

/** 从本地载入目录存档（读取失败返回 null） */
export function loadMoodCatalog(): MoodCatalogDTO | null {
  try {
    const raw = localStorage.getItem(NC_MOOD_CATALOG_V1)
    return raw ? (JSON.parse(raw) as MoodCatalogDTO) : null
  } catch {
    return null
  }
}

/** 将目录存档写入本地（失败静默） */
export function saveMoodCatalog(dto: MoodCatalogDTO) {
  try {
    localStorage.setItem(NC_MOOD_CATALOG_V1, JSON.stringify(dto))
  } catch {
    // no-op
  }
}
