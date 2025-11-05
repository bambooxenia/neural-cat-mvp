// src/features/records/journal/constants/daily-default.ts
/**
 * Daily summary template based on the user's provided structure (zh-Hant).
 * Produces a Markdown document with fixed sections and emoji headings.
 */

import type { TemplateSpec } from './registry'

/** Keeps the same shape as TemplateSpec['notes'] defined in registry.ts */
type NoteLite = {
  id: number
  text: string
  createdAtISO: string
  tags?: string[]
}

function formatDayKeyToHeader(dayKeyLocal: string): string {
  // "2025-07-28" �?"2025 / 07 / 28"
  const [y, m, d] = dayKeyLocal.split('-')
  return `${y} / ${m} / ${d}`
}

function hhmm(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

function unique<T>(arr: T[]): T[] {
  return Array.from(new Set(arr))
}

function extractTags(notes: Array<Pick<NoteLite, 'text' | 'tags'>>): string[] {
  const all: string[] = []
  for (const n of notes) {
    if (n.tags && n.tags.length) all.push(...n.tags)
    const matches = n.text.match(/#([^\s#]+)/g) || []
    for (const m of matches) all.push(m.replace(/^#/, ''))
  }
  return unique(all)
}

function renderTagsLine(notes: Array<Pick<NoteLite, 'text' | 'tags'>>): string {
  const tags = extractTags(notes)
  if (!tags.length) return '(empty)'
  return tags.map((t) => `#${t}`).join(' ')
}

/** Build the LLM prompt from notes and the template’s required sections. */
function buildPromptZhHant(ctx: {
  dayKeyLocal: string
  notes: NoteLite[]
}): { system?: string; user: string; extras?: Record<string, unknown> } {
  const { dayKeyLocal, notes } = ctx
  const dateHeader = formatDayKeyToHeader(dayKeyLocal)

  const notesAsBullets = notes
    .map((n) => {
      const time = hhmm(n.createdAtISO)
      const tags = n.tags && n.tags.length ? ` #${n.tags.join(' #')}` : ''
      const text = n.text.replace(/\s+/g, ' ').trim()
      return `- ${time} | ${text}${tags}`
    })
    .join('\n')

  const system =
    'You are an ADHD-friendly daily wrap-up assistant who excels at turning scattered notes into clear, reviewable Markdown documents. Write in English with a warm, empowering, and practical tone.'

  const user = [
    `Using the user's scattered notes from **${dateHeader}**, produce a "Miracle Daily Wrap-up" Markdown document. The format and section titles must match the template below exactly, including every emoji.`,
    '',
    '## Template (follow strictly; leave fields blank or mark with "(empty)" when data is missing):',
    '',
    `# ${dateHeader}`,
    '',
    '## Miracle Daily Wrap-up |',
    '',
    '### 🟢 #Tags | separate multiple #tags with spaces',
    '',
    '---',
    '',
    '### 🕘 Wake-up Record',
    '',
    '- Wake-up time:',
    '- Bedtime / total sleep:',
    '- How I felt waking up (0-10):',
    '',
    '(Note: infer from the scattered notes when possible; otherwise summarize briefly or leave blank.)',
    '',
    '---',
    '',
    '### Energy & Focus Check-in',
    '',
    '- Morning (1-10):',
    '- Afternoon (1-10):',
    '- Evening (1-10):',
    '- Brain fog or emotional overwhelm: Y/N describe impact and response',
    '',
    '---',
    '',
    '### 🧘 Rest Log',
    '',
    '- Time of rest:',
    '- Used breathing practice? Y/N',
    '- How I felt afterward (1-10):',
    '- Any miracle moment? Y/N describe specifically',
    '',
    '---',
    '',
    '### ⚙️ Task Execution',
    '',
    '- Task name:',
    '- Completed? Yes/No',
    '- Focus / sense of progress (1-10): Done-line reflection',
    '',
    '---',
    '',
    '### Todays Highlights',
    '',
    '- List 3 bullets for the most valuable wins, breakthroughs, or positive experiences',
    '',
    '---',
    '',
    '### 🧩 Behaviors to Keep Tomorrow',
    '',
    '- List 2 repeatable micro-habits or rhythms',
    '',
    '---',
    '',
    '📌 **Reflection Quote:**',
    '',
    'Provide one vivid, concrete closing quote (humor welcome).',
    '',
    '## Source Material (notes for your reference; omit this section from the final output)',
    '```',
    notesAsBullets || '(No scattered notes today.)',
    '```',
    '',
    '## Output Requirements',
    '- Output only the final Markdown (no preface, no analysis).',
    '- Use English and keep every section heading and emoji.',
    '- When information is missing, infer from the notes when reasonable; otherwise write "(empty)".',
  ].join('\n')

  return { system, user, extras: { format: 'markdown', lang: 'zh-Hant' } }
}

/** Local/dev renderer: produces a skeleton that matches the template. */
function renderLocalDraftZhHant(ctx: {
  dayKeyLocal: string
  notes: NoteLite[]
}): string {
  const { dayKeyLocal, notes } = ctx
  const header = formatDayKeyToHeader(dayKeyLocal)
  const tags = renderTagsLine(notes)

  return [
    `# ${header}`,
    '',
    '## Miracle Daily Wrap-up |',
    '',
    `### 🟢 #Tags | ${tags}`,
    '',
    '---',
    '',
    '### 🕘 Wake-up Record',
    '',
    '- Wake-up time:',
    '- Bedtime / total sleep:',
    '- How I felt waking up (0-10):',
    '    ',
    '    (Note: local draft placeholder; AI will fill this later.)',
    '',
    '---',
    '',
    '### Energy & Focus Check-in',
    '',
    '- Morning (1-10):',
    '- Afternoon (1-10):',
    '- Evening (1-10):',
    '- Brain fog or emotional overwhelm:',
    '',
    '---',
    '',
    '### 🧘 Rest Log',
    '',
    '- Time of rest:',
    '- Used breathing practice?',
    '- How I felt afterward (1-10):',
    '- Any miracle moment?',
    '',
    '---',
    '',
    '### ⚙️ Task Execution',
    '',
    '- Task name:',
    '- Completed?:',
    '- Focus / sense of progress (1-10):',
    '',
    '---',
    '',
    '### Today  Highlights',
    '',
    '- (placeholder)',
    '',
    '---',
    '',
    '### 🧩 Behaviors to Keep Tomorrow',
    '',
    '- (placeholder)',
    '',
    '---',
    '',
    '📌 **Reflection Quote:**',
    '',
    '(placeholder)',
  ].join('\n')
}

export const DailyDefaultTemplate: TemplateSpec = {
  id: 'daily-default-zh',
  version: 1,
  name: 'Miracle Daily Wrap-up',
  lang: 'zh-Hant',
  buildPrompt: ({ dayKeyLocal, notes }) =>
    buildPromptZhHant({ dayKeyLocal, notes: notes as NoteLite[] }),
  renderLocalDraft: ({ dayKeyLocal, notes }) =>
    renderLocalDraftZhHant({ dayKeyLocal, notes: notes as NoteLite[] }),
}
