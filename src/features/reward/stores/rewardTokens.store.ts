// src/features/reward/stores/rewardTokens.store.ts
import { defineStore } from 'pinia'
import { getJSON, setJSON } from '@/shared/utils/storage'

/**
 * 本地存储键名（仅余额）
 */
const LS_KEY = 'NC_REWARD_TOKENS_V1'

/**
 * 兼容：读取任务域欠费（仅用于显示用的镜像，不在本 store 内修改）
 * 注：真正的欠费记录与结清逻辑在各业务 store（如 taskSession / moodSession）中处理
 */
const LS_EXIT_DEBT_KEY = 'NC_TASK_EXIT_DEBT_V1'

type State = {
  /** 贴纸币余额（用于换卡/退出等消耗的统一代币） */
  balance: number
  /**
   * 只读镜像：任务域的退出欠费
   * - 仅用于在页面上展示“结清了多少欠费”等文案
   * - 不在本 store 内写入或结清（避免把欠费统一收敛到 wallet）
   */
  exitDebt: number
}

/* ---------------------- 基础持久化（余额） ---------------------- */
function readBalance(): number {
  try {
    const n = getJSON<number>(LS_KEY, 0)
    return Number.isFinite(n as number) ? (n as number) : 0
  } catch {
    return 0
  }
}
function writeBalance(n: number) {
  try {
    setJSON(LS_KEY, Math.max(0, Math.floor(n)))
  } catch {
    // 忽略存储错误（隐私模式/配额等），不影响主流程
  }
}

/* ---------------------- 兼容镜像读取（欠费，只读） ---------------------- */
function readExitDebtMirror(): number {
  try {
    const n = getJSON<number>(LS_EXIT_DEBT_KEY, 0)
    return Number.isFinite(n as number) ? Math.max(0, Math.floor(n as number)) : 0
  } catch {
    return 0
  }
}

export const useRewardTokensStore = defineStore('reward-tokens', {
  state: (): State => ({
    balance: readBalance(),
    exitDebt: readExitDebtMirror(), // 只读镜像：页面展示用
  }),

  getters: {
    /** 是否有至少 n 个代币 */
    has: (s) => (n: number) => s.balance >= Math.max(0, Math.floor(n)),
  },

  actions: {
    /** 重新从本地存储加载（余额 + 欠费镜像读取） */
    load() {
      this.balance = readBalance()
      this.exitDebt = readExitDebtMirror()
    },

    /** 增加代币（负数会被忽略） */
    earn(n: number) {
      const v = Math.max(0, Math.floor(n))
      if (!v) return
      this.balance += v
      writeBalance(this.balance)
    },

    /**
     * 消耗代币；余额不足会抛错（外层可 try/catch）
     * 抛出的错误信息为 'insufficient_tokens'
     */
    spend(n: number) {
      const v = Math.max(0, Math.floor(n))
      if (!v) return
      if (this.balance < v) throw new Error('insufficient_tokens')
      this.balance -= v
      writeBalance(this.balance)
    },

    /** 直接设置余额（调试/重置用） */
    set(n: number) {
      this.balance = Math.max(0, Math.floor(n))
      writeBalance(this.balance)
    },

    /** 清零余额（不影响任何业务域的欠费） */
    reset() {
      this.balance = 0
      writeBalance(this.balance)
    },

    /**
     * 刷新欠费镜像（当业务 store 结清/新增欠费后，页面若需要立即反映到 UI 可手动调用）
     * 注：仍旧只读镜像，实际增减由各业务 store 管理
     */
    refreshExitDebtMirror() {
      this.exitDebt = readExitDebtMirror()
    },
  },
})
