// src/features/home/mood-baits/composables/useBaitPool.ts
import { ref } from 'vue'
import { BAIT_POOL } from '@/entities/bait'
import { useUserBaitStore } from '@/features/mood-baits/stores/userBait.store'
import { useMoodCatalogStore } from '@/features/mood-baits/stores/moodCatalog.store'
// 仅引入类型，避免产生运行时依赖
import type { UIBait } from '@/features/mood-baits/stores/moodSession.store'

/** 用于合并阶段的最小诱饵形态（不关心 minutes/kind 等额外字段） */
type BasicBait = { title: string; mood: readonly string[] }

/** 去空 + 去重（保序） */
function uniq<T>(arr: readonly T[]): T[] {
  const seen = new Set<unknown>()
  const out: T[] = []
  for (const x of arr) {
    if (seen.has(x as any)) continue
    seen.add(x as any)
    out.push(x)
  }
  return out
}

/** 归一化心情数组：字符串化→trim→resolver→去空→去重（保序） */
function normalizeMoods(arr: readonly unknown[], resolver: (k: string) => string): string[] {
  const mapped = arr.map((v) => resolver(String(v ?? '').trim())).filter((v) => !!v)
  return uniq(mapped)
}

/** 组合成稳定 key（用于“我的优先”去重）：title + '__' + moods.join(',') */
function baitKey(title: string, moods: readonly string[]): string {
  return `${title}__${moods.join(',')}`
}

/**
 * 合并系统诱饵池与用户诱饵：
 * - 所有 mood 先经 resolver 归一化
 * - 丢弃 mood 为空的条目
 * - 去重规则：同 title+同（归一化后）mood → “我的”优先，系统副本被忽略
 *
 * 输出：allBaits（给 session.drawBait 使用的极简结构）与 rebuild()。
 * 注意：不做按心情过滤，过滤由 session.drawBait(allBaits, byMood) 负责。
 */
export function useBaitPool() {
  const catalog = useMoodCatalogStore()
  const userBait = useUserBaitStore()

  const allBaits = ref<UIBait[]>([])

  function rebuild(custom?: {
    resolver?: (k: string) => string
    systemPool?: readonly BasicBait[]
    userPool?: readonly BasicBait[]
  }) {
    const resolver = custom?.resolver ?? catalog.resolveKey
    // 系统池：只取最小字段
    const systemPool: readonly BasicBait[] =
      custom?.systemPool ?? BAIT_POOL.map<BasicBait>((c) => ({ title: c.title, mood: c.mood }))
    // 我的诱饵：store → BasicBait
    const userPool: readonly BasicBait[] =
      custom?.userPool ?? userBait.list.map<BasicBait>((b) => ({ title: b.title, mood: b.mood }))

    // 先塞“我的”，再用系统补齐（我的优先，基于稳定 key 去重）
    const map = new Map<string, UIBait>()

    // 塞“我的”
    for (const b of userPool) {
      const moods = normalizeMoods(b.mood, resolver)
      if (!b.title || moods.length === 0) continue
      map.set(baitKey(b.title, moods), { title: b.title, mood: moods })
    }

    // 再塞“系统”，不存在才补
    for (const b of systemPool) {
      const moods = normalizeMoods(b.mood, resolver)
      if (!b.title || moods.length === 0) continue
      const key = baitKey(b.title, moods)
      if (!map.has(key)) {
        map.set(key, { title: b.title, mood: moods })
      }
    }

    // 稳定输出：按 title 再按首个 mood 排序，避免动画/抽取时顺序抖动
    const next = Array.from(map.values()).sort((a, b) => {
      if (a.title !== b.title) return a.title.localeCompare(b.title)
      const am = a.mood[0] || ''
      const bm = b.mood[0] || ''
      return am.localeCompare(bm)
    })

    allBaits.value = next
  }

  return {
    /** 合并后的诱饵池（已归一化、去重，“我的优先”） */
    allBaits,
    /** 手动重建池（建议在 onMounted 及相关 watch 中调用） */
    rebuild,
  }
}
