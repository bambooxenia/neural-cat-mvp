// src/features/home/mood-baits/stores/moodSession.store.ts
import { defineStore } from 'pinia'
import type { MoodKey } from '@/entities/mood'
import { UI_MOOD_KEYS } from '@/entities/mood'
import * as repo from '@/features/mood-baits/data/mood.repo'
import {
  normalizeOnSetMood,
  resolveCurrentAfterRemoval,
} from '@/features/mood-baits/services/mood.service'
import { useMoodCatalogStore } from '@/features/mood-baits/stores/moodCatalog.store'
import { useUserBaitStore } from '@/features/mood-baits/stores/userBait.store'
import { useRewardTokensStore } from '@/features/reward/stores/rewardTokens.store'

/** 诱饵项的最小约束：包含 mood 标签数组即可；其余字段保持透明传递 */
type BaitLike = { mood: readonly (MoodKey | string)[] }

/** 会话内使用的诱饵结构（最小：title + mood[]） */
export type UIBait = BaitLike & { title: string }

/* --------------------------------- 工具 --------------------------------- */
/** 过滤池：byMood 为空则返回全部；先按包含过滤，空则回退全部 */
function filterBaitPool<T extends BaitLike>(allBaits: readonly T[], byMood?: string | null): T[] {
  const key = String(byMood ?? '').trim()
  if (!key) return allBaits.slice()
  const filtered = allBaits.filter((b) => Array.isArray(b.mood) && b.mood.includes(key))
  return filtered.length ? filtered : allBaits.slice()
}

/** 计算初始心情（仅模块初始化时用一次） */
function computeInitialMood(): string {
  const saved = repo.getCurrentMood()
  return normalizeOnSetMood(saved, UI_MOOD_KEYS, UI_MOOD_KEYS)
}

/** 稳定键：title + 归一化去重并排序后的 mood 集合 */
function makeBaitKey(b: Pick<UIBait, 'title' | 'mood'>, resolver: (k: string) => string) {
  const title = String(b.title || '')
  const moods = Array.from(new Set((b.mood ?? []).map((m) => resolver(String(m))).filter(Boolean)))
  moods.sort()
  return `${title}__${moods.join(',')}`
}

