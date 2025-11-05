<!-- src/features/mood-baits/pages/BaitsPage.vue -->
<script setup lang="ts">
defineOptions({ name: 'BaitsPage' })

import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter, useRoute, onBeforeRouteLeave } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import PageHeader from '@/shared/components/PageHeader.vue'

/** Stores */
import { useMoodCatalogStore } from '@/features/mood-baits/stores/moodCatalog.store'
import { useMoodSessionStore } from '@/features/mood-baits/stores/moodSession.store'
import { useUserBaitStore } from '@/features/mood-baits/stores/userBait.store'
import { useRewardTokensStore } from '@/features/reward/stores/rewardTokens.store'

/** analytics：完成/换卡后交给奖励编排器弹窗与落库 */
import { logBaitReroll, logBaitCompleted } from '@/app/analytics'

/* -------------------------------- 实例 -------------------------------- */
const router = useRouter()
const route = useRoute()
const catalog = useMoodCatalogStore()
const session = useMoodSessionStore()
const userBait = useUserBaitStore()
const wallet = useRewardTokensStore()

/* ============================== 抽卡动画占位（留坑） ============================== */
const animEnabled = ref(false)
const isAnimating = ref(false)
const animKind = ref<'draw' | 'reroll' | null>(null)
const animContext = ref<Record<string, any> | null>(null)
async function queueAnim(kind: 'draw' | 'reroll', ctx: Record<string, any>) {
  animKind.value = kind
  animContext.value = ctx
  isAnimating.value = true
  try {
    await Promise.resolve()
  } finally {
    isAnimating.value = false
    animKind.value = null
    animContext.value = null
  }
}

/* ============================== 3 分钟严格倒计时（不可暂停） ============================== */
/** 本地持久化键 */
const LS_KEY = 'NC_BAIT_TIMER_V1'
type PersistState = {
  baitKey: string
  duration: number
  startAt: number | null
  /** 到点标志，避免“到点后刷新又回满” */
  doneAt: number | null
}
const persistRef = ref<PersistState | null>(null)

/** 当前卡片 */
const bait = computed(() => session.session.current)

/** 固定 3 分钟 */
const totalSec = computed(() => 180)
const secLeft = ref(0)

/** 对话框可见性（抽到成功 / 换卡成功 / 完成失败 / 到点 / 通用提示） */
const drawDialog = ref(false)
const rerollDialog = ref(false)
const rerollLeftText = ref('')
const finishErrorDialog = ref(false)
const finishErrorText = ref('')
const timeupDialog = ref(false)
type SimpleKind = 'info' | 'warn' | 'error'
const simpleDlg = ref<{ visible: boolean; kind: SimpleKind; title: string; sub: string }>({
  visible: false,
  kind: 'info',
  title: '',
  sub: '',
})
function showSimple(kind: SimpleKind, title: string, sub: string) {
  simpleDlg.value = { visible: true, kind, title, sub }
}

/** 以 bait 的“稳定 key”作为主键，防止不同卡片串计时 */
const currentBaitKey = () => {
  const b = bait.value
  if (!b) return ''
  const moodsResolved = Array.from(
    new Set((b.mood ?? []).map((m: string) => catalog.resolveKey(m)).filter(Boolean))
  )
  // 维稳：按字典序排序，避免同集合不同顺序导致键不一致
  moodsResolved.sort()
  return `${b.title || ''}__${moodsResolved.join(',')}`
}

/** 状态衍生 */
const isRunning = computed(() => {
  const p = persistRef.value
  return !!(p && p.baitKey === currentBaitKey() && p.startAt)
})
const canFinishBtn = computed(() => session.canFinish && secLeft.value === 0 && !!bait.value)

/** 可读时间与进度 */
const timeText = computed(() => {
  const s = Math.max(0, secLeft.value)
  const m = Math.floor(s / 60)
  const ss = String(s % 60).padStart(2, '0')
  return `${m}:${ss}`
})
const progress = computed(() => {
  const done = Math.max(0, totalSec.value - secLeft.value)
  return Math.min(100, Math.round((done / totalSec.value) * 100))
})

/** 读/写持久化 */
function loadPersist(): PersistState | null {
  try {
    const raw = localStorage.getItem(LS_KEY)
    persistRef.value = raw ? ({ doneAt: null, ...JSON.parse(raw) } as PersistState) : null
    return persistRef.value
  } catch {
    persistRef.value = null
    return null
  }
}
function savePersist(p: PersistState) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(p))
    persistRef.value = p
  } catch {}
}
function clearPersist() {
  try {
    localStorage.removeItem(LS_KEY)
  } catch {}
  persistRef.value = null
}

