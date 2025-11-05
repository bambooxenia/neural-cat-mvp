// src/features/mood-baits/composables/useReroll.ts
import { computed } from 'vue'
import { useMoodSessionStore } from '@/features/mood-baits/stores/moodSession.store'

/**
 * 兼容层：迁移后不再在 composable 中维护“换卡历程（run）”。
 * - rerollLeft / canReroll / hasCard：全部来自 store
 * - hydrate / afterDrawHook / consumeOne / clear：保留方法签名，但为 no-op
 * - currentKey：仍提供用于生成“当前卡稳定键”的工具
 *
 * 建议新代码直接使用 store 的 API（draw/accept/reroll/finish、rerollLeft、canReroll 等）。
 */
export type UseRerollOptions = {
  /** 取得当前诱饵卡（至少包含 title、mood 数组）；为兼容旧代码保留 */
  getCurrentBait: () => { title?: string; mood?: string[] } | null | undefined
  /** 心情 key 归一化函数（store/catelog 的 resolver） */
  resolver: (mood: string) => string
  /** 兼容旧参数：不再生效（限制来自 store.run.limit） */
  max?: number
}

export function useReroll(options: UseRerollOptions) {
  const { getCurrentBait, resolver } = options
  const session = useMoodSessionStore()

  /** 是否已有卡 */
  const hasCard = computed(() => !!session.session.current)

  /** 是否可换卡（由 store 控制：state==='DRAWN' && run.used<run.limit） */
  const canReroll = computed(() => session.canReroll)

  /** 剩余换卡次数（来自 store.run.limit - run.used） */
  const rerollLeft = computed(() => session.rerollLeft)

  /**
   * 生成“当前卡稳定键”：title + 归一化去重并排序后的 mood 列表
   * 用于页面层面的键绑定（例如倒计时的本地持久化主键）
   */
  function currentKey(): string {
    type B = { title?: string; mood?: readonly (string | import('@/entities/mood').UIMood)[] }

    const b = (getCurrentBait?.() ?? null) as B | null
    if (!b) return ''

    const title = String(b.title ?? '')

    const moods = Array.from(
      new Set(
        (b.mood ?? [])
          .map((m: string | import('@/entities/mood').UIMood) => resolver(String(m)))
          .filter((x): x is string => Boolean(x))
      )
    ).sort()

    return `${title}__${moods.join(',')}`
  }

  /** 兼容性空操作：store 已自行处理 run 的恢复 */
  function hydrate() {
    // no-op：运行时由 store 的 rehydrateActive()/readRun() 等完成
  }

  /** 兼容性空操作：迁移后不再在“抽到后重置次数”；store 在 finish() 时重置 run */
  function afterDrawHook() {
    // no-op：保留以兼容旧调用点
  }

  /** 兼容性空操作：迁移后扣次由 store.reroll() 内部完成 */
  function consumeOne(_key?: string | null) {
    // no-op
  }

  /** 兼容性空操作：迁移后清空 run 由 store.finish() 触发 */
  function clear() {
    // no-op
  }

  return {
    // 主要状态（来自 store）
    rerollLeft,
    hasCard,
    canReroll,

    // 兼容方法（多数为 no-op）
    hydrate,
    afterDrawHook,
    consumeOne,
    clear,

    // 工具
    currentKey,
  }
}

/* ------------------------------ helpers ------------------------------ */
function safeGetBait(this: void, b?: { title?: string; mood?: string[] } | null) {
  try {
    return typeof b === 'function' ? (b as any)() : b
  } catch {
    return null
  }
}
