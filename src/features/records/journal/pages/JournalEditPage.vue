<!-- src/features/records/journal/pages/JournalEditPage.vue -->
<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRouter, onBeforeRouteLeave } from 'vue-router'
import type { RouteLocationRaw } from 'vue-router'
import PageHeader from '@/shared/components/PageHeader.vue'

import { LS } from '@/shared/constants/ls-keys'
import { getLS, setLS } from '@/shared/utils/storage'

import { useNCJournalSummaryStore } from '../stores'
import { getTemplateSpec, DEFAULT_TEMPLATE_ID } from '../constants/registry'
import { todayDayKeyLocal, formatDayKeyLocalSlash, toDayKeyLocal } from '../utils/dayKeyLocal'

import { logJournalCreated } from '@/app/analytics'

defineOptions({ name: 'JournalEditPage' })

const router = useRouter()
const summary = useNCJournalSummaryStore()

/** 允许下一次导航通过离开守卫（用于“确认离开”后放行一次） */
const allowLeaveOnce = ref(false)

type JournalMode = 'free' | 'template'
const mode = ref<JournalMode>((getLS(LS.journalMode, 'template') as JournalMode) || 'template')
function setMode(m: JournalMode) {
  mode.value = m
  setLS(LS.journalMode, m)
}

/** 文本与草稿 */
const text = ref('')
const draftKey = LS.journalDraftTemplate ?? 'nc:journal:draft:template'
let draftTimer: number | null = null
function saveDraftDebounced() {
  if (draftTimer) window.clearTimeout(draftTimer)
  draftTimer = window.setTimeout(() => setLS(draftKey, text.value), 500)
}

onMounted(() => {
  summary.load?.()
  const draft = getLS(draftKey, '')
  if (mode.value === 'template') {
    text.value = draft?.trim() ? draft : renderTemplateSkeleton()
    setLS(draftKey, text.value)
  } else {
    text.value = ''
  }
})
onBeforeUnmount(() => {
  if (draftTimer) window.clearTimeout(draftTimer)
})

function renderTemplateSkeleton(): string {
  const tpl = getTemplateSpec(DEFAULT_TEMPLATE_ID)
  const dayKeyLocal = todayDayKeyLocal()
  if (tpl?.renderLocalDraft) return tpl.renderLocalDraft({ dayKeyLocal, notes: [] })
  return `# ${formatDayKeyLocalSlash(dayKeyLocal)}\n\n## 🗓️ 奇蹟日終記錄｜\n`
}

/** 切换模式（已移除“追加模板骨架？”确认流程） */
async function onModeChange(next: JournalMode) {
  setMode(next)
  if (next === 'template') {
    // 仅在当前为空时生成骨架；否则保持现有内容不变（不再追加模板）
    if (!text.value.trim()) {
      text.value = renderTemplateSkeleton()
      setLS(draftKey, text.value)
    }
    await nextTick()
  } else {
    // 自由模式：清空并移除草稿
    text.value = ''
    setLS(draftKey, '')
    await nextTick()
  }
}

const canSubmit = computed(() => text.value.trim().length > 0)

/** 提交：写入 Summary → 触发奖励事件 → 清草稿 → 返回贴纸墙 */
async function add() {
  const t = text.value.trim()
  if (!t) return

  // 入库到“总结/日记”集合
  summary.addFinal({
    text: t,
    dayKeyLocal: todayDayKeyLocal(),
    templateId: DEFAULT_TEMPLATE_ID,
    templateVersion: 1,
  })

  // 广播奖励事件（RewardCenter 会弹贴纸）
  logJournalCreated({
    dayKeyLocal: toDayKeyLocal(new Date()),
    source: mode.value, // 'free' | 'template'
    length: t.length,
  })

  // 清草稿与输入
  if (mode.value === 'template') setLS(draftKey, '')
  text.value = ''

  // 返回贴纸墙（使用命名路由；失败再兜底路径）
  try {
    await router.replace({ name: 'records.sticker-wall' })
  } catch {
    await router.replace('/records/sticker-wall')
  }
}

/** —— 中置对话框：离开编辑确认 —— */
const showLeaveDialog = ref(false)
let pendingTo: RouteLocationRaw | null = null

function confirmLeave() {
  const to = pendingTo
  pendingTo = null
  showLeaveDialog.value = false
  allowLeaveOnce.value = true
  if (to) router.replace(to).finally(() => {
    // 导航完成后复位许可（双保险）
    allowLeaveOnce.value = false
  })
}
function cancelLeaveDialog() {
  pendingTo = null
  showLeaveDialog.value = false
}