/** 计时驱动 */
let tickId: number | null = null
function startTick() {
  if (!tickId) tickId = window.setInterval(recomputeLeftFromNow, 1000)
}
function clearTick() {
  if (tickId) {
    clearInterval(tickId)
    tickId = null
  }
}
function recomputeLeftFromNow() {
  const p = persistRef.value
  if (!p || p.baitKey !== currentBaitKey()) return
  if (!p.startAt) {
    if (p.doneAt) {
      secLeft.value = 0
      clearTick()
      return
    }
    secLeft.value = p.duration
    clearTick()
    return
  }
  const left = Math.max(0, p.duration - Math.floor((Date.now() - p.startAt) / 1000))
  secLeft.value = left
  if (left === 0) {
    // 到点：停止计时但不自动完成，弹中置对话框
    savePersist({ ...p, startAt: null, doneAt: Date.now() })
    clearTick()
    timeupDialog.value = true
  }
}

/** 初始化/重置/开始 */
function resetTimerForCurrentBait() {
  const key = currentBaitKey()
  if (!key) {
    clearPersist()
    secLeft.value = 0
    clearTick()
    timeupDialog.value = false
    return
  }
  const duration = totalSec.value
  savePersist({ baitKey: key, duration, startAt: null, doneAt: null })
  secLeft.value = duration
  clearTick()
  timeupDialog.value = false
}
function hydrateTimerFromStorage() {
  const key = currentBaitKey()
  if (!key) {
    secLeft.value = 0
    clearTick()
    timeupDialog.value = false
    return
  }
  const p = persistRef.value
  if (!p || p.baitKey !== key || p.duration !== totalSec.value) {
    resetTimerForCurrentBait()
    return
  }
  if (p.startAt) {
    startTick()
    recomputeLeftFromNow()
  } else {
    if (p.doneAt) {
      secLeft.value = 0
      timeupDialog.value = true
      clearTick()
    } else {
      secLeft.value = p.duration
      clearTick()
    }
  }
}
function startTimer() {
  const key = currentBaitKey()
  if (!key || isRunning.value || secLeft.value === 0) return
  // 开始计时前，若可接受则隐式接受，锁定换卡
  if (session.canAccept) {
    const r = session.accept()
    if (!r.ok) {
      showSimple('warn', 'Unable to enter execution mode', 'Please try again later.')
      return
    }
  }
  const duration = totalSec.value
  savePersist({ baitKey: key, duration, startAt: Date.now(), doneAt: null })
  startTick()
  recomputeLeftFromNow()
}

/* ============================== 返回扣费/拦截（强制版） ============================== */
onBeforeRouteLeave(async (_to, _from, next) => {
  const needCharge = session.shouldChargeOnExit
  if (!needCharge) return next()

  const ok = await ElMessageBox.confirm(
    `Returning will consume 1 sticker (you currently have ${wallet.balance}). Still want to go back?`,
    'Confirm before leaving',
    {
      type: 'warning',
      confirmButtonText: 'Leave anyway (spend/record 1 sticker)',
      cancelButtonText: 'Stay on this page',
    }
  )
    .then(() => true)
    .catch(() => false)

  if (!ok) return next(false)

  const r = session.chargeExit()
  if (!r.ok && r.reason === 'insufficient_tokens') {
    try {
      session.recordExitDebt()
      showSimple('info', 'Debt recorded', 'Insufficient balance; recorded debt for 1 sticker.')
    } catch {}
  }
  next()
})

/* ============================== 页面交互：抽卡/换卡/完成 ============================== */
const canDrawBtn = computed(() => session.canDraw && !isAnimating.value)
const canRerollBtn = computed(
  () =>
    session.canReroll &&
    wallet.balance >= session.session.rerollCostToken &&
    !isAnimating.value &&
    !isRunning.value
)

