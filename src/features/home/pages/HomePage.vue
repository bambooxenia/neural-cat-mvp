<!-- src/features/home/pages/HomePage.vue -->
<template>
  <div class="m-page safe-bottom">
    <!-- S1 品牌标题（中文 + 英文副标） -->
    <header class="m-hd brand">
      <h1 class="m-title">Neural Cat</h1>
      <p class="m-en" aria-hidden="true">Neural Cat</p>
    </header>

    <!-- S2 心情 + 主猫插画 + 推荐模组（整卡可点） -->
    <section class="section">
      <h2 class="sec-title primary">
        <span class="bar" aria-hidden="true"></span>
        Today's cat mood is
      </h2>

      <div
        class="pressable mood-card"
        v-breath
        role="button"
        tabindex="0"
        :aria-describedby="'mood-desc'"
        @click="go(R[recEntry])"
        @keydown.enter.prevent="go(R[recEntry])"
        @keydown.space.prevent="go(R[recEntry])"
      >
        <el-card shadow="never" class="card-reset">
          <div class="mood-row">
            <!-- 左侧：台词 + 中置胶囊 + 建议（保留 icon） -->
            <div class="mood-copy">
              <div class="mood-line">{{ moodLine }}</div>

              <!-- 中置胶囊：处于“心情状态”和“推荐行动”之间 -->
              <div class="mid-chip">{{ chipText }}</div>

              <div class="mood-suggest">
                <div class="mood-title">
                  <span class="mood-emoji" aria-hidden="true">{{ recEmoji }}</span>
                  {{ recTitle }}
                </div>
                <div class="mood-desc" id="mood-desc">{{ recDesc }}</div>
              </div>
            </div>

            <!-- 右侧：主猫插画（随机，不与心情绑定） -->
            <img class="mascot-right" :src="mascotSrc" alt="" aria-hidden="true" decoding="async" />
          </div>
        </el-card>
      </div>
    </section>

    <!-- S3 结构化开始（任务拆分 · 常驻） -->
    <section class="section">
      <h2 class="sec-title">
        <span class="dot" aria-hidden="true">●</span>
        I'm ready to move forward step by step!
      </h2>

      <div
        class="pressable hero"
        v-breath
        role="button"
        tabindex="0"
        :aria-describedby="'hero-desc'"
        @click="go(R.breakdown)"
        @keydown.enter.prevent="go(R.breakdown)"
        @keydown.space.prevent="go(R.breakdown)"
      >
        <el-card shadow="never" class="card-reset">
          <div class="hero-row">
            <div class="hero-emoji" aria-hidden="true">✂️</div>
            <div class="hero-text">
              <div class="hero-title">
                {{
                  unfinished.breakdown
                    ? `Keep breaking it down: ${unfinished.title || 'Last mini goal'}`
                    : 'Start with the tiniest step'
                }}
              </div>
              <div class="hero-desc" id="hero-desc">
                Use AI to break tasks into outrageously tiny steps and move forward one by one
              </div>
            </div>
          </div>
        </el-card>
      </div>
    </section>

    <!-- S4 备用入口（自由但次要） -->
    <section class="section">
      <h2 class="sec-title">
        <span class="dot" aria-hidden="true">●</span>
        I can also start this way
      </h2>

      <div class="grid-2">
        <!-- Mood Bait -->
        <div
          class="pressable tile"
          v-breath
          role="button"
          tabindex="0"
          :aria-describedby="'moodbait-desc'"
          @click="go(R.mood)"
          @keydown.enter.prevent="go(R.mood)"
          @keydown.space.prevent="go(R.mood)"
        >
          <el-card shadow="never" class="card-reset">
            <div class="tile-emoji" aria-hidden="true">🌤️</div>
            <div class="tile-title">Mood Bait</div>
            <div class="tile-desc" id="moodbait-desc">
              Not sure how to begin? Pick a mood first to find your way in.
            </div>
          </el-card>
        </div>

        <!-- Task Card -->
        <div
          class="pressable tile"
          v-breath
          role="button"
          tabindex="0"
          :aria-describedby="'taskcard-desc'"
          @click="go(R.tasks)"
          @keydown.enter.prevent="go(R.tasks)"
          @keydown.space.prevent="go(R.tasks)"
        >
          <el-card shadow="never" class="card-reset">
            <div class="tile-emoji" aria-hidden="true">🎴</div>
            <div class="tile-title">Task card draw</div>
            <div class="tile-desc" id="taskcard-desc">
              Grab a small task at random to start the day—it works great!
            </div>
          </el-card>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