// 软拦截：弹中置对话框，而不是浏览器 confirm
onBeforeRouteLeave((to, _from, next) => {
  if (allowLeaveOnce.value) {
    allowLeaveOnce.value = false
    return next()
  }
  if (!text.value.trim()) return next()
  showLeaveDialog.value = true
  pendingTo = to
  next(false)
})
</script>

<template>
  <div class="m-page">
    <PageHeader title="新增奇迹日记" />

    <div class="mode">
      <button
        class="pill"
        :class="{ active: mode === 'free' }"
        @click="onModeChange('free')"
        :aria-pressed="mode === 'free'"
      >
        自由记录
      </button>
      <button
        class="pill"
        :class="{ active: mode === 'template' }"
        @click="onModeChange('template')"
        :aria-pressed="mode === 'template'"
      >
        模板记录
      </button>
    </div>

    <div class="form">
      <textarea
        class="editor"
        v-model="text"
        rows="12"
        placeholder="写下今天的小奇迹吧～（Ctrl/⌘ + Enter 提交）"
        @input="mode === 'template' && saveDraftDebounced()"
        @keydown.ctrl.enter.prevent="add"
        @keydown.meta.enter.prevent="add"
      />
      <button class="btn" :disabled="!canSubmit" @click="add">记录</button>
    </div>

    <!-- 中置对话框：离开确认 -->
    <Teleport to="body">
      <div
        v-if="showLeaveDialog"
        class="dlg-mask"
        aria-hidden="true"
        @click="cancelLeaveDialog"
        @touchmove.prevent
      />
      <div
        v-if="showLeaveDialog"
        class="dlg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="leave-title"
        @click.stop
      >
        <div class="dlg-body">
          <div class="dlg-title" id="leave-title">确定要离开吗？</div>
          <p class="dlg-desc">当前还有未提交内容（草稿已自动保存，下次可继续）。</p>
        </div>
        <div class="dlg-actions">
          <button class="seg-btn seg-btn--outline" @click="confirmLeave">离开</button>
          <button class="seg-btn seg-btn--solid" @click="cancelLeaveDialog">继续填写</button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.m-page {
  max-width: 640px;
  margin: 0 auto;
  padding: 12px;
}

/* 顶部模式切换（与其它页统一的胶囊风格） */
.mode { display: flex; gap: 8px; margin: 8px 0 10px; }
.pill {
  border: 1px solid #eaecef; background: #fff; border-radius: 999px;
  padding: 6px 12px; cursor: pointer; font-weight: 700; color: #606266;
}
.pill.active {
  background: linear-gradient(135deg, #f5f3ff 0%, #eef2ff 50%, #ecfeff 100%);
  color: #111;
}

.form { display: flex; flex-direction: column; gap: 10px; }
.editor{
  width: 100%; box-sizing: border-box; border: 1px solid #eaecef; border-radius: 10px; padding: 10px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
  line-height: 1.6; font-size: 14px; min-height: 200px;
}
.btn{
  width: 100%; border: 0; border-radius: 999px; padding: 12px 16px;
  font-weight: 900; font-size: 16px; color: #fff;
  background: linear-gradient(135deg, #7c3aed 0%, #22d3ee 100%); cursor: pointer;
}
.btn:disabled { opacity: .5; cursor: not-allowed }

/* 胶囊分段按钮（用于对话框底部操作与其它场景统一） */
.seg-btn{
  border:1px solid #eaecef; background:#fff; color:#606266;
  border-radius:999px; padding:8px 12px;
  font-weight:800; font-size:13px; letter-spacing:.1px; cursor:pointer;
  transition: background-color .15s ease, border-color .15s ease, color .15s ease, opacity .15s ease;
}
.seg-btn--solid{ background:#f0f3ff; border-color:#dfe6ff; color:#111 }
.seg-btn--outline{ background:#fff; border-color:#eaecef; color:#606266 }
.seg-btn:disabled{ opacity:.5; cursor:not-allowed }

/* 中置对话框（与详情页一致的轻量样式） */
.dlg-mask{
  position: fixed; inset: 0; background: rgba(0,0,0,.25); z-index: 300;
}
.dlg{
  position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%);
  width: min(88vw, 420px); z-index: 350;
  background: #fff; border-radius: 14px; border:1px solid #eef0f4;
  box-shadow: 0 10px 30px rgba(0,0,0,.10);
  animation: dlgIn .16s ease-out;
}
.dlg-body{ padding: 14px 14px 0 }
.dlg-title{ font-weight: 900; font-size: 16px; color:#111; text-align:center }
.dlg-desc{ color:#606266; text-align:center; margin:6px 0 0; font-size: 13px }
.dlg-actions{
  display:flex; justify-content:center; gap:10px;
  padding: 12px 14px 14px;
}
@keyframes dlgIn { from { transform: translate(-50%, -48%); opacity:.6 } to { transform: translate(-50%, -50%); opacity:1 } }
</style>
