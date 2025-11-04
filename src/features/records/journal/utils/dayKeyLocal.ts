// src/features/records/journal/utils/dayKeyLocal.ts
/**
 * Single Source of Truth for "local-day" keys used across the Journal module.
 *
 * A DayKeyLocal is a string "YYYY-MM-DD" computed in the user's **local timezone**,
 * and is FIXED at write-time (stored alongside records) to keep grouping stable
 * even if the system timezone changes later.
 */

/** Zero-pad to 2 digits. */
function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

/** Build a DayKeyLocal from a Date (local timezone). Default: now. */
export function toDayKeyLocal(date: Date = new Date()): string {
  return [
    date.getFullYear(),
    pad2(date.getMonth() + 1),
    pad2(date.getDate()),
  ].join('-')
}

/** Build a DayKeyLocal from an ISO timestamp string (interpreted in local time). */
export function fromISOToDayKeyLocal(iso: string): string {
  const d = new Date(iso)
  return toDayKeyLocal(d)
}

/** Validate "YYYY-MM-DD" AND that it corresponds to a real calendar date. */
export function isValidDayKeyLocal(key: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false
  const [yStr, mStr, dStr] = key.split('-')
  const y = Number(yStr), m = Number(mStr), d = Number(dStr)
  const dt = new Date(y, m - 1, d)
  return (
    dt.getFullYear() === y &&
    dt.getMonth() === m - 1 &&
    dt.getDate() === d
  )
}

/** Convert a DayKeyLocal to a Date at local midnight (00:00:00). */
export function dayKeyLocalToDate(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, (m as number) - 1, d as number, 0, 0, 0, 0)
}

/** Compare two DayKeyLocal strings in descending order (newest first). */
export function compareDayKeyLocalDesc(a: string, b: string): number {
  // lexical compare works for YYYY-MM-DD
  return a < b ? 1 : a > b ? -1 : 0
}

/** Compare two DayKeyLocal strings in ascending order (oldest first). */
export function compareDayKeyLocalAsc(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/** Are two ISO timestamps on the same local day? */
export function sameLocalDayFromISO(aISO: string, bISO: string): boolean {
  return fromISOToDayKeyLocal(aISO) === fromISOToDayKeyLocal(bISO)
}

/** Format "YYYY-MM-DD" → "YYYY / MM / DD" for titles. */
export function formatDayKeyLocalSlash(key: string): string {
  if (!isValidDayKeyLocal(key)) return key
  const [y, m, d] = key.split('-')
  return `${y} / ${m} / ${d}`
}

/** Convenience: today's DayKeyLocal. */
export function todayDayKeyLocal(): string {
  return toDayKeyLocal(new Date())
}
