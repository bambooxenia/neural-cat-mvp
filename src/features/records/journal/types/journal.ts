// src/features/records/journal/types/journal.ts
/**
 * Canonical types for the Journal module.
 * These types are imported by stores, services, and pages.
 */

/** Local-day key, fixed at write time. Format: "YYYY-MM-DD" (based on user's local time). */
export type DayKeyLocal = string;

/** A single scattered note (user's quick jot for the day). */
export interface Note {
  id: number;
  text: string;
  /** Creation timestamp in ISO 8601 (UTC). */
  createdAtISO: string;
  /** Local-day partition key (SSOT for grouping). */
  dayKeyLocal: DayKeyLocal;
  /** Optional lightweight tags (e.g., parsed from #hashtags or user-provided). */
  tags?: string[];
}

/** Status of a generated summary. */
export type SummaryStatus = 'draft' | 'final';

/** Daily summary (the “final document” shown in JournalDetail). */
export interface Summary {
  id: number;
  status: SummaryStatus;
  /** Local-day partition key. */
  dayKeyLocal: DayKeyLocal;
  /** Markdown body rendered in the detail page. */
  text: string;
  /** IDs of notes used to build this summary (for traceability). */
  usedNoteIds: number[];
  /** Template metadata (for reproducibility/evolution). */
  templateId?: string;
  templateVersion?: number;
  /** Provider/model diagnostics or custom metadata. */
  modelMeta?: Record<string, unknown>;
  /** Audit timestamps (ISO 8601). */
  createdAtISO: string;
  updatedAtISO: string;
}

/** AI job status for orchestrating summarize requests. */
export type AIJobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled';

/** AI job record (short-lived; persisted only for UX/diagnostics). */
export interface AIJob {
  /** Local identifier for the job (not necessarily the backend id). */
  jobId: string;
  /** Target local-day to summarize. */
  dayKeyLocal: DayKeyLocal;
  /** Template to apply for this summary generation. */
  templateId: string;
  /** Optional subset of notes to include; empty/undefined means “all notes of the day”. */
  noteIds?: number[];
  /** Current status. */
  status: AIJobStatus;
  /** The created Summary id, if succeed(). */
  summaryId?: number;
  /** Error message when failed(). */
  errorMessage?: string;
  /** Audit timestamps (ISO 8601). */
  createdAtISO: string;
  updatedAtISO: string;
}