async function draw() {
  // 若从外部带 ?mood=，onMounted 已处理，这里只尝试抽卡
  const res = session.draw()
  if (!res.ok) {
    const map: Record<string, string> = {
      active_session: 'A bait card is already in progress; please finish or abandon it first.',
      empty_pool: 'This mood\'s bait pool is empty; add bait or pick another mood.',
    }
    return showSimple('warn', 'Failed to draw card', map[res.reason ?? ''] || 'Please try again later.')
  }

  resetTimerForCurrentBait() // 抽到卡后准备计时（但不自动开始）

  if (animEnabled.value) {
    await queueAnim('draw', {
      sessionId: session.session.id,
      poolTag: session.session.selectedTypeAtDraw,
      baitKey: currentBaitKey(),
    })
  }

  drawDialog.value = true
}

async function reroll() {
  if (!canRerollBtn.value) {
    if (!session.canReroll) return showSimple('info', 'Unable to swap card', 'Not currently in a swappable state.')
    if (wallet.balance < session.session.rerollCostToken)
      return showSimple('warn', 'Requires 1 sticker', 'Insufficient balance; cannot swap.')
    if (isRunning.value)
      return showSimple('info', 'Timer already running', 'Once started, the current card is locked and cannot be swapped.')
    return
  }

  const ok = await ElMessageBox.confirm(
    `Swapping will consume 1 sticker (you currently have ${wallet.balance}). Proceed with the swap?`,
    'Confirm swap',
    { type: 'warning', confirmButtonText: 'Confirm swap', cancelButtonText: 'Cancel' }
  )
    .then(() => true)
    .catch(() => false)
  if (!ok) return

  const beforeKey = currentBaitKey()
  const res = session.reroll()
  if (!res.ok) {
    const map: Record<string, string> = {
      not_in_drawn: 'Not in draw state, unable to swap.',
      reroll_exhausted: 'All swap attempts have been used.',
      pool_depleted: 'All bait for this mood has been drawn today; no more swaps available.',
      insufficient_tokens: 'Need 1 sticker to swap.',
      token_spend_failed: 'Failed to deduct a sticker, please retry.',
    }
    return showSimple('warn', 'Swap failed', map[res.reason ?? ''] || 'Please try again later.')
  }

  resetTimerForCurrentBait() // 新卡 → 重置计时

  rerollLeftText.value = `Remaining ${session.rerollLeft}`
  rerollDialog.value = true

  if (animEnabled.value) {
    await queueAnim('reroll', {
      sessionId: session.session.id,
      fromKey: beforeKey,
      toKey: currentBaitKey(),
      left: session.rerollLeft,
    })
  }

  // 埋点
  logBaitReroll({ beforeKey, afterKey: currentBaitKey() })
}

/** 到点后的完成入口（由到点弹窗按钮触发） */
function finishTask() {
  const r = session.finish()
  if (!r.ok) {
    const map: Record<string, string> = {
      already_completed: 'This bait is already complete.',
      not_accepted: 'Tap "Start" to enter execution before finishing.',
    }
    finishErrorText.value = map[r.reason ?? ''] || 'Failed to finish.'
    finishErrorDialog.value = true
    return
  }

  clearPersist()
  clearTick()
  timeupDialog.value = false

  const title = bait.value?.title ?? ''
  const moodsResolved = (bait.value?.mood ?? []).map((m: string) => catalog.resolveKey(m))
  logBaitCompleted({
    title,
    source: 'user',
    moodsResolved,
  })
}

/* ============================== 生命周期 & 监听 ============================== */
onMounted(() => {
  // 1) 加载目录 & 会话回补
  catalog.load()
  session.rehydrateActive()

  // 2) 归一化“我的诱饵”并灌默认（若为空）
  userBait.normalizeByResolver(catalog.resolveKey)
  userBait.ensureSeededFromDefaults(catalog.moodList)

  // 3) 应用路由 ?mood=
  const q = (route.query.mood as string | undefined)?.trim()
  if (q && catalog.moodList.includes(q)) {
    session.setMood?.(q) // 若 store 提供 setMood，与既有实现保持兼容
  }

  // 4) 进入时先结清欠费（如果有）
  const settle = session.settleExitDebt()
  if (!settle.ok && settle.leftDebt > 0) {
    showSimple('warn', 'Outstanding sticker debt', `You still owe ${settle.leftDebt} stickers.`)
  }

  // 5) 恢复倒计时（依赖于当前 bait）
  loadPersist()
  hydrateTimerFromStorage()

  document.addEventListener('visibilitychange', onVisibility, { passive: true })
  window.addEventListener('storage', onStorage)
  window.addEventListener('beforeunload', onBeforeUnload)
})
onUnmounted(() => {
  clearTick()
  document.removeEventListener('visibilitychange', onVisibility)
  window.removeEventListener('storage', onStorage)
  window.removeEventListener('beforeunload', onBeforeUnload)
})
function onVisibility() {
  if (document.visibilityState === 'visible') recomputeLeftFromNow()
}
function onStorage(e: StorageEvent) {
  if (e.key === LS_KEY) {
    loadPersist()
    hydrateTimerFromStorage()
  }
}
function onBeforeUnload() {
  try {
    // 直到完成前离开都要付费：强退视作欠费 +1
    session.recordExitDebt()
  } catch {}
}

