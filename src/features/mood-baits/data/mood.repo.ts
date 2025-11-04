// src/features/mood-baits/data/mood.repo.ts
/**
 * Mood Repository — 仅持久化 & 校验（无历史迁移逻辑）
 * 职责：
 *  - 读取/写入：currentMood / moodList / moodMeta / userBaits
 *  - 校验：去重、裁剪非法值、为官方 6 种补默认 meta
 *
 * 重要变更（允许自建心情）：
 *  - currentMood 放宽为 string，不再局限于官方 6 种。
 *  - coerceCurrentMood 以“当前可见列表”为准：在列表内则保留，否则回退至列表首项；极端情况下回退到 UI_MOOD_KEYS[0]。
 */

import { UI_MOOD_KEYS } from '@/entities/mood'
import { MOOD_META, type MoodMeta } from '@/features/mood-baits/constants/mood'
import { LS } from '@/shared/constants/ls-keys'
import { getLS, setLS, getJSON, setJSON } from '@/shared/utils/storage'

/** 注意：userBaits.mood 放宽为 string[]（允许自建心情） */
export type UserBait = { id: number; title: string; mood: string[] }

export type MoodRepoState = {
  /** ✅ 放宽为 string：允许自建心情成为当前心情（以可见列表为准） */
  currentMood: string
  /** UI 可见心情集合（官方 + 自建） */
  moodList: string[]
  /** 展示元数据（官方 + 自建） */
  moodMeta: Record<string, MoodMeta>
  userBaits: UserBait[]
}

/* ------------------------- 工具：清理/校验 ------------------------- */

// 去重 + 去空 + 去首尾空白
function cleanupStringArray(arr: unknown): string[] {
  if (!Array.isArray(arr)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const v of arr) {
    const k = String(v ?? '').trim()
    if (!k) continue
    if (!seen.has(k)) {
      seen.add(k)
      out.push(k)
    }
  }
  return out
}

// 规范化列表（不做旧值映射，只做去重/去空）
function sanitizeMoodList(list: unknown): string[] {
  return cleanupStringArray(list)
}

// 官方 6 种补默认 meta；自建不强制
function ensureBaseMeta(meta: Record<string, MoodMeta>): Record<string, MoodMeta> {
  const next = { ...meta }
  for (const k of UI_MOOD_KEYS) {
    if (!next[k]) next[k] = { ...MOOD_META[k] }
  }
  return next
}

/**
 * 以“可见列表”为准的 currentMood 归一化：
 * - v 在 allowed 内 → v
 * - 否则 → allowed[0]
 * - allowed 为空（极端）→ UI_MOOD_KEYS[0]
 */
function coerceCurrentMood(value: unknown, allowed?: readonly string[]): string {
  const v = String(value ?? '').trim()
  const list = Array.isArray(allowed) && allowed.length > 0 ? [...allowed] : getMoodList()
  if (v && list.includes(v)) return v
  return list[0] ?? UI_MOOD_KEYS[0]
}

// 过滤 UserBait：标题必填；mood 仅做去重/去空（允许自建心情）
function sanitizeUserBaits(baits: unknown): UserBait[] {
  if (!Array.isArray(baits)) return []
  return baits
    .map((b: any) => ({
      id: Number(b?.id) || Date.now(),
      title: String(b?.title ?? '').trim(),
      mood: cleanupStringArray(b?.mood),
    }))
    .filter((b) => b.title && b.mood.length)
}

/* ----------------------------- 读取聚合 ----------------------------- */

export function loadState(): MoodRepoState {
  // 列表（官方 + 自建）
  let moodList = sanitizeMoodList(getJSON(LS.moodList, []))
  if (moodList.length === 0) moodList = [...UI_MOOD_KEYS]

  // 展示元数据（补齐官方默认）
  const moodMetaRaw = getJSON(LS.moodMeta, {}) as Record<string, MoodMeta>
  const moodMeta = ensureBaseMeta(moodMetaRaw || {})

  // 当前心情（✅ 允许自建；以列表为准做回退）
  const saved = getLS(LS.mood, UI_MOOD_KEYS[0])
  const currentMood = coerceCurrentMood(saved, moodList)

  // 用户诱饵（允许自建心情）
  const userBaits = sanitizeUserBaits(getJSON(LS.userBaits, []))

  return { currentMood, moodList, moodMeta, userBaits }
}

/* ------------------------------ 写入 API ------------------------------ */

/**
 * 写入 currentMood（✅ 允许自建）：
 * - 以当前可见列表为准做回退
 * - 更新写入时间戳
 */
export function saveCurrentMood(value: string): string {
  const pick = coerceCurrentMood(value, getMoodList())
  setLS(LS.mood, pick)
  setLS(LS.moodAt, String(Date.now()))
  return pick
}

export function saveMoodList(list: string[]): string[] {
  let next = sanitizeMoodList(list)
  if (next.length === 0) next = [...UI_MOOD_KEYS]
  setJSON(LS.moodList, next)
  return next
}

export function saveMoodMeta(meta: Record<string, MoodMeta>): Record<string, MoodMeta> {
  const safe = ensureBaseMeta(meta || {})
  setJSON(LS.moodMeta, safe)
  return safe
}

// upsert 单条元数据（官方/自建皆可）
export function upsertMoodMeta(key: string, patch: Partial<MoodMeta>): MoodMeta {
  const k = String(key ?? '').trim()
  if (!k) throw new Error('mood key is required')

  const all = getJSON(LS.moodMeta, {}) as Record<string, MoodMeta>
  const prev =
    all[k] ??
    (UI_MOOD_KEYS.includes(k as any)
      ? MOOD_META[k as keyof typeof MOOD_META]
      : { label: k, icon: '✨', sub: '自定义心情' })

  const next: MoodMeta = {
    label: patch.label !== undefined ? String(patch.label) : prev.label,
    icon: patch.icon !== undefined ? String(patch.icon) : prev.icon,
    sub: patch.sub !== undefined ? String(patch.sub) : prev.sub,
  }
  all[k] = next
  setJSON(LS.moodMeta, all)
  return next
}

export function saveUserBaits(baits: UserBait[]): UserBait[] {
  const sanitized = sanitizeUserBaits(baits)
  setJSON(LS.userBaits, sanitized)
  return sanitized
}

/* ----------------------------- 便捷只读 ----------------------------- */

export const getCurrentMood = (): string => {
  const list = getMoodList()
  const saved = getLS(LS.mood, list[0] ?? UI_MOOD_KEYS[0])
  return coerceCurrentMood(saved, list)
}

export const getMoodList = (): string[] =>
  ((): string[] => {
    const list = sanitizeMoodList(getJSON(LS.moodList, []))
    return list.length ? list : [...UI_MOOD_KEYS]
  })()

export const getMoodMeta = (): Record<string, MoodMeta> => ensureBaseMeta(getJSON(LS.moodMeta, {}))

export const getUserBaits = (): UserBait[] => sanitizeUserBaits(getJSON(LS.userBaits, []))

/* ------------------------------- 清理 ------------------------------- */
// 重置/调试用：仅清除与情绪诱饵相关的数据
export function clearAllMoodData(): void {
  localStorage.removeItem(LS.mood)
  localStorage.removeItem(LS.moodAt)
  localStorage.removeItem(LS.moodList)
  localStorage.removeItem(LS.moodMeta)
  localStorage.removeItem(LS.userBaits)
}
