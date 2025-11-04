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
      showSimple('warn', '无法进入执行状态', '请稍后重试')
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
    `返回将消耗 1 张贴纸（当前持有：${wallet.balance}）。确认要返回吗？`,
    '返回前确认',
    {
      type: 'warning',
      confirmButtonText: '仍要返回（消耗/记欠费 1 ）',
      cancelButtonText: '继续留在此页',
    }
  )
    .then(() => true)
    .catch(() => false)

  if (!ok) return next(false)

  const r = session.chargeExit()
  if (!r.ok && r.reason === 'insufficient_tokens') {
    try {
      session.recordExitDebt()
      showSimple('info', '已记欠费', '余额不足，已记欠费 1 张贴纸')
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
      active_session: '当前已有进行中的诱饵卡，请先完成或放弃',
      empty_pool: '当前心情的诱饵池为空，请先添加诱饵或更换心情',
    }
    return showSimple('warn', '抽卡失败', map[res.reason ?? ''] || '请稍后重试')
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
    if (!session.canReroll) return showSimple('info', '无法换卡', '当前不在可换卡状态')
    if (wallet.balance < session.session.rerollCostToken)
      return showSimple('warn', '需要 1 张贴纸', '余额不足，无法换卡')
    if (isRunning.value) return showSimple('info', '已开始计时', '开始后将锁定当前卡，不能再换卡')
    return
  }

  const ok = await ElMessageBox.confirm(
    `换一张将消耗 1 张贴纸（当前持有：${wallet.balance}）。确认要换吗？`,
    '确认换卡',
    { type: 'warning', confirmButtonText: '确认换卡', cancelButtonText: '取消' }
  )
    .then(() => true)
    .catch(() => false)
  if (!ok) return

  const beforeKey = currentBaitKey()
  const res = session.reroll()
  if (!res.ok) {
    const map: Record<string, string> = {
      not_in_drawn: '当前不在抽卡状态，无法更换',
      reroll_exhausted: '换卡次数已用完',
      pool_depleted: '今日该心情的诱饵都抽过了，无法再换',
      insufficient_tokens: '需要 1 张贴纸才能换卡',
      token_spend_failed: '扣贴纸失败，请重试',
    }
    return showSimple('warn', '换卡失败', map[res.reason ?? ''] || '请稍后重试')
  }

  resetTimerForCurrentBait() // 新卡 → 重置计时

  rerollLeftText.value = `剩 ${session.rerollLeft}`
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
      already_completed: '本诱饵已完成',
      not_accepted: '请先点击「开始」进入执行状态再完成',
    }
    finishErrorText.value = map[r.reason ?? ''] || '完成失败'
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
    showSimple('warn', '有未结清的贴纸欠费', `你还有 ${settle.leftDebt} 张贴纸欠费未结清`)
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
    <PageHeader title="心情诱饵卡">
      <template #extra>
        <el-tag type="warning" round>贴纸余额：{{ wallet.balance }}</el-tag>
      </template>
    </PageHeader>

    <!-- 抽卡前：规则提示（常驻） -->
    <div v-if="session.canDraw" class="rule-tip">
      ⚠️ 抽卡以后，在完成前，换卡或退出都会消耗 1 张贴纸。
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
        >抽卡</el-button
      >

      <el-button
        size="large"
        round
        class="m-btn"
        :disabled="!canRerollBtn"
        @click="reroll"
        >换一张（剩 {{ session.rerollLeft }}）</el-button
      >

      <div
        v-if="session.canReroll && wallet.balance < session.session.rerollCostToken"
        class="hint-center"
      >
        换卡需消耗 1 张贴纸，你当前没有贴纸
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
                  {{ isRunning ? '计时中' : secLeft === 0 ? '已结束' : '开始' }}
                </el-button>
              </div>
              <div class="t-hint">
                {{
                  canFinishBtn
                    ? '时间到啦，请在弹出的对话框中点击「完成」'
                    : '计时中，不能暂停或提前结束'
                }}
              </div>
            </div>
          </div>

          <p class="hint" v-if="session.rerollLeft > 0">按「开始」后将锁定当前卡，不能再换卡</p>
        </el-card>

        <el-empty v-else description="点击「抽卡」开始今天的小诱饵" style="margin-top: 8px" />
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
      <div class="dlg-title">计时 0:00 啦</div>
      <div class="dlg-sub">做得好！点「完成」来收个尾，然后去领奖励吧～</div>
      <div class="dlg-actions">
        <el-button type="primary" class="dlg-btn-primary" round @click="finishTask">完成</el-button>
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
      <div class="dlg-title">抽到啦！</div>
      <div class="dlg-sub">点击「开始」按钮进入计时</div>
      <div class="dlg-actions">
        <el-button type="primary" class="dlg-btn-primary" round @click="drawDialog = false"
          >好的</el-button
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
      <div class="dlg-title">已换一张</div>
      <div class="dlg-sub">{{ rerollLeftText }}</div>
      <div class="dlg-actions">
        <el-button type="primary" class="dlg-btn-primary" round @click="rerollDialog = false"
          >好的</el-button
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
      <div class="dlg-title">无法完成</div>
      <div class="dlg-sub">{{ finishErrorText }}</div>
      <div class="dlg-actions">
        <el-button type="primary" class="dlg-btn-primary" round @click="finishErrorDialog = false">
          我知道了
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
          我知道了
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
