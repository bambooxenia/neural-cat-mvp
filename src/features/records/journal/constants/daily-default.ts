// src/features/records/journal/constants/daily-default.ts
/**
 * Daily summary template based on the user's provided structure (zh-Hant).
 * Produces a Markdown document with fixed sections and emoji headings.
 */

import type { TemplateSpec } from './registry'

/** 与 registry.ts 中 TemplateSpec 的 notes 形状保持一致 */
type NoteLite = {
  id: number
  text: string
  createdAtISO: string
  tags?: string[]
}

function formatDayKeyToHeader(dayKeyLocal: string): string {
  // "2025-07-28" → "2025 / 07 / 28"
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
  if (!tags.length) return '（留空）'
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
      return `- ${time}｜${text}${tags}`
    })
    .join('\n')

  const system =
    '你是一位幫助 ADHD 友善的日結助手，擅長將零散筆記整理為條理分明、可回顧的 Markdown 文檔。語言使用繁體中文（zh-Hant），語氣溫暖、有力、務實。'

  const user = [
    `請根據使用者在 **${dateHeader}** 的零散筆記，產出一份「奇蹟日終記錄」Markdown 文檔，格式與區塊標題需與下方模板**一致**，表情符號也要保留。`,
    '',
    '## 模板（必須嚴格遵守，沒有資料的欄位可留白或簡短標註「（留空）」）：',
    '',
    `# ${dateHeader}`,
    '',
    '## 🗓️ 奇蹟日終記錄｜',
    '',
    '### 🟢 #標籤｜（以空格分隔多個 #標籤）',
    '',
    '---',
    '',
    '### 🕘 起床記錄',
    '',
    '- 起床時間：',
    '- 昨晚幾點睡 / 睡多久：',
    '- 醒來感覺（0-10）：',
    '',
    '（備註：可從散記推導，如沒有則簡述或留空）',
    '',
    '---',
    '',
    '### ☕ 精神狀態追蹤',
    '',
    '- 早上（1-10）：',
    '- 下午（1-10）：',
    '- 晚上（1-10）：',
    '- 腦霧 or 情緒爆炸：Y/N → 簡述影響與對策',
    '',
    '---',
    '',
    '### 🧘 休息紀錄',
    '',
    '- 時段：',
    '- 有無使用呼吸法？Y/N',
    '- 起身狀態（1-10）：',
    '- 是否有奇蹟瞬間：Y/N → 具體描述',
    '',
    '---',
    '',
    '### ⚙️ 任務執行',
    '',
    '- 任務項目名稱：',
    '- 是否完成：是/否',
    '- 專注感 / 進度感（1-10）：→ 短評一句',
    '',
    '---',
    '',
    '### ✨ 今日亮點',
    '',
    '- 以 3–6 條子彈列舉最具價值的成果/突破/正向經驗',
    '',
    '---',
    '',
    '### 🧩 明日想保留的行為',
    '',
    '- 以 2–3 條列出可複製的小行為/節奏',
    '',
    '---',
    '',
    '📌 **復盤語錄：**',
    '',
    '請給一句具體、有畫面的小結語錄（可幽默）。',
    '',
    '## 內容來源（散記，僅供你參考，最終輸出不要包含本段）',
    '```',
    notesAsBullets || '(本日無散記)',
    '```',
    '',
    '## 產出要求',
    '- 只輸出最終 Markdown（不要前言、不要分析）。',
    '- 使用繁體中文、保留模板各區塊標題與 emoji。',
    '- 若資訊不足，適度根據散記推斷；實在沒有就留「（留空）」。',
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
    '## 🗓️ 奇蹟日終記錄｜',
    '',
    `### 🟢 #標籤｜${tags}`,
    '',
    '---',
    '',
    '### 🕘 起床記錄',
    '',
    '- 起床時間：',
    '- 昨晚幾點睡 / 睡多久：',
    '- 醒來感覺（0-10）：',
    '    ',
    '    （備註：此為本地草稿占位，接入 AI 後會自動填充）',
    '',
    '---',
    '',
    '### ☕ 精神狀態追蹤',
    '',
    '- 早上（1-10）：',
    '- 下午（1-10）：',
    '- 晚上（1-10）：',
    '- 腦霧 or 情緒爆炸：',
    '',
    '---',
    '',
    '### 🧘 休息紀錄',
    '',
    '- 時段：',
    '- 有無使用呼吸法？',
    '- 起身狀態（1-10）：',
    '- 是否有奇蹟瞬間：',
    '',
    '---',
    '',
    '### ⚙️ 任務執行',
    '',
    '- 任務項目名稱：',
    '- 是否完成：',
    '- 專注感 / 進度感（1-10）：',
    '',
    '---',
    '',
    '### ✨ 今日亮點',
    '',
    '- （占位）',
    '',
    '---',
    '',
    '### 🧩 明日想保留的行為',
    '',
    '- （占位）',
    '',
    '---',
    '',
    '📌 **復盤語錄：**',
    '',
    '（占位）',
  ].join('\n')
}

export const DailyDefaultTemplate: TemplateSpec = {
  id: 'daily-default-zh',
  version: 1,
  name: '奇蹟日終記錄',
  lang: 'zh-Hant',
  buildPrompt: ({ dayKeyLocal, notes }) =>
    buildPromptZhHant({ dayKeyLocal, notes: notes as NoteLite[] }),
  renderLocalDraft: ({ dayKeyLocal, notes }) =>
    renderLocalDraftZhHant({ dayKeyLocal, notes: notes as NoteLite[] }),
}