/**
 * 方案C（你的改版）：S1~S4
 * 本次仅对 S2 做布局/文案结构的“最小手术”：
 * - 移除右上角 badge；插入“中置胶囊”
 * - 推荐行动标题左侧加入 icon（按内容选，不与 S3/S4 重复）
 */
import { ElCard } from 'element-plus'
import { useRouter } from 'vue-router'
import type { Directive } from 'vue'
import type { UIMood as MoodKey } from '@/entities/mood'
import { HOME_STATE_META } from '@/features/home/constants/homeState'

const router = useRouter()

/** 路由候选（name + path 双保险） */
type Target = { name?: string; path?: string }
const R: Record<'breakdown' | 'mood' | 'tasks' | 'journal', Target[]> = {
  breakdown: [{ name: 'home.breakdown' }, { path: '/home/breakdown' }],
  mood: [{ name: 'home.mood' }, { path: '/home/mood' }],
  tasks: [{ name: 'home.tasks' }, { path: '/home/tasks' }],
  journal: [{ name: 'home.journal' }, { path: '/home/journal' }],
}

/** —— 主猫插画（随机，不与心情绑定） —— */
/** —— 主猫插画（按天固定；不与心情绑定） —— */
const mascots = [
  new URL('@/assets/mascots/cat1.png', import.meta.url).href,
  new URL('@/assets/mascots/cat2.png', import.meta.url).href,
  new URL('@/assets/mascots/cat3.png', import.meta.url).href,
  new URL('@/assets/mascots/cat4.png', import.meta.url).href,
]

const MASCOT_LS_KEY = 'nc.mascot.today' // 存 JSON：{ date: 'YYYY-MM-DD', src: '...' }
const today = new Date().toISOString().slice(0, 10)
const pickMascot = () => mascots[Math.floor(Math.random() * mascots.length)]

let mascotSrc: string
try {
  const raw = localStorage.getItem(MASCOT_LS_KEY)
  const cached = raw ? (JSON.parse(raw) as { date?: string; src?: string }) : null
  if (cached?.date === today && cached?.src) {
    mascotSrc = cached.src
  } else {
    mascotSrc = pickMascot()
    localStorage.setItem(MASCOT_LS_KEY, JSON.stringify({ date: today, src: mascotSrc }))
  }
} catch {
  // JSON 异常或 Storage 不可用时退化为当次随机
  mascotSrc = pickMascot()
}

/** —— 心情状态选择（优先最近一次，其次随机） —— */
const moodKeys = Object.keys(HOME_STATE_META) as MoodKey[]
const lastMood = (localStorage.getItem('nc.lastMoodKey') || '') as MoodKey
const moodKey: MoodKey = moodKeys.includes(lastMood)
  ? lastMood
  : moodKeys[Math.floor(Math.random() * moodKeys.length)]
const state = HOME_STATE_META[moodKey]

/** —— 断点续接（占位：localStorage；后续接入 store 替换） —— */
const unfinished = {
  breakdown: localStorage.getItem('nc.unfinished.breakdown') === '1',
  mood: localStorage.getItem('nc.unfinished.mood') === '1',
  tasks: localStorage.getItem('nc.unfinished.tasks') === '1',
  title: localStorage.getItem('nc.unfinished.breakdown.title') || '',
  get any() {
    return this.breakdown || this.mood || this.tasks
  },
}

/** —— S2：台词、胶囊、推荐（含 icon） —— */
const moodLine = unfinished.any
  ? "🐾 Welcome back! Your last progress is still here—let's keep going!"
  : state.line

type Rec = 'breakdown' | 'mood' | 'tasks' | 'journal'
const recEntry: Rec =
  (unfinished.breakdown && 'breakdown') ||
  (unfinished.mood && 'mood') ||
  (unfinished.tasks && 'tasks') ||
  state.recEntry

const chipText = unfinished.any ? 'Resume last time' : "Cat's pick"

const recTitle = unfinished.any
  ? 'Resume last time'
  : recEntry === 'breakdown'
  ? 'Start with the tiniest step'
  : recEntry === 'mood'
  ? 'Feed a small fish snack first'
  : recEntry === 'tasks'
  ? 'Draw a small card'
  : 'Log today'

