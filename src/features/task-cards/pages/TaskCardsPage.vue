<!-- src/features/task-cards/pages/TaskCardsPage.vue -->
<script setup lang="ts">
defineOptions({ name: 'TaskCardsPage' })

import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter, onBeforeRouteLeave } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'

import PageHeader from '@/shared/components/PageHeader.vue'

/** Stores */
import { useTaskCatalogStore } from '@/features/task-cards/stores/taskCatalog.store'
import { useTaskSessionStore } from '@/features/task-cards/stores/taskSession.store'
import { useRewardTokensStore } from '@/features/reward/stores/rewardTokens.store'

/** analytics：完成后交给奖励编排器弹窗与落库 */
import { logTaskCompleted } from '@/app/analytics'
import { LS } from '@/shared/constants/ls-keys'

/* -------------------------------- 实例 -------------------------------- */
const router = useRouter()
const catalog = useTaskCatalogStore()
const session = useTaskSessionStore()
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

/* ============================== 严格倒计时（不可暂停） ============================== */
/** 本地持久化键 */
const LS_KEY = LS.taskTimer
type PersistState = {
  taskKey: string
  duration: number
  startAt: number | null
  /** 到点标志，避免“到点后刷新又回满” */
  doneAt: number | null
}
const persistRef = ref<PersistState | null>(null)

const task = computed(() => session.session.current)
const totalSec = computed(() => (task.value ? task.value.minutes * 60 : 0))
const secLeft = ref(0)

/** 新增：对话框可见性（抽到成功 / 换卡成功 / 完成失败 / 到点） */
const drawDialog = ref(false)
const rerollDialog = ref(false)
const rerollLeftText = ref('')
const finishErrorDialog = ref(false)
const finishErrorText = ref('')
const timeupDialog = ref(false) // 到点弹窗（移动端样式）

/** 以 task.id 为主键，防止不同任务串计时 */
const currentTaskKey = () => {
  const t = task.value
  if (!t) return ''
  const tag = (t.typeTag || catalog.selectedTaskType || '').trim()
  return `${t.id}__${t.minutes}__${tag}`
}

const isRunning = computed(() => {
  const p = persistRef.value
  return !!(p && p.taskKey === currentTaskKey() && p.startAt)
})
// 仍保留：便于提示文案
const canFinishBtn = computed(() => session.canFinish && secLeft.value === 0 && !!task.value)

/** 可读时间与进度 */
const timeText = computed(() => {
  const s = Math.max(0, secLeft.value)
  const m = Math.floor(s / 60)
  const ss = String(s % 60).padStart(2, '0')
  return `${m}:${ss}`
})
const progress = computed(() => {
  if (!totalSec.value) return 0
  const done = Math.max(0, totalSec.value - secLeft.value)
  return Math.min(100, Math.round((done / totalSec.value) * 100))
})

/** 读/写持久化 */
function loadPersist(): PersistState | null {
  try {
    const raw = localStorage.getItem(LS_KEY)
    persistRef.value = raw
      ? ({ doneAt: null, ...JSON.parse(raw) } as PersistState) // 兼容旧数据
      : null
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
  if (!p || p.taskKey !== currentTaskKey()) return
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
    // 到点：停止计时但不自动完成，弹中置对话框（移动端样式）
    savePersist({ ...p, startAt: null, doneAt: Date.now() })
    clearTick()
    timeupDialog.value = true
  }
}

/** 初始化/重置/开始 */
function resetTimerForCurrentTask() {
  const key = currentTaskKey()
  if (!key) {
    clearPersist()
    secLeft.value = 0
    clearTick()
    timeupDialog.value = false
    return
  }
  const duration = totalSec.value
  savePersist({ taskKey: key, duration, startAt: null, doneAt: null })
  secLeft.value = duration
  clearTick()
  timeupDialog.value = false
}
function hydrateTimerFromStorage() {
  const key = currentTaskKey()
  if (!key) {
    secLeft.value = 0
    clearTick()
    timeupDialog.value = false
    return
  }
  const p = persistRef.value
  if (!p || p.taskKey !== key || p.duration !== totalSec.value) {
    resetTimerForCurrentTask()
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
  const key = currentTaskKey()
  if (!key || isRunning.value || secLeft.value === 0) return
  // 开始计时前，若可接受则隐式接受，锁定换卡
  if (session.canAccept) {
    const r = session.accept()
    if (!r.ok) {
      ElMessage.warning('Unable to enter execution mode.')
      return
    }
  }
  const duration = totalSec.value
  savePersist({ taskKey: key, duration, startAt: Date.now(), doneAt: null })
  startTick()
  recomputeLeftFromNow()
}

/* ============================== 返回扣费/拦截（强制版） ============================== */
onBeforeRouteLeave(async (_to, _from, next) => {
  const needCharge = session.shouldChargeOnExit
  if (!needCharge) return next()

  const ok = await ElMessageBox.confirm(
    `Returning will consume 1 sticker (you currently have ${wallet.balance}). Still want to leave?`,
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
      ElMessage.info('Insufficient balance; recorded debt for 1 sticker.')
    } catch {}
  }
  next()
})

