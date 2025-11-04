<!-- scr/features/records/sticker-wall/pages/StickerWallPage.vue -->
<template>
  <div class="m-page">
    <!-- 顶部：返回（默认 fallback='/' 即回首页） -->
    <PageHeader>
      <template #extra>
        <div class="badges">
          <span class="tag tag--ok">贴纸总数：{{ sticker.stickers.length }} 枚</span>
          <span class="tag tag--warn">今日贴纸：{{ todayCount }} 枚</span>
        </div>
      </template>
    </PageHeader>

    <!-- 顶部子页签 -->
    <nav class="seg-tabs" role="tablist" aria-label="记录导航">
      <button class="seg-item active" role="tab" aria-selected="true" tabindex="0" v-breath>
        爪印墙
      </button>
      <button
        class="seg-item"
        role="tab"
        aria-selected="false"
        tabindex="0"
        @click="goHistory"
        v-breath
      >
        时间轴
      </button>
      <button
        class="seg-item"
        role="tab"
        aria-selected="false"
        tabindex="0"
        @click="goAnalytics"
        v-breath
      >
        数据分析
      </button>
    </nav>

    <!-- 内容 -->
    <div class="m-groups">
      <template v-if="grouped.length">
        <section v-for="g in grouped" :key="g.key" class="m-group">
          <div class="g-title">{{ g.label }}</div>

          <template v-if="g.stickers.length">
            <div class="g-subtitle">爪印墙</div>
            <div
              class="paw-grid"
              :style="{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }"
            >
              <div
                v-for="s in g.stickers"
                :key="s.id"
                class="sticker"
                :title="s.kaomoji"
                role="img"
                :aria-label="`贴纸 ${s.kaomoji}`"
              >
                <div class="kaomoji">{{ s.kaomoji }}</div>
              </div>
              <span
                v-for="i in fillerCount(g.stickers.length)"
                :key="`${g.key}-p-${i}`"
                class="paw"
                aria-hidden="true"
                >🐾</span
              >
            </div>
          </template>

          <div v-if="g.journal.length" class="g-subtitle">奇迹日记</div>
          <div v-if="g.journal.length" class="g-card">
            <ul class="j-list">
              <li v-for="j in g.journal" :key="j.id" class="j-item">
                <button class="j-link" @click="goDetail(j.id)" v-breath>
                  奇迹日记 {{ formatLocalDateSlash(dateFromDayKeyLocal(j.dayKeyLocal)) }}
                </button>
                <span class="j-time" v-if="j.createdAtISO">
                  （{{
                    new Date(j.createdAtISO).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  }}）
                </span>
              </li>
            </ul>
          </div>
        </section>
      </template>

      <template v-else>
        <div class="empty">
          还没有任何记录，先写一条奇迹日记吧～
          <div class="empty-actions">
            <button class="btn" @click="goNew" v-breath>添加奇迹日记</button>
          </div>
        </div>
      </template>
    </div>

    <!-- 悬浮主 CTA（不越界） -->
    <div class="floating-cta">
      <button class="cta-btn" @click="goNew" v-breath aria-label="添加奇迹日记">
        ✨ 添加奇迹日记
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { ref, onMounted, onBeforeUnmount, computed, type Directive } from 'vue'
import PageHeader from '@/shared/components/PageHeader.vue'
import { useNCJournalStore } from '@/features/records/journal/stores/index'
import { useNCStickerStore } from '@/features/records/sticker-wall/store'
import { sameDay } from '@/shared/utils/common'
import { formatLocalDateSlash } from '@/shared/utils/date'

defineOptions({ name: 'StickerWallPage' })

const router = useRouter()
const journal = useNCJournalStore()
const sticker = useNCStickerStore()

onMounted(() => {
  journal.load?.()
  sticker.load?.()
  window.addEventListener('resize', handleResize, { passive: true })
  handleResize()
  // 临时诊断
  console.log('[STICKER] mounted at', location.pathname)
})
onBeforeUnmount(() => window.removeEventListener('resize', handleResize))

