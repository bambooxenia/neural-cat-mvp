// src/shared/composables/useDayGroups.ts
import { computed } from 'vue'

type Journal = { id:number; dateISO:string; text:string }
type Sticker = { id:number; dateISO:string; kaomoji:string }

export function useDayGroups(journal: Journal[], stickers: Sticker[]) {
  const groups = computed(() => {
    const map = new Map<string, { key:string; journal:Journal[]; stickers:Sticker[] }>()
    const ensure = (k:string) => map.get(k) ?? (map.set(k, { key:k, journal:[], stickers:[] }), map.get(k)!)
    const key = (iso:string) => iso.slice(0,10)

    for (const s of stickers) ensure(key(s.dateISO)).stickers.push(s)
    for (const j of journal)  ensure(key(j.dateISO)).journal.push(j)

    // 倒序（新日期在前），同一天内再按时间倒序
    const res = Array.from(map.values()).sort((a,b) => (a.key < b.key ? 1 : -1))
    res.forEach(g => g.journal.sort((a,b) => (a.dateISO < b.dateISO ? 1 : -1)))
    return res
  })
  return { groups }
}
