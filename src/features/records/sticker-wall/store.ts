// src/features/records/sticker-wall/store.ts
import { defineStore } from 'pinia'
import { LS } from '@/shared/constants/ls-keys'
import { getJSON, setJSON } from '@/shared/utils/storage'
import { sameDay } from '@/shared/utils/common'

export interface Sticker {
  id: number
  dateISO: string
  kaomoji: string
}

type State = {
  stickers: Sticker[]
  maxKeep: number
}

export const useNCStickerStore = defineStore('nc-sticker', {
  state: (): State => ({
    stickers: getJSON(LS.stickers, [] as Sticker[]),
    maxKeep: 200,
  }),

  getters: {
    /** 当天第一个贴纸（移动端首页快速展示） */
    todaySticker: (s: State): string => {
      const today = new Date()
      const item = s.stickers.find((x: Sticker) =>
        sameDay(new Date(x.dateISO), today)
      )
      return item?.kaomoji ?? ''
    },

    /** 爪印墙：按天分组（倒序） */
    groupByDate: (s: State): Array<[string, Sticker[]]> => {
      const map = new Map<string, Sticker[]>()
      for (const st of s.stickers) {
        const d = st.dateISO.slice(0, 10)
        if (!map.has(d)) map.set(d, [])
        map.get(d)!.push(st)
      }
      return Array.from(map.entries()).sort(([a], [b]) => (a < b ? 1 : -1))
    },
  },

  actions: {
    load() {
      this.stickers = getJSON(LS.stickers, [] as Sticker[])
    },

    add(kaomoji: string) {
      const item: Sticker = {
        id: Date.now(),
        dateISO: new Date().toISOString(),
        kaomoji,
      }
      // 移动端交互习惯：最新在前
      this.stickers.unshift(item)

      // 控制上限
      if (this.stickers.length > this.maxKeep) this.stickers.length = this.maxKeep

      setJSON(LS.stickers, this.stickers)

      // metrics 统计（如需接入请在 providers 中统一订阅或在此处调用）
      // 例：useNCMetricStore().save(1)
    },

    remove(id: number) {
      this.stickers = this.stickers.filter((s) => s.id !== id)
      setJSON(LS.stickers, this.stickers)
    },

    clear() {
      this.stickers = []
      setJSON(LS.stickers, this.stickers)
    },
  },
})
