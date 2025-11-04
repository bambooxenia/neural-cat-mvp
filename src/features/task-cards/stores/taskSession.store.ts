// src/features/task-cards/stores/taskSession.store.ts
import { defineStore } from 'pinia'
import type { TaskCard } from '@/entities/task'
import { useTaskCatalogStore } from '@/features/task-cards/stores/taskCatalog.store'

// 贴纸余额（换卡 / 退出消耗）
import { useRewardTokensStore } from '@/features/reward/stores/rewardTokens.store'

// 埋点 API：仅保留换卡的 emitAppEvent，其余改为语义化
import { emitAppEvent, logTaskCompleted } from '@/app/analytics'

type SessionState = 'IDLE' | 'DRAWN' | 'ACCEPTED' | 'COMPLETED' | 'ABANDONED'

type DrawResult = { ok: true; data: { task: TaskCard } } | { ok: false; reason: string }
type VoidResult = { ok: true } | { ok: false; reason: string }

const REROLL_LIMIT_DEFAULT = 3
const REROLL_COST_TOKEN_DEFAULT = 1
/** 退出也要收费 */
const EXIT_COST_TOKEN_DEFAULT = 1

/** 统计 / 欠费 / 跨会话限制 */
const LS_TASK_STATS_V1 = 'NC_TASK_STATS_V1'
const LS_EXIT_DEBT_V1 = 'NC_TASK_EXIT_DEBT_V1'
const LS_REROLL_RUN_V1 = 'NC_TASK_REROLL_RUN_V1'
const LS_ACTIVE_SESSION_V1 = 'NC_TASK_ACTIVE_SESSION_V1'

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