/* ============================== 页面交互：抽卡/换卡/完成 ============================== */
const stickerBalance = computed(() => wallet.balance)
const canDrawBtn = computed(() => session.canDraw && !isAnimating.value)
const canRerollBtn = computed(
  () =>
    session.canReroll &&
    stickerBalance.value >= session.session.rerollCostToken &&
    !isAnimating.value
)

async function draw() {
  if (!catalog.selectedTaskType) {
    return router.replace({ name: 'home.tasks', query: { redirect: '/home/tasks/card' } })
  }
  const res = session.draw()
  if (!res.ok) {
    const map: Record<string, string> = {
      active_session: 'A task card is already in progress; finish or drop it first.',
      empty_pool: 'This type\'s task pool is empty; add tasks or pick another type.',
    }
    return ElMessage.warning(map[res.reason ?? ''] || 'Failed to draw a card. Please try again.')
  }

  resetTimerForCurrentTask() // 抽到卡后准备计时（但不自动开始）

  if (animEnabled.value) {
    await queueAnim('draw', {
      sessionId: session.session.id,
      poolSize: catalog.allPool.length,
      taskId: task.value?.id,
    })
  }

  drawDialog.value = true
}

async function reroll() {
  if (!canRerollBtn.value) {
    if (!session.canReroll) return ElMessage.info('Cannot swap cards right now.')
    if (wallet.balance < session.session.rerollCostToken)
      return ElMessage.warning('Swapping requires 1 sticker.')
    return
  }

  const ok = await ElMessageBox.confirm(
    `Swapping will consume 1 sticker (you currently have ${wallet.balance}). Proceed?`,
    'Confirm swap',
    { type: 'warning', confirmButtonText: 'Confirm swap', cancelButtonText: 'Cancel' }
  )
    .then(() => true)
    .catch(() => false)
  if (!ok) return

  const beforeId = task.value?.id
  const res = session.reroll()
  if (!res.ok) {
    const map: Record<string, string> = {
      not_in_drawn: 'Not in draw state; unable to swap.',
      reroll_exhausted: 'All swap attempts have been used.',
      pool_depleted: 'All tasks of this type were drawn today; no more swaps available.',
      insufficient_tokens: 'Swapping requires 1 sticker.',
      token_spend_failed: 'Failed to deduct a sticker; please try again.',
    }
    return ElMessage.warning(map[res.reason ?? ''] || 'Swap failed. Please try again.')
  }

  resetTimerForCurrentTask() // 新卡 → 重置计时

  rerollLeftText.value = `Remaining ${session.rerollLeft}`
  rerollDialog.value = true

  if (animEnabled.value) {
    await queueAnim('reroll', {
      sessionId: session.session.id,
      fromId: beforeId,
      toId: task.value?.id,
      left: session.rerollLeft,
    })
  }
}

/** 完成入口（由到点弹窗按钮触发） */
function finishTask() {
  const r = session.finish()
  if (!r.ok) {
    const map: Record<string, string> = {
      already_completed: 'This task is already completed.',
      not_accepted: 'Please accept the task before finishing.',
    }

    finishErrorText.value = map[r.reason ?? ''] || 'Failed to finish.'
    finishErrorDialog.value = true
    return
  }

  clearPersist()
  clearTick()
  timeupDialog.value = false

  const id = task.value?.id
  logTaskCompleted({
    ...(id != null ? { taskId: String(id) } : {}),
    title: task.value?.title,
    source: 'user',
  })
}

