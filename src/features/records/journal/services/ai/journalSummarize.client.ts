
// src/features/records/journal/services/ai/journalSummarize.client.ts
/**
 * Single entrypoint to generate a daily Summary from scattered notes.
 *
 * Design goals
 * - Pluggable provider:
 *    - "http": call your backend (recommended for prod)
 *    - "local": synthesize a draft on the client (for dev/offline)
 * - Stable contract for aiJobs.store.ts → succeed()
 * - Template-aware: looks up template meta (id/version/prompt) from registry
 *
 * This module DOES NOT mutate any Pinia store. It only returns a draft result.
 */

import { useNCJournalNotesStore } from '../../stores/journalNotes.store'
import type { Note } from '../../types/journal'

// 🔧 If you haven't implemented the registry yet, keep the function signature consistent.
import { getTemplateSpec } from '../../constants/registry'

/** Result written into Summary(draft) by aiJobs.succeed(...) */
export type JournalSummarizeResponse = {
  text: string
  usedNoteIds: number[]
  templateId: string
  templateVersion?: number
  modelMeta?: Record<string, unknown>
}

/** Input to summarize a given day */
export type JournalSummarizePayload = {
  dayKeyLocal: string                 // e.g. "2025-07-28" (local-day SSOT)
  templateId: string                  // e.g. "daily-default-zh"
  noteIds?: number[]                  // optional subset; by default uses all notes of the day
  // extra payload that you may want to pass through to the backend
  extra?: Record<string, unknown>
}

/** Provider options */
export type JournalSummarizeOptions = {
  provider?: 'http' | 'local'         // default: auto → http if endpoint provided else local
  endpoint?: string                   // default: import.meta.env.VITE_JOURNAL_AI_ENDPOINT
  signal?: AbortSignal                // optional fetch abort signal
}

/** Template spec (minimum contract used by this client) */
type TemplateSpec = {
  id: string
  version?: number
  name?: string
  lang?: string                       // e.g. "zh-CN" / "zh-TW" / "en"
  /**
   * Build LLM prompts (optional). If not provided, backend can decide prompt itself.
   * Return object can be directly forwarded to your backend.
   */
  buildPrompt?: (ctx: {
    dayKeyLocal: string
    notes: Pick<Note, 'id' | 'text' | 'createdAtISO' | 'tags'>[]
  }) => { system?: string; user: string; extras?: Record<string, unknown> }
  /**
   * Render a dev/offline draft on the client (optional). Used by "local" provider.
   * If absent, a generic markdown fallback will be used.
   */
  renderLocalDraft?: (ctx: {
    dayKeyLocal: string
    notes: Pick<Note, 'id' | 'text' | 'createdAtISO' | 'tags'>[]
  }) => string
}

/**
 * Main API – generate a daily summary draft.
 *
 * IMPORTANT:
 * - This function only PREPARES a draft and returns it.
 * - Writing to stores is handled by aiJobs.store.ts → succeed().
 */
export async function summarizeDay(
  payload: JournalSummarizePayload,
  options: JournalSummarizeOptions = {}
): Promise<JournalSummarizeResponse> {
  const endpoint =
    options.endpoint ?? (import.meta as any)?.env?.VITE_JOURNAL_AI_ENDPOINT ?? ''
  const provider: 'http' | 'local' =
    options.provider ?? (endpoint ? 'http' : 'local')

  // 1) Collect notes for the day (and filter by noteIds if provided)
  const notesStore = useNCJournalNotesStore()
  notesStore.load?.()
  const allNotes = notesStore.listByDay(payload.dayKeyLocal) as Note[]

  const picked =
    payload.noteIds && payload.noteIds.length
      ? allNotes.filter((n) => payload.noteIds!.includes(n.id))
      : allNotes

  // Normalize into the minimal shape to avoid leaking store internals
  const notes = picked.map((n) => ({
    id: n.id,
    text: n.text,
    createdAtISO: n.createdAtISO,
    tags: n.tags ?? [],
  }))

  // 2) Template lookup (id/version/prompt)
  const tpl: TemplateSpec | undefined = safeGetTemplate(payload.templateId)

  if (provider === 'http' && endpoint) {
    // --- Provider: HTTP backend ---
    const body = {
      dayKeyLocal: payload.dayKeyLocal,
      templateId: tpl?.id ?? payload.templateId,
      templateVersion: tpl?.version,
      notes,
      prompt: tpl?.buildPrompt?.({ dayKeyLocal: payload.dayKeyLocal, notes }),
      extra: payload.extra ?? {},
    }

    const res = await fetch(endpointify(endpoint), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: options.signal,
    })

    if (!res.ok) {
      const errText = await safeText(res)
      throw new Error(`Summarize API failed (${res.status}): ${errText}`)
    }

    const data = (await res.json()) as Partial<JournalSummarizeResponse> & {
      // allow backend to return extra diagnostics
      requestId?: string
      model?: string
      finishReason?: string
    }

    const text = (data.text ?? '').trim()
    if (!text) {
      throw new Error('Summarize API returned empty text')
    }

    return {
      text,
      usedNoteIds:
        (data.usedNoteIds && data.usedNoteIds.length ? data.usedNoteIds : notes.map((n) => n.id)) ??
        [],
      templateId: tpl?.id ?? payload.templateId,
      templateVersion: data.templateVersion ?? tpl?.version,
      modelMeta: {
        provider: 'http',
        endpoint: endpoint,
        model: (data as any).model,
        requestId: (data as any).requestId,
        finishReason: (data as any).finishReason,
        ...data.modelMeta,
      },
    }
  }

  // --- Provider: local/dev synth ---
  const text =
    tpl?.renderLocalDraft?.({ dayKeyLocal: payload.dayKeyLocal, notes }) ??
    renderGenericMarkdownDraft({
      dayKeyLocal: payload.dayKeyLocal,
      notes,
      title:
        tpl?.name ??
        '奇迹日终记录（本地草稿）',
      lang: tpl?.lang,
    })

  return {
    text,
    usedNoteIds: notes.map((n) => n.id),
    templateId: tpl?.id ?? payload.templateId,
    templateVersion: tpl?.version,
    modelMeta: {
      provider: 'local-dev',
      noteCount: notes.length,
    },
  }
}