/** —— 统计 —— */
const todayCount = computed(() => {
  const today = new Date()
  return sticker.stickers.filter((s) => sameDay(new Date(s.dateISO), today)).length
})

/** —— 分组 —— */
type StickerLite = { id: number; dateISO: string; kaomoji: string }
type SummaryItem = { id: number; text: string; dayKeyLocal: string; createdAtISO?: string }
type Group = { key: string; label: string; stickers: StickerLite[]; journal: SummaryItem[] }

const grouped = computed<Group[]>(() => {
  const map = new Map<string, Group>()
  const ensure = (key: string) => {
    if (!map.has(key)) map.set(key, { key, label: dateLabel(key), stickers: [], journal: [] })
    return map.get(key)!
  }
  for (const s of sticker.stickers as StickerLite[]) ensure(keyFromISO(s.dateISO)).stickers.push(s)
  // ✅ 使用新的 Summary 结构：按 dayKeyLocal 分组
  for (const j of journal.summaries as SummaryItem[]) ensure(j.dayKeyLocal).journal.push(j)
  const arr = Array.from(map.values()).sort((a, b) => (a.key < b.key ? 1 : -1))
  // ✅ 同一天内按 createdAtISO 倒序
  for (const g of arr)
    g.journal.sort((a, b) => ((a.createdAtISO ?? '') < (b.createdAtISO ?? '') ? 1 : -1))
  return arr
})

/** —— 网格列数（移动端友好） —— */
const gridCols = ref(4)
function getColsForWidth(w: number) {
  if (w >= 960) return 8
  if (w >= 640) return 6
  return 4
}
function handleResize() {
  gridCols.value = getColsForWidth(window.innerWidth || 0)
}
function fillerCount(n: number) {
  const c = gridCols.value
  const m = n % c
  return m === 0 ? 0 : c - m
}

/** —— 日期工具 —— */
function keyFromISO(iso: string) {
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
function dateLabel(key: string) {
  const [y, m, d] = key.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const today = new Date()
  if (sameDay(dt, today)) return '今天'
  const yst = new Date(today)
  yst.setDate(today.getDate() - 1)
  if (sameDay(dt, yst)) return '昨天'
  return `${y} / ${m} / ${d}`
}
/** 将 dayKeyLocal 转为 Date（用于模板展示） */
function dateFromDayKeyLocal(key: string) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** —— 顶部子页签跳转（按你的目录） —— */
const goHistory = () => router.push({ name: 'records.history' }).catch(() => {})
const goAnalytics = () => router.push({ name: 'records.analytics' }).catch(() => {})

/** —— 记录跳转 —— */
const goNew = () => router.push({ name: 'records.journal.edit' }).catch(() => {})
const goDetail = (id: number) =>
  router.push({ name: 'records.journal.detail', params: { id } }).catch(() => {})

/** —— 触碰“呼吸”指令（轻量版，仅用于本页） —— */
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
    const down = () => trigger()
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') trigger()
    }
    const click = () => trigger()
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
/* 样式保持不变 */
.m-page {
  max-width: 480px;
  margin: 0 auto;
  padding: 12px 12px calc(var(--layout-footer-h, 56px) + 140px + env(safe-area-inset-bottom));
}