/* ============================== 生命周期 & 监听 ============================== */
onMounted(() => {
  session.rehydrateActive()
  // 进入时先结清欠费（如果有）
  const beforeDebt = wallet.exitDebt
  const settle = session.settleExitDebt()
  if (!settle.ok && settle.leftDebt > 0) {
    ElMessage.warning(`You still owe ${settle.leftDebt} sticker(s).`)
  } else if (beforeDebt > 0) {
    ElMessage.success(`Automatically settled ${beforeDebt} sticker debt.`)
  }

  // 然后再恢复倒计时（依赖于当前 task）
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

/** 抽/换后 task 变化 → 重置计时器（兜底） */
watch(
  () => task.value?.id,
  () => resetTimerForCurrentTask()
)
watch(
  () => task.value?.minutes,
  () => resetTimerForCurrentTask()
)

/** 切换选中类型 → 清掉当前卡与计时器（通常来自类型页返回） */
watch(
  () => catalog.selectedTaskType,
  () => {
    if (session.session.state !== 'IDLE') {
      clearPersist()
      secLeft.value = 0
      clearTick()
      timeupDialog.value = false
    }
  }
)
</script>

<template>
  <div class="m-page">
    <PageHeader title="Task Card Draw">
      <template #extra>
        <el-tag type="warning" round>Sticker balance: {{ wallet.balance }}</el-tag>
      </template>
    </PageHeader>

    <!-- 抽卡前：规则提示（常驻） -->
    <div v-if="session.canDraw" class="rule-tip">
      ⚠️ After drawing, swapping or exiting before finishing consumes 1 sticker.
    </div>

    <!-- 操作区：抽卡 / 换卡 -->
    <div class="m-actions">
      <el-button
        type="primary"
        size="large"
        round
        class="m-btn"
        :disabled="!session.canDraw || isAnimating"
        @click="draw"
        >Draw Card</el-button
      >

      <el-button
        size="large"
        round
        class="m-btn"
        :disabled="
          !session.canReroll || wallet.balance < session.session.rerollCostToken || isAnimating
        "
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

    <!-- 当前任务卡 + 计时器 -->
    <section class="card-host">
      <div class="anim-host" data-anim-host="task-card">
        <el-card v-if="task" class="m-card" shadow="hover">
          <h3 class="card-title">{{ task.title }}</h3>
          <p class="meta">
            <el-tag size="small" effect="plain">{{
              task.typeTag || catalog.selectedTaskType
            }}</el-tag>
            <el-tag size="small" effect="plain" style="margin-left: 6px"
              >{{ task.minutes }} min</el-tag
            >
          </p>

          <!-- 倒计时区域 -->
          <div class="timer">
            <el-progress type="circle" :percentage="progress" :width="112" />
            <div class="t-side">
              <div class="t-time" aria-live="polite">{{ timeText }}</div>
              <div class="t-ops">
                <el-button
                  size="small"
                  type="primary"
                  :disabled="!task || isRunning || secLeft === 0 || isAnimating"
                  @click="startTimer"
                >
                  {{ isRunning ? 'Timing' : secLeft === 0 ? 'Finished' : 'Start' }}
                </el-button>
                <!-- 删除卡片上的“完成”小按钮：改为到点弹窗操作 -->
              </div>
              <div class="t-hint">
                {{
                  canFinishBtn
                    ? 'Time\'s up! Click "Finish" in the dialog.'
                    : 'Timer running; cannot pause or finish early.'
                }}
              </div>
            </div>
          </div>

          <p class="hint" v-if="session.rerollLeft > 0">Once you tap "Start", the current card locks and can\'t be swapped.</p>
        </el-card>

        <el-empty v-else description="Tap &quot;Draw Card&quot; to start today&#39;s mini action." style="margin-top: 8px" />
      </div>
    </section>

    <!-- 中置对话框（统一移动端样式） -->
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
      <div class="dlg-sub">Nice work! Tap "Finish" to wrap up, then claim your reward.</div>
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

    <!-- 动画覆盖层占位 -->
    <div class="anim-layer" data-anim-layer="overlay" aria-hidden="true"></div>
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
.meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 6px;
}
.hint {
  margin: 4px 0 0;
  color: var(--el-text-color-placeholder);
  font-size: 12px;
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

/* 动画覆盖层（占位） */
.anim-layer {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 999;
  display: none;
}
</style>