/* -------------------- 今日统计 -------------------- */
type DayStats = { date: string; draws: number; rerolls: number; exitsCharged: number; finishes: number }
type StatsStore = Record<string, DayStats>
function loadStats(): StatsStore {
  try {
    const raw = localStorage.getItem(LS_TASK_STATS_V1)
    return raw ? (JSON.parse(raw) as StatsStore) : {}
  } catch {
    return {}
  }
}
function saveStats(stats: StatsStore) {
  try {
    localStorage.setItem(LS_TASK_STATS_V1, JSON.stringify(stats))
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

/* -------------------- 退出欠费 -------------------- */
function loadExitDebt(): number {
  try {
    const raw = localStorage.getItem(LS_EXIT_DEBT_V1)
    return raw ? Math.max(0, Number(raw)) : 0
  } catch {
    return 0
  }
}
function saveExitDebt(n: number) {
  try {
    localStorage.setItem(LS_EXIT_DEBT_V1, String(Math.max(0, Math.floor(n))))
  } catch {}
}

/* -------------------- 跨会话“换卡历程”（直到完成前有效） -------------------- */
type RerollRun = {
  active: boolean
  used: number
  limit: number
  startedAt?: number
}
function readRun(): RerollRun {
  try {
    const raw = localStorage.getItem(LS_REROLL_RUN_V1)
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
    localStorage.setItem(LS_REROLL_RUN_V1, JSON.stringify(run))
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

/* -------------------- 未完成会话持久化（离开再进恢复同一张卡） -------------------- */
type Session = {
  id: string
  state: SessionState
  selectedTypeAtDraw: string
  current: TaskCard | null
  drawnIds: number[]
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
  | 'drawnIds'
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
    drawnIds: [...s.drawnIds],
    rerollLimit: s.rerollLimit,
    rerollUsed: s.rerollUsed,
    rerollCostToken: s.rerollCostToken,
    exitCostToken: s.exitCostToken,
    spentTokens: s.spentTokens,
    acceptedAt: s.acceptedAt,
    completedAt: s.completedAt,
  }
  try {
    localStorage.setItem(LS_ACTIVE_SESSION_V1, JSON.stringify(snap))
  } catch {}
}
function loadActiveSession(): PersistedSession | null {
  try {
    const raw = localStorage.getItem(LS_ACTIVE_SESSION_V1)
    return raw ? (JSON.parse(raw) as PersistedSession) : null
  } catch {
    return null
  }
}
function clearActiveSession() {
  try {
    localStorage.removeItem(LS_ACTIVE_SESSION_V1)
  } catch {}
}

/* -------------------- Pinia -------------------- */
type State = {
  session: Session
  /** 跨会话换卡历程（直到 finish 前都不重置） */
  run: RerollRun
}

export const useTaskSessionStore = defineStore('task-session', {
  state: (): State => ({
    session: {
      id: '',
      state: 'IDLE',
      selectedTypeAtDraw: '',
      current: null,
      drawnIds: [],
      rerollLimit: REROLL_LIMIT_DEFAULT,
      rerollUsed: 0,
      rerollCostToken: REROLL_COST_TOKEN_DEFAULT,
      exitCostToken: EXIT_COST_TOKEN_DEFAULT,
      spentTokens: 0,
    },
    run: readRun(),
  }),

  getters: {
    canDraw: (s): boolean => ['IDLE', 'COMPLETED', 'ABANDONED'].includes(s.session.state),
    canAccept: (s): boolean => s.session.state === 'DRAWN' && !!s.session.current,

    /** 换卡限制由“历程 run”控制；离开/回来也不刷新次数 */
    canReroll: (s): boolean => {
      if (s.session.state !== 'DRAWN') return false
      return s.run.used < s.run.limit
    },

    canFinish: (s): boolean => s.session.state === 'ACCEPTED',

    /** 剩余换卡次数：历程维度 */
    rerollLeft: (s): number => Math.max(0, s.run.limit - s.run.used),

    /** 未完成前离开是否需要扣费 */
    shouldChargeOnExit: (s): boolean => {
      const st = s.session.state
      if (!s.session.current) return false
      if (st === 'DRAWN' || st === 'ACCEPTED') return true
      return false
    },

    exitCost: (s): number => s.session.exitCostToken,

    statsToday: (): DayStats => {
      const stats = loadStats()
      const key = yyyy_mm_dd()
      return stats[key] ?? { date: key, draws: 0, rerolls: 0, exitsCharged: 0, finishes: 0 }
    },

    hasActiveCard: (s): boolean =>
      !!s.session.current && (s.session.state === 'DRAWN' || s.session.state === 'ACCEPTED'),
  },

  actions: {
    reset(): VoidResult {
      this.session = {
        id: '',
        state: 'IDLE',
        selectedTypeAtDraw: '',
        current: null,
        drawnIds: [],
        rerollLimit: REROLL_LIMIT_DEFAULT,
        rerollUsed: 0,
        rerollCostToken: REROLL_COST_TOKEN_DEFAULT,
        exitCostToken: EXIT_COST_TOKEN_DEFAULT,
        spentTokens: 0,
      }
      // 注意：reset 不重置 run（要在 finish 时重置），防绕过
      return { ok: true }
    },

    /**
     * 进入页面时调用：若存在未完成会话，且“当前选中的类型”与其一致，才恢复；
     * 若不一致，保持/重置为 IDLE（不清除本地快照与换卡次数）
     */
    rehydrateActive(): VoidResult {
      const catalog = useTaskCatalogStore()
      const curType = (catalog.selectedTaskType ?? '').trim()

      // 若内存中已有未完成会话且类型不一致，进入新类型时要显示抽卡页 → 软重置为 IDLE
      if (
        (this.session.state === 'DRAWN' || this.session.state === 'ACCEPTED') &&
        this.session.selectedTypeAtDraw &&
        this.session.selectedTypeAtDraw !== curType
      ) {
        this.reset() // 不影响 run，也不清除本地未完成快照
      }

      const ps = loadActiveSession()
      if (!ps) return { ok: true }

      const psType = (ps.selectedTypeAtDraw ?? '').trim()
      const match =
        (curType && psType && curType === psType) || (!curType && !psType) // 两者都为空也视为匹配（全局池）

      if (!match) {
        // 不同类型：不恢复，保留快照以便回到原类型时继续
        return { ok: true }
      }

      this.session = {
        id: ps.id,
        state: ps.state,
        selectedTypeAtDraw: ps.selectedTypeAtDraw,
        current: snapshot(ps.current),
        drawnIds: [...ps.drawnIds],
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

    /** 开始新会话（或在已完成/放弃后重开） */
    draw(type?: string): DrawResult {
      if (!this.canDraw) return { ok: false, reason: 'active_session' }

      const catalog = useTaskCatalogStore()
      const t = (type ?? catalog.selectedTaskType ?? '').trim()
      const pool = t ? catalog.getTaskPoolByType(t) : catalog.allPool

      if (!pool.length) {
        this.reset()
        return { ok: false, reason: 'empty_pool' }
      }

      const task = pickRandom(pool)

      // 启动/延续“换卡历程”：离开回来不会重置 used
      this.run = startRunIfNeeded(this.run)

      this.session = {
        id: makeSessionId(),
        state: 'DRAWN',
        selectedTypeAtDraw: t,
        current: snapshot(task),
        drawnIds: [task.id],
        rerollLimit: REROLL_LIMIT_DEFAULT, // UI 兼容
        rerollUsed: 0, // 本页内计数（可做诊断用）
        rerollCostToken: REROLL_COST_TOKEN_DEFAULT,
        exitCostToken: EXIT_COST_TOKEN_DEFAULT,
        spentTokens: 0,
      }

      bumpToday('draws', 1)
      saveActiveSession(this.session)

      return { ok: true, data: { task: this.session.current! } }
    },

    /** 明确接受当前卡（锁定换卡） */
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
    reroll(): DrawResult {
      if (this.session.state !== 'DRAWN' || !this.session.current) {
        return { ok: false, reason: 'not_in_drawn' }
      }

      const runLeft = this.run.limit - this.run.used
      if (runLeft <= 0) {
        return { ok: false, reason: 'reroll_exhausted' }
      }

      const catalog = useTaskCatalogStore()
      const tokens = useRewardTokensStore()
      const t = this.session.selectedTypeAtDraw
      const pool = t ? catalog.getTaskPoolByType(t) : catalog.allPool

      const candidates = pool.filter((p) => !this.session.drawnIds.includes(p.id))
      if (candidates.length < 1) {
        return { ok: false, reason: 'pool_depleted' }
      }

      if (tokens.balance < this.session.rerollCostToken) {
        return { ok: false, reason: 'insufficient_tokens' }
      }

      try {
        tokens.spend(this.session.rerollCostToken)
      } catch {
        return { ok: false, reason: 'token_spend_failed' }
      }
      this.session.spentTokens += this.session.rerollCostToken
      this.session.rerollUsed += 1

      // 累计到 run，并持久化
      this.run.used = Math.min(this.run.limit, this.run.used + 1)
      writeRun(this.run)

      bumpToday('rerolls', 1)

      // 选择新卡，避免与 current 相同
      let pick = pickRandom(candidates)
      if (pick.id === this.session.current.id && candidates.length > 1) {
        const others = candidates.filter((c) => c.id !== this.session.current!.id)
        pick = pickRandom(others)
      }

      this.session.current = snapshot(pick)
      this.session.drawnIds.push(pick.id)

      try {
        emitAppEvent('cards.reroll_used', {
          sessionId: this.session.id,
          used: this.run.used, // 历程累计
          limit: this.run.limit,
          costPerUse: this.session.rerollCostToken,
          balanceAfter: tokens.balance,
          drawnCount: this.session.drawnIds.length,
          at: now(),
        })
      } catch {}

      saveActiveSession(this.session)
      return { ok: true, data: { task: this.session.current! } }
    },

    /** 退出扣费（换卡后再“返回”也要扣），并累计“今日退出扣费次数” */
    chargeExit(): VoidResult {
      if (!this.session.current || !['DRAWN', 'ACCEPTED'].includes(this.session.state)) {
        return { ok: false, reason: 'no_need_to_charge' }
      }
      const tokens = useRewardTokensStore()
      const cost = this.session.exitCostToken
      if (tokens.balance < cost) return { ok: false, reason: 'insufficient_tokens' }
      try {
        tokens.spend(cost)
      } catch {
        return { ok: false, reason: 'token_spend_failed' }
      }
      this.session.spentTokens += cost
      bumpToday('exitsCharged', 1)
      return { ok: true }
    },

    /** 记录一次异常强退欠费 +1 */
    recordExitDebt(): VoidResult {
      if (!this.session.current || !['DRAWN', 'ACCEPTED'].includes(this.session.state)) {
        return { ok: false, reason: 'no_need_to_debt' }
      }
      const cur = loadExitDebt()
      saveExitDebt(cur + 1)
      return { ok: true }
    },

    /** 尝试结清欠费 */
    settleExitDebt(): { ok: boolean; leftDebt: number; reason?: string } {
      let debt = loadExitDebt()
      if (debt <= 0) return { ok: true, leftDebt: 0 }

      const tokens = useRewardTokensStore()
      while (debt > 0) {
        if (tokens.balance < this.session.exitCostToken) break
        try {
          tokens.spend(this.session.exitCostToken)
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

      const t = snapshot(this.session.current!)

      this.session.state = 'COMPLETED'
      this.session.completedAt = now()

      bumpToday('finishes', 1)

      // 只有完成时才重置换卡历程（避免“返回重进刷新换卡次数”）
      this.run = resetRun()

      // 清除未完成会话快照
      clearActiveSession()

      try {
        logTaskCompleted({
          taskId: String(t.id),
          title: t.title,
          source: 'user',
        })
      } catch {}

      return { ok: true }
    },

    /** 放弃本轮（不退还已花费代币）——不重置 run；如需不再恢复，可清除快照 */
    abandon(): VoidResult {
      if (!['DRAWN', 'ACCEPTED'].includes(this.session.state)) {
        return { ok: false, reason: 'nothing_to_abandon' }
      }
      this.session.state = 'ABANDONED'
      // 如希望放弃后不再恢复，解开下一行：
      // clearActiveSession()
      return { ok: true }
    },
  },
})