.badges {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.tag {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid #eaecef;
  background: #fafafa;
}
.tag--ok {
  background: #edf9f0;
  border-color: #cfe9d7;
  color: #2e7d32;
}
.tag--warn {
  background: #fff7eb;
  border-color: #ffe0b2;
  color: #c77800;
}

.seg-tabs {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  padding: 6px;
  border-radius: 12px;
  background: #f6f7fb;
  border: 1px solid #eff0f4;
  margin: 4px 0 10px;
}
.seg-item {
  border: 0;
  background: #fff;
  border-radius: 999px;
  padding: 10px 4px;
  font-weight: 800;
  font-size: 13px;
  color: #606266;
  cursor: pointer;
  user-select: none;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  transition: transform 0.16s ease, box-shadow 0.16s ease, color 0.16s ease,
    background-color 0.16s ease;
}
.seg-item.active {
  color: #111;
  background: linear-gradient(135deg, #f5f3ff 0%, #eef2ff 50%, #ecfeff 100%);
  box-shadow: 0 2px 10px rgba(124, 58, 237, 0.1);
}
.seg-item:focus-visible {
  outline: 2px solid rgba(124, 58, 237, 0.25);
}

.m-groups {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.m-group {
  background: #fff;
  border: 1px solid #eaecef;
  border-radius: 14px;
  padding: 10px 12px;
}
.g-title {
  font-weight: 700;
  color: #303133;
  margin-bottom: 6px;
}
.g-subtitle {
  font-size: 12px;
  color: #909399;
  margin: 6px 0 6px;
}

.paw-grid {
  display: grid;
  gap: 8px;
  padding: 2px 0 6px;
}
.sticker {
  min-width: 44px;
  height: 34px;
  border-radius: 10px;
  background: #fffaf2;
  border: 1px dashed #ffcf99;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  padding: 2px 4px;
}
.sticker .kaomoji {
  font-size: 12px;
  line-height: 1;
  white-space: nowrap;
  letter-spacing: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: clip;
}
.paw {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  height: 34px;
  border-radius: 10px;
  border: 1px dashed #e8e9ed;
  background: #fafafa;
  font-size: 12px;
  opacity: 0.55;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
  transform: translateY(calc(var(--j, 0) * 1px)) rotate(calc(var(--r, 0) * 1deg));
}
.paw-grid .paw:nth-of-type(3n) {
  opacity: 0.6;
  --r: -6;
  --j: -1;
}
.paw-grid .paw:nth-of-type(4n) {
  opacity: 0.48;
  --r: 5;
  --j: 1;
}
.paw-grid .paw:nth-of-type(5n) {
  opacity: 0.58;
  --r: 9;
  --j: -2;
}
.paw-grid .paw:nth-of-type(7n) {
  opacity: 0.45;
  --r: -8;
  --j: 2;
}

.g-card {
  border: 1px solid #eaecef;
  border-radius: 10px;
  padding: 8px 10px;
  background: #fff;
}
.j-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.j-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
}
.j-link {
  border: 0;
  background: none;
  color: #409eff;
  cursor: pointer;
  font-weight: 600;
}
.j-time {
  color: #909399;
  font-size: 12px;
}

.empty {
  text-align: center;
  color: #606266;
  padding: 40px 0;
}
.empty-actions {
  margin-top: 10px;
}

/* 悬浮主 CTA：不越界、与内容宽度协调 */
.floating-cta {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  bottom: calc(var(--layout-footer-h, 56px) + 12px + env(safe-area-inset-bottom));
  width: min(92vw, 640px);
  box-sizing: border-box;
  pointer-events: none;
  z-index: 100;
}
.cta-btn {
  pointer-events: auto;
  width: 100%;
  border: 0;
  border-radius: 999px;
  padding: 14px 18px;
  font-weight: 900;
  font-size: 16px;
  color: #fff;
  letter-spacing: 0.2px;
  background: linear-gradient(135deg, #7c3aed 0%, #22d3ee 100%);
  box-shadow: 0 10px 24px rgba(124, 58, 237, 0.25), 0 2px 6px rgba(0, 0, 0, 0.08);
  cursor: pointer;
  user-select: none;
  transition: transform 0.16s ease, box-shadow 0.16s ease, filter 0.16s ease;
}
.cta-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 14px 30px rgba(124, 58, 237, 0.28), 0 4px 10px rgba(0, 0, 0, 0.1);
}
.cta-btn:focus-visible {
  outline: 2px solid rgba(124, 58, 237, 0.28);
}

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
.is-breathing {
  animation: breathTap 420ms ease;
}

@media (min-width: 640px) {
  .m-page {
    max-width: 640px;
  }
}
</style>
