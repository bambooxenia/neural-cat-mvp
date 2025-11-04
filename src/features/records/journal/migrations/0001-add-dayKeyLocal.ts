// src/features/records/journal/migrations/0001-add-dayKeyLocal.ts
/**
 * Migration 0001 – Add `dayKeyLocal` and normalize legacy Journal data.
 *
 * Goals
 * 1) For **legacy journal entries** stored under old keys (e.g. "nc:journal"),
 *    transform them into **Summary(final)** records and merge into the new
 *    `journalSummary` store.
 * 2) For any existing Summary missing `dayKeyLocal` or `status`, patch them.
 *
 * Design
 * - Read legacy arrays of `{ id, text, dateISO }` and convert to `Summary`.
 * - Compute `dayKeyLocal` using **local timezone** at write-time.
 * - Keep legacy data untouched (no deletion), but mark a migration flag.
 * - Idempotent: safe to call multiple times.
 */

import { getJSON, setJSON, getLS, setLS } from '@/shared/utils/storage'
import { toDayKeyLocal, fromISOToDayKeyLocal } from '../utils/dayKeyLocal'
import type { Summary } from '../types/journal'
import { LS } from '@/shared/constants/ls-keys'

/* -------------------- Keys & Flags -------------------- */

const SUMMARY_KEY: string = (LS as any).journalSummary ?? 'nc:journal:summary'

// Known legacy keys (old project names). We'll take the first one that exists.
const LEGACY_JOURNAL_KEYS: string[] = [
  (LS as any).journal, // if present in your shared LS keys
  'nc:journal',
  'journal',
].filter(Boolean) as string[]

const MIGRATION_FLAG_KEY = 'nc:journal:migration:0001:done'

/* -------------------- Legacy Shapes -------------------- */

type LegacyJournalItem = {
  id: number
  text: string
  dateISO?: string // optional in very old data; fallback to now
}

/* -------------------- Public API -------------------- */

/**
 * Returns whether migration 0001 was marked as completed.
 */
export function hasRunJournalMigration0001(): boolean {
  return getLS(MIGRATION_FLAG_KEY, '') === '1'
}

/**
 * Run migration 0001.
 * Safe to call multiple times (idempotent).
 *
 * @returns stats of what happened during this invocation
 */
export function runJournalMigration0001(): {
  migratedFromLegacy: number
  patchedSummaries: number
  totalSummaries: number
  sourceKey?: string
} {
  // Load current summaries (could be empty or partial)
  const current: Summary[] = getJSON(SUMMARY_KEY, [] as Summary[])

  // Step A – Patch existing summaries (missing dayKeyLocal/status)
  let patchedSummaries = 0
  for (const s of current) {
    let changed = false
    if (!(s as any).dayKeyLocal) {
      const iso = s.createdAtISO || s.updatedAtISO || new Date().toISOString()
      ;(s as any).dayKeyLocal = fromISOToDayKeyLocal(iso)
      changed = true
    }
    if (!(s as any).status) {
      ;(s as any).status = 'final'
      changed = true
    }
    if (changed) patchedSummaries++
  }

  // Step B – If we already migrated once and there are no patches to write, we can short-circuit.
  if (hasRunJournalMigration0001() && patchedSummaries === 0) {
    if (patchedSummaries > 0) setJSON(SUMMARY_KEY, current)
    return {
      migratedFromLegacy: 0,
      patchedSummaries,
      totalSummaries: current.length,
    }
  }

  // Step C – Try to read legacy journal array from known keys (first non-empty wins).
  let migratedFromLegacy = 0
  let usedSourceKey: string | undefined
  for (const key of LEGACY_JOURNAL_KEYS) {
    const legacy = getJSON(key, null as any as LegacyJournalItem[] | null)
    if (!Array.isArray(legacy) || legacy.length === 0) continue

    // Transform legacy → Summary(final)
    const transformed: Summary[] = legacy.map((j) => {
      const createdISO = j.dateISO || new Date().toISOString()
      const dayKeyLocal = fromISOToDayKeyLocal(createdISO)
      return {
        id: j.id,
        status: 'final',
        dayKeyLocal,
        text: j.text ?? '',
        usedNoteIds: [],
        templateId: undefined,
        templateVersion: undefined,
        modelMeta: undefined,
        createdAtISO: createdISO,
        updatedAtISO: createdISO,
      }
    })

    // Merge with existing summaries, dedupe by id (prefer current if conflict)
    const byId = new Map<number, Summary>()
    for (const s of current) byId.set(s.id, s)
    for (const t of transformed) if (!byId.has(t.id)) byId.set(t.id, t)

    const merged = Array.from(byId.values()).sort((a, b) => {
      // Newest first: compare by createdAtISO, fallback to id
      const aK = a.createdAtISO || ''
      const bK = b.createdAtISO || ''
      return aK < bK ? 1 : aK > bK ? -1 : b.id - a.id
    })

    migratedFromLegacy = merged.length - current.length
    usedSourceKey = key

    // Persist merged summaries
    setJSON(SUMMARY_KEY, merged)

    // Mark flag and exit the loop (only migrate from the first found legacy key)
    setLS(MIGRATION_FLAG_KEY, '1')

    // Also persist potential patches applied earlier (already in `merged`)
    return {
      migratedFromLegacy,
      patchedSummaries, // patches are included in merged writing
      totalSummaries: merged.length,
      sourceKey: usedSourceKey,
    }
  }

  // Step D – If no legacy data found, we still persist patches (if any) and set flag.
  if (patchedSummaries > 0) {
    setJSON(SUMMARY_KEY, current)
  }
  setLS(MIGRATION_FLAG_KEY, '1')

  return {
    migratedFromLegacy,
    patchedSummaries,
    totalSummaries: current.length,
  }
}

/* -------------------- Dev helpers (optional) -------------------- */

/**
 * DEV ONLY: Reset the migration flag. Does not alter data.
 * Useful when testing the migration repeatedly.
 */
export function resetJournalMigration0001Flag(): void {
  setLS(MIGRATION_FLAG_KEY, '')
}

/**
 * DEV ONLY: Create mock legacy data into the first legacy key slot for testing.
 */
export function __devWriteMockLegacy(items: LegacyJournalItem[]): void {
  const key = LEGACY_JOURNAL_KEYS[0] ?? 'nc:journal'
  setJSON(key, items)
}

/**
 * DEV ONLY: Produce a minimal Summary from text (today), for quick manual tests.
 */
export function __devMakeSummary(text: string): Summary {
  const now = new Date()
  const iso = now.toISOString()
  return {
    id: Number(`${now.getTime()}${Math.floor(Math.random() * 1000)}`),
    status: 'final',
    dayKeyLocal: toDayKeyLocal(now),
    text,
    usedNoteIds: [],
    createdAtISO: iso,
    updatedAtISO: iso,
  }
}