function now() {
  return Date.now()
}
function makeSessionId() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    d.getFullYear() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    '-' +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds()) +
    '-' +
    Math.random().toString(36).slice(2, 6)
  )
}
function snapshot<T>(obj: T): T {
  return { ...(obj as any) }
}
function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}
function yyyy_mm_dd(d = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/* --------------------------------- 统计与持久化键 --------------------------------- */
const LS_BAIT_STATS_V1 = 'NC_BAIT_STATS_V1'
const LS_BAIT_EXIT_DEBT_V1 = 'NC_BAIT_EXIT_DEBT_V1'
const LS_BAIT_REROLL_RUN_V1 = 'NC_BAIT_REROLL_RUN_V1'
const LS_ACTIVE_BAIT_SESSION_V1 = 'NC_ACTIVE_BAIT_SESSION_V1'

/* 今日统计 */
type DayStats = {
  date: string
  draws: number
  rerolls: number
  exitsCharged: number
  finishes: number
}
type StatsStore = Record<string, DayStats>
function loadStats(): StatsStore {
  try {
    const raw = localStorage.getItem(LS_BAIT_STATS_V1)
    return raw ? (JSON.parse(raw) as StatsStore) : {}
  } catch {
    return {}
  }
}
function saveStats(stats: StatsStore) {
  try {
    localStorage.setItem(LS_BAIT_STATS_V1, JSON.stringify(stats))
  } catch {}
}
function bumpToday(field: keyof DayStats, step = 1) {
  const stats = loadStats()
  const key = yyyy_mm_dd()
  const cur = stats[key] ?? { date: key, draws: 0, rerolls: 0, exitsCharged: 0, finishes: 0 }
  // @ts-expect-error runtime narrow
  cur[field] = Math.max(0, Number(cur[field] ?? 0) + step)
  stats[key] = cur
  saveStats(stats)
  return cur
}

/* 退出欠费（Baits 自管，不收敛到 wallet） */
function loadExitDebt(): number {
  try {
    const raw = localStorage.getItem(LS_BAIT_EXIT_DEBT_V1)
    return raw ? Math.max(0, Number(raw)) : 0
  } catch {
    return 0
  }
}
function saveExitDebt(n: number) {
  try {
    localStorage.setItem(LS_BAIT_EXIT_DEBT_V1, String(Math.max(0, Math.floor(n))))
  } catch {}
}

/* 换卡“历程 run”（跨会话不刷新，直到完成前有效） */
const REROLL_LIMIT_DEFAULT = 3
const REROLL_COST_TOKEN_DEFAULT = 1
const EXIT_COST_TOKEN_DEFAULT = 1

type RerollRun = {
  active: boolean
  used: number
  limit: number
  startedAt?: number
}
function readRun(): RerollRun {
  try {
    const raw = localStorage.getItem(LS_BAIT_REROLL_RUN_V1)
    if (!raw) return { active: false, used: 0, limit: REROLL_LIMIT_DEFAULT }
    const data = JSON.parse(raw) as Partial<RerollRun>
    return {
      active: !!data.active,
      used: Math.max(0, Math.floor(data.used ?? 0)),
      limit: Math.max(0, Math.floor(data.limit ?? REROLL_LIMIT_DEFAULT)),
      startedAt: data.startedAt ?? undefined,
    }
  } catch {
    return { active: false, used: 0, limit: REROLL_LIMIT_DEFAULT }
  }
}
function writeRun(run: RerollRun) {
  try {
    localStorage.setItem(LS_BAIT_REROLL_RUN_V1, JSON.stringify(run))
  } catch {}
}
function startRunIfNeeded(run: RerollRun): RerollRun {
  if (run.active) return run
  const next: RerollRun = { active: true, used: 0, limit: REROLL_LIMIT_DEFAULT, startedAt: now() }
  writeRun(next)
  return next
}
function resetRun(): RerollRun {
  const next: RerollRun = { active: false, used: 0, limit: REROLL_LIMIT_DEFAULT }
  writeRun(next)
  return next
}

/* 未完成会话持久化（离开再进恢复同一张卡） */
type SessionState = 'IDLE' | 'DRAWN' | 'ACCEPTED' | 'COMPLETED' | 'ABANDONED'
type Session = {
  id: string
  state: SessionState
  selectedTypeAtDraw: string
  current: UIBait | null
  drawnKeys: string[]
  rerollLimit: number
  rerollUsed: number
  rerollCostToken: number
  exitCostToken: number
  spentTokens: number
  acceptedAt?: number
  completedAt?: number
}
type PersistedSession = Pick<
  Session,
  | 'id'
  | 'state'
  | 'selectedTypeAtDraw'
  | 'current'
  | 'drawnKeys'
  | 'rerollLimit'
  | 'rerollUsed'
  | 'rerollCostToken'
  | 'exitCostToken'
  | 'spentTokens'
  | 'acceptedAt'
  | 'completedAt'
>

function saveActiveSession(s: Session) {
  if (!s.current || (s.state !== 'DRAWN' && s.state !== 'ACCEPTED')) return
  const snap: PersistedSession = {
    id: s.id,
    state: s.state,
    selectedTypeAtDraw: s.selectedTypeAtDraw,
    current: snapshot(s.current),
    drawnKeys: [...s.drawnKeys],
    rerollLimit: s.rerollLimit,
    rerollUsed: s.rerollUsed,
    rerollCostToken: s.rerollCostToken,
    exitCostToken: s.exitCostToken,
    spentTokens: s.spentTokens,
    acceptedAt: s.acceptedAt,
    completedAt: s.completedAt,
  }
  try {
    localStorage.setItem(LS_ACTIVE_BAIT_SESSION_V1, JSON.stringify(snap))
  } catch {}
}
function loadActiveSession(): PersistedSession | null {
  try {
    const raw = localStorage.getItem(LS_ACTIVE_BAIT_SESSION_V1)
    return raw ? (JSON.parse(raw) as PersistedSession) : null
  } catch {
    return null
  }
}
function clearActiveSession() {
  try {
    localStorage.removeItem(LS_ACTIVE_BAIT_SESSION_V1)
  } catch {}
}

/* --------------------------------- 结果类型 --------------------------------- */
type DrawResult =
  | { ok: true; data: { bait: UIBait } }
  | { ok: false; reason: 'active_session' | 'empty_pool' }
type VoidResult =
  | { ok: true }
  | {
      ok: false
      reason:
        | 'no_task_to_accept'
        | 'not_in_drawn'
        | 'reroll_exhausted'
        | 'pool_depleted'
        | 'insufficient_tokens'
        | 'token_spend_failed'
        | 'no_need_to_charge'
        | 'no_need_to_debt'
        | 'already_completed'
        | 'not_accepted'
    }

/* --------------------------------- Store --------------------------------- */
export const useMoodSessionStore = defineStore('mood-session', {
  state: () => ({
    /** 当前选择的心情（允许自定义键，因此用 string） */
    currentMood: computeInitialMood() as string,

    /** 会话状态（Task 风格） */
    session: {
      id: '',
      state: 'IDLE' as SessionState,
      selectedTypeAtDraw: '',
      current: null as UIBait | null,
      drawnKeys: [] as string[],
      rerollLimit: REROLL_LIMIT_DEFAULT,
      rerollUsed: 0,
      rerollCostToken: REROLL_COST_TOKEN_DEFAULT,
      exitCostToken: EXIT_COST_TOKEN_DEFAULT,
      spentTokens: 0,
    } as Session,

    /** 跨会话换卡历程（直到 finish 前都不重置） */
    run: readRun(),
  }),

  getters: {
    /** 页面：是否可抽卡 */
    canDraw: (s): boolean => ['IDLE', 'COMPLETED', 'ABANDONED'].includes(s.session.state),
    /** 页面：是否可接受（开始计时前的隐式接受） */
    canAccept: (s): boolean => s.session.state === 'DRAWN' && !!s.session.current,

    /** 换卡限制（run 控制；离开/回来不刷新次数） */
    canReroll: (s): boolean => {
      if (s.session.state !== 'DRAWN') return false
      return s.run.used < s.run.limit
    },

    /** 完成条件：必须在 ACCEPTED */
    canFinish: (s): boolean => s.session.state === 'ACCEPTED',

    /** 剩余换卡次数（历程维度） */
    rerollLeft: (s): number => Math.max(0, s.run.limit - s.run.used),

    /** 未完成前离开是否需要扣费 */
    shouldChargeOnExit: (s): boolean => {
      const st = s.session.state
      if (!s.session.current) return false
      if (st === 'DRAWN' || st === 'ACCEPTED') return true
      return false
    },

    /** 是否有活动卡（用于 UI 判断） */
    hasActiveCard: (s): boolean =>
      !!s.session.current && (s.session.state === 'DRAWN' || s.session.state === 'ACCEPTED'),
  },

  actions: {
    /** 进入页面时的“会话态还原”与类型校验（同类型恢复，异类型保持/回抽） */
    rehydrateActive(): VoidResult {
      const catalog = useMoodCatalogStore()
      const resolver = (k: string) => catalog.resolveKey(String(k))
      const curType = resolver(this.currentMood)

      // 若内存中已有未完成会话且类型不一致，软重置为 IDLE（不影响 run，也不清除本地未完成快照）
      if (
        (this.session.state === 'DRAWN' || this.session.state === 'ACCEPTED') &&
        this.session.selectedTypeAtDraw &&
        this.session.selectedTypeAtDraw !== curType
      ) {
        this.reset() // 不影响 run
      }

      const ps = loadActiveSession()
      if (!ps) return { ok: true }

      const psType = (ps.selectedTypeAtDraw ?? '').trim()
      const match = (curType && psType && curType === psType) || (!curType && !psType) // 两者都为空也视为匹配（全局池）

      if (!match) {
        // 类型不同：不恢复，保留快照以便回到原类型时继续
        return { ok: true }
      }

      this.session = {
        id: ps.id,
        state: ps.state,
        selectedTypeAtDraw: ps.selectedTypeAtDraw,
        current: snapshot(ps.current),
        drawnKeys: [...ps.drawnKeys],
        rerollLimit: ps.rerollLimit,
        rerollUsed: ps.rerollUsed,
        rerollCostToken: ps.rerollCostToken,
        exitCostToken: ps.exitCostToken,
        spentTokens: ps.spentTokens,
        acceptedAt: ps.acceptedAt,
        completedAt: ps.completedAt,
      }
      return { ok: true }
    },

    /** 启动/进入页面时的“心情还原”与安全回退 */
    hydrate(allKeys?: readonly string[]) {
      const catalog = safeGetCatalogKeys()
      const legal = allKeys && allKeys.length > 0 ? allKeys : catalog ?? UI_MOOD_KEYS
      const saved = repo.getCurrentMood()
      const next = normalizeOnSetMood(saved, legal, UI_MOOD_KEYS)
      if (next !== this.currentMood) {
        this.currentMood = repo.saveCurrentMood(next as any)
      }
    },

    /** 设置当前心情并写入存储 */
    setMood(m: string) {
      const mood = String(m ?? '').trim()
      if (!mood) return
      this.currentMood = repo.saveCurrentMood(mood as any)
    },

    /** 开始新会话（或在已完成/放弃后重开） */
    draw(): DrawResult {
      if (!this.canDraw) return { ok: false, reason: 'active_session' }

      const catalog = useMoodCatalogStore()
      const userBait = useUserBaitStore()
      const resolver = (k: string) => catalog.resolveKey(String(k))
      const t = resolver(this.currentMood)

      // 构造池：你在页面已做 normalize & seed，store 这里直接用用户池（已含默认）
      const pool = filterBaitPool(userBait.list as unknown as UIBait[], t)
      if (!pool.length) {
        this.reset()
        return { ok: false, reason: 'empty_pool' }
      }

      const bait = pickRandom(pool)

      // 启动/延续“换卡历程”：离开回来不会重置 used
      this.run = startRunIfNeeded(this.run)

      const key = makeBaitKey(bait, resolver)

      this.session = {
        id: makeSessionId(),
        state: 'DRAWN',
        selectedTypeAtDraw: t,
        current: snapshot(bait),
        drawnKeys: [key],
        rerollLimit: REROLL_LIMIT_DEFAULT, // UI 兼容
        rerollUsed: 0, // 本页内计数（可做诊断用）
        rerollCostToken: REROLL_COST_TOKEN_DEFAULT,
        exitCostToken: EXIT_COST_TOKEN_DEFAULT,
        spentTokens: 0,
      }

      bumpToday('draws', 1)
      saveActiveSession(this.session)

      return { ok: true, data: { bait: this.session.current! } }
    },

    /** 明确接受当前卡（锁定换卡；开始计时前隐式调用） */
    accept(): VoidResult {
      if (this.session.state !== 'DRAWN' || !this.session.current) {
        return { ok: false, reason: 'no_task_to_accept' }
      }
      this.session.state = 'ACCEPTED'
      this.session.acceptedAt = now()
      saveActiveSession(this.session)
      return { ok: true }
    },

    /** 换卡：受“历程 run”限制；离开回来不会刷新 */
    reroll(): DrawResult | VoidResult {
      if (this.session.state !== 'DRAWN' || !this.session.current) {
        return { ok: false, reason: 'not_in_drawn' }
      }

      const runLeft = this.run.limit - this.run.used
      if (runLeft <= 0) {
        return { ok: false, reason: 'reroll_exhausted' }
      }

      const catalog = useMoodCatalogStore()
      const userBait = useUserBaitStore()
      const wallet = useRewardTokensStore()
      const resolver = (k: string) => catalog.resolveKey(String(k))
      const t = this.session.selectedTypeAtDraw
      const pool = filterBaitPool(userBait.list as unknown as UIBait[], t)

      const curKey = makeBaitKey(this.session.current!, resolver)
      const candidates = pool.filter((p) => makeBaitKey(p, resolver) !== curKey)
      // 继续避免重复抽到“已抽过的”同一天内卡（与任务页语义对齐）
      const candidatesNotDrawn = candidates.filter(
        (p) => !this.session.drawnKeys.includes(makeBaitKey(p, resolver))
      )
      const finalCandidates = candidatesNotDrawn.length ? candidatesNotDrawn : candidates
      if (finalCandidates.length < 1) {
        return { ok: false, reason: 'pool_depleted' }
      }

      if (wallet.balance < this.session.rerollCostToken) {
        return { ok: false, reason: 'insufficient_tokens' }
      }

      try {
        wallet.spend(this.session.rerollCostToken)
      } catch {
        return { ok: false, reason: 'token_spend_failed' }
      }
      this.session.spentTokens += this.session.rerollCostToken
      this.session.rerollUsed += 1

      // 累计到 run，并持久化
      this.run.used = Math.min(this.run.limit, this.run.used + 1)
      writeRun(this.run)

      bumpToday('rerolls', 1)

      // 选择新卡
      const pick = pickRandom(finalCandidates)
      this.session.current = snapshot(pick)
      this.session.drawnKeys.push(makeBaitKey(pick, resolver))

      saveActiveSession(this.session)
      return { ok: true, data: { bait: this.session.current! } }
    },

    /** 退出扣费（换卡后再“返回”也要扣），并累计“今日退出扣费次数” */
    chargeExit(): VoidResult {
      if (!this.session.current || !['DRAWN', 'ACCEPTED'].includes(this.session.state)) {
        return { ok: false, reason: 'no_need_to_charge' }
      }
      const wallet = useRewardTokensStore()
      const cost = this.session.exitCostToken
      if (wallet.balance < cost) return { ok: false, reason: 'insufficient_tokens' }
      try {
        wallet.spend(cost)
      } catch {
        return { ok: false, reason: 'token_spend_failed' }
      }
      this.session.spentTokens += cost
      bumpToday('exitsCharged', 1)
      // 不改变 session 状态，交由路由离开后再处理
      return { ok: true }
    },

    /** 记录一次异常强退欠费 +1（Baits 自管） */
    recordExitDebt(): VoidResult {
      if (!this.session.current || !['DRAWN', 'ACCEPTED'].includes(this.session.state)) {
        return { ok: false, reason: 'no_need_to_debt' }
      }
      const cur = loadExitDebt()
      saveExitDebt(cur + 1)
      return { ok: true }
    },

    /** 尝试结清欠费（逐笔用 wallet.spend 抵扣），不足则返回剩余欠费 */
    settleExitDebt(): { ok: boolean; leftDebt: number; reason?: string } {
      let debt = loadExitDebt()
      if (debt <= 0) return { ok: true, leftDebt: 0 }

      const wallet = useRewardTokensStore()
      while (debt > 0) {
        if (wallet.balance < this.session.exitCostToken) break
        try {
          wallet.spend(this.session.exitCostToken)
        } catch {
          break
        }
        debt -= 1
        this.session.spentTokens += this.session.exitCostToken
        bumpToday('exitsCharged', 1)
      }

      saveExitDebt(debt)
      return debt === 0
        ? { ok: true, leftDebt: 0 }
        : { ok: false, leftDebt: debt, reason: 'insufficient_tokens' }
    },

    /** 完成（完成时重置“换卡历程”，并清除未完成会话快照） */
    finish(): VoidResult {
      const { state, current } = this.session
      if (state === 'COMPLETED') {
        return { ok: false, reason: 'already_completed' }
      }
      if (state !== 'ACCEPTED' || !current) {
        return { ok: false, reason: 'not_accepted' }
      }

      this.session.state = 'COMPLETED'
      this.session.completedAt = now()

      bumpToday('finishes', 1)

      // 只有完成时才重置换卡历程（避免“返回重进刷新换卡次数”被绕过）
      this.run = resetRun()

      // 清除未完成会话快照
      clearActiveSession()
      this.session.current = null
      this.session.drawnKeys = []
      this.session.selectedTypeAtDraw = ''

      return { ok: true }
    },

    /** 放弃本轮（不退还已花费代币）——不重置 run；如需不再恢复，可清除快照 */
    abandon(): VoidResult {
      if (!['DRAWN', 'ACCEPTED'].includes(this.session.state)) {
        return { ok: false, reason: 'nothing_to_abandon' } as any
      }
      this.session.state = 'ABANDONED'
      // 如希望放弃后不再恢复，解开下一行：
      // clearActiveSession()
      return { ok: true }
    },

    /** 软重置会话（不影响 run，不清除本地未完成快照） */
    reset(): VoidResult {
      this.session = {
        id: '',
        state: 'IDLE',
        selectedTypeAtDraw: '',
        current: null,
        drawnKeys: [],
        rerollLimit: REROLL_LIMIT_DEFAULT,
        rerollUsed: 0,
        rerollCostToken: REROLL_COST_TOKEN_DEFAULT,
        exitCostToken: EXIT_COST_TOKEN_DEFAULT,
        spentTokens: 0,
      }
      return { ok: true }
    },

    /** 当目录列表变化时，保证 currentMood 合法；如回退则清空当前卡 */
    reconcileCurrentAfterCatalogChanged(nextList: readonly string[]) {
      const next = resolveCurrentAfterRemoval(this.currentMood, nextList, UI_MOOD_KEYS)
      if (next !== this.currentMood) {
        this.currentMood = repo.saveCurrentMood(next as any) // 仅保存 current，不动列表
        // 心情被动变化 → 当前类型可能不匹配，清空当前卡
        this.reset()
      }
    },
  },
})

/** 尝试从 catalog 取得可见键列表，失败时返回 undefined（回退到官方6种） */
function safeGetCatalogKeys(): readonly string[] | undefined {
  try {
    const catalog = useMoodCatalogStore()
    const list = catalog?.moodList ?? []
    return Array.isArray(list) && list.length > 0 ? list : undefined
  } catch {
    return undefined
  }
}
