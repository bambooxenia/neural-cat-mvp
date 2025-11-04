// src/features/reward/orchestrators.ts
// 说明：本文件现在只承载“奖励策略与限流”的纯逻辑，不再触达 UI、也不再注册 analytics 适配器。
//       领域事件 -> RewardCenter.vue 订阅 -> reward.enqueueSticker() 才是唯一的 UI 生产路径。

import { REWARD_POLICY } from './policy'

/* -------------------------------- 持久化：冷却与日上限状态 -------------------------------- */

type PolicyState = {
  lastAt: Record<string, number>                                   // 事件 -> 最近触发时间戳
  dailyCount: Record<string, { date: string; count: number }>      // 事件 -> 当日计数
}

const LS_KEY = 'NC_REWARD_POLICY_STATE_V1'

function loadState(): PolicyState {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return { lastAt: {}, dailyCount: {} }
    const s = JSON.parse(raw) as PolicyState
    if (!s || typeof s !== 'object') return { lastAt: {}, dailyCount: {} }
    return {
      lastAt: s.lastAt ?? {},
      dailyCount: s.dailyCount ?? {},
    }
  } catch {
    return { lastAt: {}, dailyCount: {} }
  }
}

function saveState(s: PolicyState) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(s)) } catch {}
}

const state: PolicyState = loadState()

const todayStr = () => {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

/* ------------------------------- 纯判断：是否通过限流 ------------------------------- */

/** 判断事件是否通过“冷却 + 每日上限” */
export function canPassLimit(evtName: string, now: number = Date.now()): boolean {
  const limit = REWARD_POLICY[evtName]?.limit
  if (!limit) return true

  const { perDay, cooldownMs } = limit

  // 冷却判断
  if (cooldownMs) {
    const last = state.lastAt[evtName] || 0
    if (now - last < cooldownMs) return false
  }

  // 每日上限
  if (perDay && perDay > 0) {
    const rec = state.dailyCount[evtName]
    if (rec && rec.date === todayStr() && rec.count >= perDay) return false
  }

  return true
}

/** 在“实际发放贴纸/生效一次奖励”后调用，记录冷却与日计数 */
export function markTriggered(evtName: string, now: number = Date.now()): void {
  state.lastAt[evtName] = now
  const today = todayStr()
  const rec = state.dailyCount[evtName]
  if (!rec || rec.date !== today) {
    state.dailyCount[evtName] = { date: today, count: 1 }
  } else {
    rec.count += 1
  }
  saveState(state)
}

/* ------------------------------- 纯判断：是否应给贴纸 ------------------------------- */

/**
 * 根据策略判断“是否应给贴纸”（不包含限流；需与 canPassLimit 组合使用）。
 * - never：从不
 * - always：总是
 * - firstOfDay：当日第一次
 * - { chance }: 按概率
 */
export function shouldGiveSticker(evtName: string): boolean {
  const rule = REWARD_POLICY[evtName]?.sticker
  if (!rule) return false

  if (rule === 'never') return false
  if (rule === 'always') return true

  if (rule === 'firstOfDay') {
    const rec = state.dailyCount[evtName]
    const today = todayStr()
    return !(rec && rec.date === today && rec.count >= 1)
  }

  if (typeof rule === 'object' && typeof (rule as any).chance === 'number') {
    const chance = Math.max(0, Math.min(1, (rule as any).chance))
    return Math.random() < chance
  }

  return false
}

/* --------------------------------- 调试/维护辅助 --------------------------------- */

/** 可选：重置策略状态（开发调试用） */
export function __resetPolicyState() {
  state.lastAt = {}
  state.dailyCount = {}
  saveState(state)
}

/**
 * 重要说明：
 * - 本文件不再注册任何 analytics 适配器，不再触达 UI。
 * - 若需要在订阅回调中应用策略：
 *    if (canPassLimit(evtName) && shouldGiveSticker(evtName)) {
 *      // 这里再入队 sticker，并在真正生效后调用 markTriggered(evtName)
 *    }
 * - 目前 RewardCenter.vue 采用“统一入队”的简单策略；若未来要启用策略，
 *   可在 RewardCenter 的订阅回调里调用上述方法。
 */