const recDesc = unfinished.any
  ? unfinished.breakdown
    ? `Return to the last breakdown: ${unfinished.title || 'Untitled task'}`
    : unfinished.mood
    ? 'Keep using mood bait to wake up your focus'
    : 'Keep working on the task card you just drew'
  : state.action

/** 推荐行动 icon：续接优先 ⏯️，否则按内容使用当前心情的 icon（不与 S3/S4 重复） */
const recEmoji = unfinished.any ? '⏯️' : state.icon

/** —— 通用跳转（轻延时；尊重 reduced-motion） —— */
const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const go = async (candidates: Target[]) => {
  if (!prefersReduced) await sleep(120)
  for (const to of candidates) {
    try {
      await router.push(to)
      return
    } catch {
      /* next candidate */
    }
  }
}

/** —— 本地指令：触碰“呼吸”反馈 —— */
type H = {
  down: (e: Event) => void
  key: (e: KeyboardEvent) => void
  click?: (e: MouseEvent) => void
  timer?: number
}
const breathHandlers = new WeakMap<Element, H>()
const vBreath: Directive<HTMLElement> = {
  mounted(el) {
    const trigger = () => {
      el.classList.remove('is-breathing')
      void (el as HTMLElement).offsetWidth
      el.classList.add('is-breathing')
      const h = breathHandlers.get(el)
      if (h?.timer) window.clearTimeout(h.timer)
      const timer = window.setTimeout(() => el.classList.remove('is-breathing'), 420)
      breathHandlers.set(el, { ...(h || {}), down, key, click, timer })
    }
    const down = (_e: Event) => trigger()
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') trigger()
    }
    const click = (_e: MouseEvent) => trigger()

    el.addEventListener('pointerdown', down, { passive: true })
    el.addEventListener('keydown', key as any)
    el.addEventListener('click', click)
    breathHandlers.set(el, { down, key, click })
  },
  beforeUnmount(el) {
    const h = breathHandlers.get(el)
    if (!h) return
    el.removeEventListener('pointerdown', h.down)
    el.removeEventListener('keydown', h.key as any)
    if (h.click) el.removeEventListener('click', h.click as any)
    if (h.timer) window.clearTimeout(h.timer)
    breathHandlers.delete(el)
  },
}
</script>

<style scoped>
/* ===== Mobile-first & 安全区 ===== */
.m-page {
  max-width: 600px;
  margin: 0 auto;
  padding: clamp(10px, 3vw, 16px) clamp(10px, 3.5vw, 20px) 96px;
}
.safe-bottom {
  padding-bottom: calc(12px + env(safe-area-inset-bottom));
}

/* ===== S1 品牌标题 ===== */
.m-hd.brand {
  padding: 2px 2px 8px;
}
.m-title {
  font-size: clamp(22px, 6vw, 26px);
  font-weight: 900;
  margin: 0;
  letter-spacing: 0.2px;
}
.m-en {
  margin-top: 2px;
  font-size: clamp(11px, 3.2vw, 13px);
  letter-spacing: 0.12em;
  text-transform: none;
  color: #6b7280; /* slate-500 */
  font-weight: 600;
}

/* ===== 分区标题 ===== */
.section {
  margin-top: clamp(14px, 4vw, 20px);
}
.sec-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: clamp(14px, 4.4vw, 16px);
  font-weight: 900;
  letter-spacing: 0.2px;
  margin: 0 0 clamp(8px, 2.6vw, 12px);
  color: #222;
}
  .sec-title .dot {
    /* Hide corrupt inline char and render bullet via pseudo */
    font-size: 0;
    position: relative;
  }
  .sec-title .dot::before {
    content: '•';
    font-size: 14px;
    color: #8b5cf6;
    transform: translateY(-1px);
    display: inline-block;
  }
.sec-title.primary .bar {
  width: 8px;
  height: clamp(18px, 5.2vw, 22px);
  border-radius: 6px;
  background: linear-gradient(180deg, #7c3aed, #22d3ee);
}

/* ===== 通用“按钮卡片”外层 ===== */
.pressable {
  border-radius: 18px;
  cursor: pointer;
  user-select: none;
  background: linear-gradient(135deg, #f5f3ff 0%, #eef2ff 50%, #ecfeff 100%);
  border: 1px solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.03), 0 4px 10px rgba(0, 0, 0, 0.06);
  transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease,
    filter 160ms ease;
}
.pressable:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 0 rgba(0, 0, 0, 0.03), 0 10px 20px rgba(0, 0, 0, 0.1);
}
.pressable:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.2), 0 8px 24px rgba(124, 58, 237, 0.18);
  border-color: rgba(124, 58, 237, 0.25);
}
.card-reset {
  background: transparent;
  border: none;
}
:deep(.card-reset .el-card__body) {
  padding: 0;
}

