// src/features/records/journal/stores/index.ts
/**
 * Journal module - unified export hub (plural `stores/` path).
 *
 * Usage (recommended):
 *   import {
 *     useNCJournalStore,          // = Summary store (compat alias)
 *     useNCJournalSummaryStore,   // explicit Summary store
 *     useNCJournalNotesStore,     // Notes (scraps) store
 *     useNCJournalAIJobsStore,    // AI jobs (orchestration) store
 *   } from '@/features/records/journal/stores'
 *
 * Types:
 *   import type { Summary, Note, AIJob, SummaryStatus } from '@/features/records/journal/stores'
 */

export {
  // Backward-compat: old name "useNCJournalStore" now maps to Summary store
  useNCJournalSummaryStore as useNCJournalStore,
  // Explicit store exports
  useNCJournalSummaryStore,
} from './journalSummary.store'

export { useNCJournalNotesStore } from './journalNotes.store'
export { useNCJournalAIJobsStore } from './aiJobs.store'

// ---- Types passthrough ----
export type {
  // Canonical names
  Summary,
  Note,
  AIJob,
  SummaryStatus,
} from '../types/journal'

// Optional aliases (for readability in app code)
export type {
  Summary as JournalSummary,
  Note as JournalNote,
  AIJob as JournalAIJob,
} from '../types/journal'
