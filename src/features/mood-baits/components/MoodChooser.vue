<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import type { MoodCardView } from '@/features/mood-baits/services/mood.service'
import { EditPen, Delete as DeleteIcon } from '@element-plus/icons-vue'

const props = defineProps<{
  cards: MoodCardView[]
  selected: string
  /** 保留的最少心情数，<= 该值时禁用删除；默认 1 */
  minKeep?: number
  /** 是否显示操作按钮（编辑/删除）。未传时自动：桌面显示、触屏隐藏 */
  showActions?: boolean
}>()

const emit = defineEmits<{
  (e: 'select', value: string): void
  (e: 'request-edit', value: string): void
  (e: 'request-delete', value: string): void
}>()

/* ------------------- 设备能力：自动决定是否显式按钮 ------------------- */
const isCoarsePointer = ref(false)
const showOps = computed(() =>
  props.showActions === undefined ? !isCoarsePointer.value : !!props.showActions
)

let mql: MediaQueryList | null = null
onMounted(() => {
  if (typeof window !== 'undefined' && 'matchMedia' in window) {
    mql = window.matchMedia('(pointer: coarse)')
    isCoarsePointer.value = !!mql.matches
    mql.addEventListener?.('change', onMQChange)
  }
})
onBeforeUnmount(() => {
  mql?.removeEventListener?.('change', onMQChange)
})
function onMQChange(e: MediaQueryListEvent) {
  isCoarsePointer.value = !!e.matches
}

/* --------------------------- 手势：长按/右滑 --------------------------- */
let pressTimer: number | null = null
let startX = 0
let startY = 0
let pendingVal = ''
const LONG_PRESS_MS = 600
const SWIPE_THRESHOLD = 80

function clearPress() {
  if (pressTimer) {
    clearTimeout(pressTimer)
    pressTimer = null
  }
  startX = 0
  startY = 0
  pendingVal = ''
}
function onTouchStart(value: string, e: TouchEvent) {
  pendingVal = value
  startX = e.touches[0]?.clientX ?? 0
  startY = e.touches[0]?.clientY ?? 0
  clearPress()
  pressTimer = window.setTimeout(() => {
    emit('request-delete', value) // 长按触发删除请求
    clearPress()
  }, LONG_PRESS_MS)
}
function onTouchMove(e: TouchEvent) {
  if (!startX && !startY) return
  const dx = (e.touches[0]?.clientX ?? 0) - startX
  const dy = (e.touches[0]?.clientY ?? 0) - startY
  // 水平右滑优先，且避免轻微抖动
  if (Math.abs(dx) > Math.abs(dy) && dx > SWIPE_THRESHOLD) {
    clearPress()
    if (pendingVal) emit('request-delete', pendingVal)
  }
}
function onTouchEnd() {
  clearPress()
}

/* ------------------------------ 交互映射 ------------------------------ */
function onSelect(value: string) {
  emit('select', value)
  navigator?.vibrate?.(8)
}
function onDblEdit(value: string) {
  emit('request-edit', value)
}
function onClickEdit(e: MouseEvent, value: string) {
  e.stopPropagation()
  emit('request-edit', value)
}
function onClickDelete(e: MouseEvent, value: string) {
  e.stopPropagation()
  emit('request-delete', value)
}
function onKeydownCard(e: KeyboardEvent, value: string) {
  // 可访问性快捷键
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    emit('select', value)
  } else if (e.key === 'e' || e.key === 'E' || e.key === 'F2') {
    e.preventDefault()
    emit('request-edit', value)
  } else if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault()
    emit('request-delete', value)
  }
}

const canDelete = computed(() => (props.cards?.length || 0) > (props.minKeep ?? 1))
</script>

<template>
  <div class="m-grid">
    <button
      v-for="c in cards"
      :key="c.value"
      class="m-card"
      :class="{ active: selected === c.value }"
      type="button"
      @click="onSelect(c.value)"
      @dblclick="onDblEdit(c.value)"
      @keydown="onKeydownCard($event, c.value)"
      @touchstart.passive="onTouchStart(c.value, $event)"
      @touchmove.passive="onTouchMove($event)"
      @touchend.passive="onTouchEnd"
      @touchcancel.passive="onTouchEnd"
      :aria-pressed="selected === c.value"
      :aria-label="c.meta.label"
      tabindex="0"
    >
      <div class="m-emoji">{{ c.meta.icon }}</div>
      <div class="m-label">{{ c.meta.label }}</div>
      <div class="m-desc">{{ c.meta.sub }}</div>

      <!-- 操作区（桌面显式/移动隐藏，或外部强制 showActions） -->
      <div class="m-actions" :class="{ show: showOps }" @click.stop>
        <el-button text size="small" type="primary" @click="onClickEdit($event, c.value)">
          <el-icon style="margin-right: 4px"><EditPen /></el-icon> edit
        </el-button>
        <el-button
          text
          size="small"
          type="danger"
          :disabled="!canDelete"
          @click="onClickDelete($event, c.value)"
        >
          <el-icon style="margin-right: 4px"><DeleteIcon /></el-icon> delete
        </el-button>
      </div>

      <!-- 已选标记（弱提示，真正的“选中”由样式体现） -->
      
    </button>
  </div>
</template>

<style scoped>
.m-grid {
  margin-top: 10px;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
}
@media (min-width: 560px) {
  .m-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
@media (min-width: 880px) {
  .m-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

.m-card {
  width: 100%;
  min-height: 176px;
  border: none;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  padding: 16px;
  text-align: left;
  cursor: pointer;
  position: relative;
  transition: transform 0.06s ease;
}
.m-card:active {
  transform: scale(0.98);
}
.m-card.active {
  outline: 2px solid var(--el-color-primary);
}

.m-emoji {
  font-size: 36px;
}
.m-label {
  margin-top: 6px;
  font-weight: 700;
  font-size: 18px;
}
.m-desc {
  margin-top: 4px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  line-height: 1.4;
}

.m-check {
  position: absolute;
  bottom: 10px;
  left: 14px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

/* 操作区：默认仅桌面显式；移动端隐藏（可被 props 强制显示） */
.m-actions {
  position: absolute;
  top: 8px;
  right: 8px;
  display: none;
  gap: 6px;
}
.m-actions::before {
  content: '';
  position: absolute;
  inset: -6px; /* 隐形热区扩大 */
}
.m-actions.show {
  display: flex;
}
.m-card:hover .m-actions {
  display: flex;
}
</style>