/* ===== 呼吸动画（触按反馈） ===== */
@keyframes breathTap {
  0% {
    transform: scale(1);
    box-shadow: 0 0 0 rgba(124, 58, 237, 0);
  }
  50% {
    transform: scale(1.03);
    box-shadow: 0 10px 20px rgba(124, 58, 237, 0.1);
  }
  100% {
    transform: scale(1);
    box-shadow: 0 0 0 rgba(124, 58, 237, 0);
  }
}
.pressable.is-breathing {
  animation: breathTap 420ms ease;
}
@media (prefers-reduced-motion: reduce) {
  .pressable.is-breathing {
    animation: none !important;
  }
}

/* ===== S2 心情 + 主猫 ===== */
.mood-card {
  padding: clamp(12px, 3.6vw, 18px);
  position: relative;
}
.mood-row {
  display: grid;
  align-items: center;
  grid-template-columns: 1fr auto;
  gap: clamp(8px, 2.8vw, 16px);
  min-height: clamp(110px, 28vw, 160px);
}
.mood-copy {
  padding-right: clamp(0px, 2vw, 8px);
}
.mood-line {
  font-size: clamp(14px, 4.4vw, 16px);
  font-weight: 800;
  line-height: 1.4;
}

/* 中置胶囊：替代右上角 badge，居中于两段之间 */
.mid-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin: 8px 0 6px;
  padding: 4px 10px;
  border-radius: 999px;
  background: #fde68a;
  color: #6b4f1d;
  font-weight: 800;
  font-size: 12px;
  letter-spacing: 0.2px;
}

.mood-suggest {
  margin-top: 4px;
}
.mood-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: clamp(14px, 4.2vw, 16px);
  font-weight: 900;
}
.mood-emoji {
  font-size: clamp(16px, 4.6vw, 18px);
  line-height: 1;
}
.mood-desc {
  margin-top: 4px;
  color: var(--el-text-color-secondary);
  font-size: clamp(12px, 3.6vw, 14px);
  line-height: 1.4;
}

.mascot-right {
  width: clamp(84px, 26vw, 132px);
  height: auto;
  filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.06));
  pointer-events: none;
  user-select: none;
}

/* ===== S3 任务拆分 Hero ===== */
.hero {
  padding: clamp(14px, 4vw, 22px);
}
.hero-row {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: clamp(10px, 3.2vw, 16px);
  min-height: clamp(120px, 32vw, 172px);
}
.hero-emoji {
  font-size: clamp(28px, 8vw, 40px);
  line-height: 1;
}
.hero-title {
  font-size: clamp(16px, 4.8vw, 20px);
  font-weight: 900;
}
.hero-desc {
  font-size: clamp(12px, 3.8vw, 14px);
  color: var(--el-text-color-secondary);
  margin-top: 4px;
}

/* ===== S4 备用入口 ===== */
.grid-2 {
  display: grid;
  grid-template-columns: 1fr;
  gap: clamp(10px, 3.2vw, 14px);
}
@media (min-width: 420px) {
  .grid-2 {
    grid-template-columns: 1fr 1fr;
  }
}
.tile {
  padding: clamp(12px, 3.6vw, 18px);
  min-height: clamp(84px, 22vw, 116px);
  position: relative;
}
  .tile-emoji {
    font-size: clamp(22px, 6.4vw, 30px);
  }
.tile-title {
  margin-top: 6px;
  font-weight: 900;
  font-size: clamp(14px, 4.2vw, 16px);
}
.tile-sub {
  font-size: clamp(11px, 3.4vw, 13px);
  color: #8b8b8b;
}
.tile-desc {
  margin-top: 4px;
  color: var(--el-text-color-secondary);
  font-size: clamp(12px, 3.6vw, 14px);
  line-height: 1.4;
}
.corner {
  position: absolute;
  right: 10px;
  top: 10px;
  font-size: 11px;
  background: rgba(124, 58, 237, 0.12);
  color: #6b21a8;
  padding: 3px 8px;
  border-radius: 999px;
  font-weight: 800;
}
</style>
