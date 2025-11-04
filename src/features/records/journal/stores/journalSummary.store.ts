// src/features/records/journal/stores/journalSummary.store.ts
import { defineStore } from 'pinia'
import { LS } from '@/shared/constants/ls-keys'
import { getJSON, setJSON } from '@/shared/utils/storage'
import { toDayKeyLocal } from '../utils/dayKeyLocal'
import type { Summary, SummaryStatus } from '../types/journal'

type State = {
  summaries: Summary[]
}

const KEY = LS.journalSummary ?? 'nc:journal:summary'

function genId(): number {
  // 极小概率碰撞保护
  return Number(`${Date.now()}${Math.floor(Math.random() * 1000)}`)
}

export const useNCJournalSummaryStore = defineStore('nc-journal-summary', {
  state: (): State => ({
    summaries: getJSON(KEY, [] as Summary[]),
  }),

  getters: {
    /** 按本地日取当日的所有 Summaries（通常你会只保留 1 条） */
    byDay:
      (s) =>
      (dayKeyLocal: string): Summary[] =>
        s.summaries.filter((x) => x.dayKeyLocal === dayKeyLocal),

    /** 取当日最新的一条（若存在），常用于“是否已有总结”判断 */
    latestOfDay:
      (s) =>
      (dayKeyLocal: string): Summary | undefined =>
        s.summaries.find((x) => x.dayKeyLocal === dayKeyLocal),

    /** 取草稿（未确认） */
    draftOfDay:
      (s) =>
      (dayKeyLocal: string): Summary | undefined =>
        s.summaries.find((x) => x.dayKeyLocal === dayKeyLocal && x.status === 'draft'),
  },

  actions: {
    load() {
      this.summaries = getJSON(KEY, [] as Summary[])
    },

    /** 新建或覆盖“当日 + 模板”的草稿。返回该 Summary 的 id */
    upsertDraft(payload: {
      day?: Date
      dayKeyLocal?: string
      text: string // Markdown 正文
      usedNoteIds?: number[]
      templateId?: string
      templateVersion?: number
      modelMeta?: Record<string, unknown>
    }): number {
      const now = new Date()
      const nowISO = now.toISOString()
      const dayKeyLocal = payload.dayKeyLocal ?? toDayKeyLocal(payload.day ?? now)

      // 同日草稿 → 覆盖
      const existed = this.summaries.find(
        (x) => x.dayKeyLocal === dayKeyLocal && x.status === 'draft'
      )

      const base = {
        dayKeyLocal,
        text: payload.text,
        usedNoteIds: payload.usedNoteIds ?? [],
        templateId: payload.templateId,
        templateVersion: payload.templateVersion,
        modelMeta: payload.modelMeta,
      }

      if (existed) {
        existed.text = base.text
        existed.usedNoteIds = base.usedNoteIds
        existed.templateId = base.templateId
        existed.templateVersion = base.templateVersion
        existed.modelMeta = base.modelMeta
        existed.updatedAtISO = nowISO
        setJSON(KEY, this.summaries)
        return existed.id
      }

      const item: Summary = {
        id: genId(),
        status: 'draft',
        createdAtISO: nowISO,
        updatedAtISO: nowISO,
        ...base,
      }
      this.summaries.unshift(item)
      setJSON(KEY, this.summaries)
      return item.id
    },

    /** 将某草稿或成稿标记为最终确认（final） */
    markFinal(id: number): void {
      const item = this.summaries.find((x) => x.id === id)
      if (!item) return
      const now = new Date()
      item.status = 'final'
      item.updatedAtISO = now.toISOString()
      setJSON(KEY, this.summaries)
    },

    /** 直接新增一条成稿（不经过草稿阶段），主要用于从旧版迁移 */
    addFinal(payload: {
      text: string
      day?: Date
      dayKeyLocal?: string
      templateId?: string
      templateVersion?: number
      usedNoteIds?: number[]
      modelMeta?: Record<string, unknown>
    }): number {
      const now = new Date()
      const dayKeyLocal = payload.dayKeyLocal ?? toDayKeyLocal(payload.day ?? now)
      const item: Summary = {
        id: genId(),
        status: 'final',
        dayKeyLocal,
        text: payload.text,
        usedNoteIds: payload.usedNoteIds ?? [],
        templateId: payload.templateId,
        templateVersion: payload.templateVersion,
        modelMeta: payload.modelMeta,
        createdAtISO: now.toISOString(),
        updatedAtISO: now.toISOString(),
      }
      this.summaries.unshift(item)
      setJSON(KEY, this.summaries)
      return item.id
    },

    updateText(id: number, nextText: string) {
      const it = this.summaries.find((s) => s.id === id)
      if (!it) return
      it.text = nextText
      it.updatedAtISO = new Date().toISOString()
      setJSON(KEY, this.summaries)
    },

    remove(id: number) {
      this.summaries = this.summaries.filter((s) => s.id !== id)
      setJSON(KEY, this.summaries)
    },

    clear() {
      this.summaries = []
      setJSON(KEY, this.summaries)
    },

    /** 迁移辅助：为旧数据补写 dayKeyLocal 或 status 等 */
    patch(id: number, patch: Partial<Omit<Summary, 'id'>>) {
      const item = this.summaries.find((x) => x.id === id)
      if (!item) return
      Object.assign(item, patch)
      item.updatedAtISO = new Date().toISOString()
      setJSON(KEY, this.summaries)
    },

    /** 批量把某“日”的草稿全部置为最终（若你允许多模板并存时可能会用到） */
    finalizeDay(dayKeyLocal: string) {
      const nowISO = new Date().toISOString()
      for (const s of this.summaries) {
        if (s.dayKeyLocal === dayKeyLocal && s.status === 'draft') {
          s.status = 'final'
          s.updatedAtISO = nowISO
        }
      }
      setJSON(KEY, this.summaries)
    },
  },
})
