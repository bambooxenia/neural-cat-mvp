// src/features/records/journal/constants/registry.ts
/**
 * Template registry (constants/)
 * - Central place to register all journal summary templates.
 * - Stable API for summarize client: getTemplateSpec(templateId)
 *
 * If you previously imported from "templates/registry",
 * update imports to "constants/registry".
 */

import { DailyDefaultTemplate } from './daily-default'

export type TemplateSpec = {
  id: string
  version?: number
  name?: string
  lang?: string // e.g. "zh-Hant", "zh-CN", "en"
  buildPrompt?: (ctx: {
    dayKeyLocal: string
    notes: Array<{
      id: number
      text: string
      createdAtISO: string
      tags?: string[]
    }>
  }) => { system?: string; user: string; extras?: Record<string, unknown> }
  renderLocalDraft?: (ctx: {
    dayKeyLocal: string
    notes: Array<{
      id: number
      text: string
      createdAtISO: string
      tags?: string[]
    }>
  }) => string
}

const REGISTRY: Record<string, TemplateSpec> = {
  [DailyDefaultTemplate.id]: DailyDefaultTemplate,
}

export const DEFAULT_TEMPLATE_ID = DailyDefaultTemplate.id

/** Get a template spec by id; undefined if not found */
export function getTemplateSpec(id: string): TemplateSpec | undefined {
  return REGISTRY[id]
}

/** List all registered template specs */
export function listTemplates(): TemplateSpec[] {
  return Object.values(REGISTRY)
}