/* -------------------------- Helpers -------------------------- */

function safeGetTemplate(templateId: string): TemplateSpec | undefined {
  try {
    const spec = getTemplateSpec?.(templateId) as TemplateSpec | undefined
    return spec
  } catch {
    // registry not ready yet – fall back to undefined
    return undefined
  }
}

function endpointify(endpoint: string): string {
  // Allow either absolute or relative endpoints, and avoid accidental double slashes
  return endpoint.replace(/([^:]\/)\/+/g, '$1')
}

async function safeText(res: Response) {
  try {
    return await res.text()
  } catch {
    return ''
  }
}

function formatDayKeyToHeader(dayKeyLocal: string): string {
  // "2025-07-28" → "2025 / 07 / 28"
  const [y, m, d] = dayKeyLocal.split('-')
  return `${y} / ${m} / ${d}`
}

function renderGenericMarkdownDraft(params: {
  dayKeyLocal: string
  notes: Array<Pick<Note, 'id' | 'text' | 'createdAtISO' | 'tags'>>
  title?: string
  lang?: string
}): string {
  const { dayKeyLocal, notes, title } = params
  const header = `# ${formatDayKeyToHeader(dayKeyLocal)}\n\n## 🗓️ ${title ?? 'Daily Summary Draft'}\n`

  if (!notes.length) {
    return `${header}\n> 今天还没有散记内容。先记录一些要点，再点击“生成总结”。\n`
  }

  const bullets = notes
    .map((n) => {
      const hhmm = new Date(n.createdAtISO)
        .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      const tags = n.tags?.length ? `  \n  _#${n.tags.join(' #')}_` : ''
      const safeText = n.text.trim().replace(/\n{3,}/g, '\n\n')
      return `- ${hhmm}｜${safeText}${tags}`
    })
    .join('\n')

  return [
    header,
    '---',
    '\n### 📝 今日散记摘录',
    bullets,
    '\n---',
    '### ✨ 初步亮点（AI 草稿占位）',
    '- 用“学习/工作/情绪/休息/社交/健康”框架，提取 3–5 条亮点。',
    '\n### 🧩 明日想保留的行为（占位）',
    '- 选择 2–3 个“可复制的小动作/节奏”。',
    '\n> 本段为本地合成草稿。接入后端或本地模型后，将生成符合模板的正式 Summary。',
  ].join('\n')
}

/* -------------------------- Backend payload (reference) --------------------------
Expected POST body when provider="http":

{
  "dayKeyLocal": "2025-07-28",
  "templateId": "daily-default-zh",
  "templateVersion": 1,                 // optional
  "notes": [
    { "id": 123, "text": "...", "createdAtISO": "2025-07-28T04:12:00.000Z", "tags": ["tag1"] }
  ],
  "prompt": {                           // optional; built by template registry if available
    "system": "...",
    "user": "...",
    "extras": { "style": "markdown" }
  },
  "extra": { }                          // passthrough
}

Expected response JSON (minimal):

{
  "text": "# 2025 / 07 / 28\n\n## ...",
  "usedNoteIds": [123, 456],
  "templateVersion": 1,
  "modelMeta": { "model": "gpt-4.1-mini", "latencyMs": 1234 }
}
----------------------------------------------------------------------------------- */
