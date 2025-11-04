// src/features/records/journal/stores/journalNotes.store.ts
import { defineStore } from 'pinia'
import { LS } from '@/shared/constants/ls-keys'
import { getJSON, setJSON } from '@/shared/utils/storage'
import { toDayKeyLocal } from '../utils/dayKeyLocal'
import type { Note } from '../types/journal'

type State = {
  notes: Note[]
  maxKeep: number
}

const KEY = LS.journalNotes ?? 'nc:journal:notes'

function genId(): number {
  return Number(`${Date.now()}${Math.floor(Math.random() * 1000)}`)
}

export const useNCJournalNotesStore = defineStore('nc-journal-notes', {
  state: (): State => ({
    notes: getJSON(KEY, [] as Note[]),
    maxKeep: 2000, // 轻量上限，避免本地存储过大
  }),

  getters: {
    /** 按本地日取笔记（时间倒序） */
    listByDay:
      (s) =>
      (dayKeyLocal: string): Note[] =>
        s.notes
          .filter((x) => x.dayKeyLocal === dayKeyLocal)
          .sort((a, b) => (a.createdAtISO < b.createdAtISO ? 1 : -1)),

    /** 当日是否有笔记（用于决定是否显示“生成总结”按钮） */
    hasForDay:
      (s) =>
      (dayKeyLocal: string): boolean =>
        s.notes.some((x) => x.dayKeyLocal === dayKeyLocal),
  },

  actions: {
    load() {
      this.notes = getJSON(KEY, [] as Note[])
    },

    add(text: string, opt?: { at?: Date; tags?: string[] }) {
      const at = opt?.at ?? new Date()
      const item: Note = {
        id: genId(),
        text,
        createdAtISO: at.toISOString(),
        dayKeyLocal: toDayKeyLocal(at),
        tags: opt?.tags ?? [],
      }
      this.notes.unshift(item)
      if (this.notes.length > this.maxKeep) {
        this.notes.length = this.maxKeep
      }
      setJSON(KEY, this.notes)
      return item.id
    },

    remove(id: number) {
      this.notes = this.notes.filter((x) => x.id !== id)
      setJSON(KEY, this.notes)
    },

    clearDay(dayKeyLocal: string) {
      this.notes = this.notes.filter((x) => x.dayKeyLocal !== dayKeyLocal)
      setJSON(KEY, this.notes)
    },

    clear() {
      this.notes = []
      setJSON(KEY, this.notes)
    },

    /** 迁移辅助：为历史数据补写 dayKeyLocal 等 */
    patch(id: number, patch: Partial<Omit<Note, 'id'>>) {
      const item = this.notes.find((x) => x.id === id)
      if (!item) return
      Object.assign(item, patch)
      setJSON(KEY, this.notes)
    },
  },
})