/** 抽/换后 bait 变化 → 重置计时器（兜底） */
watch(
  () => currentBaitKey(),
  () => resetTimerForCurrentBait()
)

/* --------------------------------- 派生文案 --------------------------------- */
const baitMoodLabels = computed(() => {
  const arr = bait.value?.mood ?? []
  // 展示用：维持原顺序，去重（以标准化 key 去重，再取 label）
  const seen = new Set<string>()
  const out: string[] = []
  for (const m of arr) {
    const k = catalog.resolveKey(m)
    if (!k || seen.has(k)) continue
    seen.add(k)
    out.push(catalog.getMeta(k).label)
  }
  return out
})
</script>

<template>
  <div class="m-page">
    <PageHeader title="Mood Bait Cards">
      <template #extra>
        <el-tag type="warning" round>Sticker balance: {{ wallet.balance }}</el-tag>
      </template>
    </PageHeader>

    <!-- 抽卡前：规则提示（常驻） -->
    <div v-if="session.canDraw" class="rule-tip">
      ⚠️ After drawing, swapping or leaving before finishing will consume 1 sticker.
    </div>

    <!-- 操作区：抽卡 / 换卡 -->
    <div class="m-actions">
      <el-button
        type="primary"
        size="large"
        round
        class="m-btn"
        :disabled="!canDrawBtn"
        @click="draw"
        >Draw Card</el-button
      >

      <el-button
        size="large"
        round
        class="m-btn"
        :disabled="!canRerollBtn"
        @click="reroll"
        >Swap Card ({{ session.rerollLeft }} left)</el-button
      >

      <div
        v-if="session.canReroll && wallet.balance < session.session.rerollCostToken"
        class="hint-center"
      >
        Swapping uses 1 sticker; you currently have none.
      </div>
    </div>

    <!-- 当前诱饵卡 + 计时器（长按 = 快速换卡，仅在可换时） -->
    <section class="card-host">
      <div class="anim-host" data-anim-host="bait-card">
        <el-card
          v-if="bait"
          class="m-card"
          shadow="hover"
          @touchstart.passive="session.canReroll && !isRunning && (void 0)"
          @touchend.passive="(void 0)"
        >
          <h3 class="card-title">{{ bait.title }}</h3>

          <!-- 只保留一行情绪标签（诱饵自带标签集合） -->
          <div class="tags">
            <el-tag
              v-for="(label, i) in baitMoodLabels"
              :key="label + '-' + i"
              size="small"
              style="margin-right: 6px"
            >
              {{ label }}
            </el-tag>
          </div>

          <!-- 倒计时区域 -->
          <div class="timer">
            <el-progress type="circle" :percentage="progress" :width="112" />
            <div class="t-side">
              <div class="t-time" aria-live="polite">{{ timeText }}</div>
              <div class="t-ops">
                <el-button
                  size="small"
                  type="primary"
                  :disabled="!bait || isRunning || secLeft === 0 || isAnimating"
                  @click="startTimer"
                >
                  {{ isRunning ? 'Timing' : secLeft === 0 ? 'Finished' : 'Start' }}
                </el-button>
              </div>
              <div class="t-hint">
                {{
                  canFinishBtn
                    ? 'Time\'s up! Click "Finish" in the dialog.'
                    : 'Timer running; no pausing or finishing early.'
                }}
              </div>
            </div>
          </div>

          <p class="hint" v-if="session.rerollLeft > 0">Once you tap "Start", the current card locks and cannot be swapped.</p>
        </el-card>

        <el-empty v-else description="Tap 'Draw Card' to start today's bait" style="margin-top: 8px" />
      </div>
    </section>

    <!-- ====================== 中置对话框（样式来自全局 dialogs.css） ====================== -->

    <!-- 到点：移动端中置对话框 -->
    <el-dialog
      v-model="timeupDialog"
      align-center
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      :show-close="false"
      class="nc-dlg nc-dlg--success"
    >
      <div class="dlg-icon">⏰</div>
      <div class="dlg-title">Timer at 0:00</div>
      <div class="dlg-sub">Nice work! Tap "Finish" to wrap up, then go claim your reward.</div>
      <div class="dlg-actions">
        <el-button type="primary" class="dlg-btn-primary" round @click="finishTask">Finish</el-button>
      </div>
    </el-dialog>

    <!-- 抽到成功：移动端中置对话框 -->
    <el-dialog
      v-model="drawDialog"
      align-center
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      :show-close="false"
      class="nc-dlg nc-dlg--info"
    >
      <div class="dlg-icon">🎴</div>
      <div class="dlg-title">Card drawn!</div>
      <div class="dlg-sub">Tap "Start" to begin timing.</div>
      <div class="dlg-actions">
        <el-button type="primary" class="dlg-btn-primary" round @click="drawDialog = false"
          >Got it</el-button
        >
      </div>
    </el-dialog>

    <!-- 换卡成功：移动端中置对话框 -->
    <el-dialog
      v-model="rerollDialog"
      align-center
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      :show-close="false"
      class="nc-dlg nc-dlg--info"
    >
      <div class="dlg-icon">🔁</div>
      <div class="dlg-title">Card swapped</div>
      <div class="dlg-sub">{{ rerollLeftText }}</div>
      <div class="dlg-actions">
        <el-button type="primary" class="dlg-btn-primary" round @click="rerollDialog = false"
          >Got it</el-button
        >
      </div>
    </el-dialog>

    <!-- 完成失败：移动端中置对话框 -->
    <el-dialog
      v-model="finishErrorDialog"
      align-center
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      :show-close="false"
      class="nc-dlg nc-dlg--warn"
    >
      <div class="dlg-icon">⚠️</div>
      <div class="dlg-title">Unable to finish</div>
      <div class="dlg-sub">{{ finishErrorText }}</div>
      <div class="dlg-actions">
        <el-button type="primary" class="dlg-btn-primary" round @click="finishErrorDialog = false">
          Understood
        </el-button>
      </div>
    </el-dialog>

    <!-- 通用信息/警告/错误：移动端中置对话框 -->
    <el-dialog
      v-model="simpleDlg.visible"
      align-center
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      :show-close="false"
      :class="['nc-dlg', simpleDlg.kind === 'warn' ? 'nc-dlg--warn' : (simpleDlg.kind === 'error' ? 'nc-dlg--warn' : 'nc-dlg--info')]"
    >
      <div class="dlg-icon">{{ simpleDlg.kind === 'error' ? '❌' : (simpleDlg.kind === 'warn' ? '⚠️' : 'ℹ️') }}</div>
      <div class="dlg-title">{{ simpleDlg.title }}</div>
      <div class="dlg-sub">{{ simpleDlg.sub }}</div>
      <div class="dlg-actions">
        <el-button type="primary" class="dlg-btn-primary" round @click="simpleDlg.visible = false">
          Understood
        </el-button>
      </div>
    </el-dialog>
  </div>
</template>

<style scoped>
.m-page {
  max-width: 480px;
  margin: 0 auto;
  padding: 12px;
}

/* 抽卡前规则提示 */
.rule-tip {
  margin: 4px 0 6px;
  text-align: left;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

/* 栈式按钮 */
.m-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 6px;
  margin-bottom: 10px;
}
.m-btn {
  width: 100%;
}
.hint-center {
  margin-top: -2px;
  text-align: center;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}

/* 卡片与动画宿主 */
.card-host {
  position: relative;
}
.anim-host {
  min-height: 220px;
  display: flex;
  align-items: stretch;
}
.m-card {
  border-radius: 16px;
  border: 1px solid var(--el-border-color);
  padding: 12px 14px;
  width: 100%;
}
.card-title {
  font-size: 18px;
  font-weight: 700;
  margin: 0 0 6px;
}
.hint {
  margin: 4px 0 0;
  color: var(--el-text-color-placeholder);
  font-size: 12px;
}
.tags {
  margin-top: 6px;
}

/* 计时器 */
.timer {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 4px;
}
.t-side {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.t-time {
  font-size: 28px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}
.t-ops {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.t-hint {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}
</style>
