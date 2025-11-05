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

// Allow bypassing the leave guard once (after user confirms)
const allowLeaveOnce = ref(false)

type JournalMode = 'free' | 'template'
const mode = ref<JournalMode>((getLS(LS.journalMode, 'template') as JournalMode) || 'template')
function setMode(m: JournalMode) {
  mode.value = m
  setLS(LS.journalMode, m)
}

// Editor content and draft persistence (template mode)
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
  return `# ${formatDayKeyLocalSlash(dayKeyLocal)}\n\n## Miracle Daily Wrap-up (draft)\n`
}

// Switch mode between free-note and template-note
async function onModeChange(next: JournalMode) {
  setMode(next)
  if (next === 'template') {
    // If empty, initialize template skeleton and persist draft
    if (!text.value.trim()) {
      text.value = renderTemplateSkeleton()
      setLS(draftKey, text.value)
    }
    await nextTick()
  } else {
    // Free mode clears template draft content
    text.value = ''
    setLS(draftKey, '')
    await nextTick()
  }
}

const canSubmit = computed(() => text.value.trim().length > 0)

// Submit: write Summary(final), broadcast reward event, clear draft, and go back
async function add() {
  const t = text.value.trim()
  if (!t) return

  // Persist final summary
  summary.addFinal({
    text: t,
    dayKeyLocal: todayDayKeyLocal(),
    templateId: DEFAULT_TEMPLATE_ID,
    templateVersion: 1,
  })

  // Broadcast journal-created event (RewardCenter will enqueue sticker)
  logJournalCreated({
    dayKeyLocal: toDayKeyLocal(new Date()),
    source: mode.value, // 'free' | 'template'
    length: t.length,
  })

  // Clear draft and input
  if (mode.value === 'template') setLS(draftKey, '')
  text.value = ''

  // Navigate back to sticker wall
  try {
    await router.replace({ name: 'records.sticker-wall' })
  } catch {
    await router.replace('/records/sticker-wall')
  }
}

// Leave confirmation dialog control
const showLeaveDialog = ref(false)
let pendingTo: RouteLocationRaw | null = null

function confirmLeave() {
  const to = pendingTo
  pendingTo = null
  showLeaveDialog.value = false
  allowLeaveOnce.value = true
  if (to) router.replace(to).finally(() => {
    // Reset guard after navigation completes
    allowLeaveOnce.value = false
  })
}
function cancelLeaveDialog() {
  pendingTo = null
  showLeaveDialog.value = false
}

// Route leave guard: show dialog if there are unsaved changes
onBeforeRouteLeave((to) => {
  if (allowLeaveOnce.value) return true
  const dirty = mode.value === 'template'
    ? getLS(draftKey, '').trim() !== ''
    : text.value.trim() !== ''
  if (!dirty) return true
  pendingTo = to
  showLeaveDialog.value = true
  return false
})
</script>

<template>
  <div class="m-page">
    <PageHeader title="Miracle Journal" />

    <div class="mode">
      <button
        class="pill"
        :class="{ active: mode === 'free' }"
        @click="onModeChange('free')"
        :aria-pressed="mode === 'free'"
      >
        Free note
      </button>
      <button
        class="pill"
        :class="{ active: mode === 'template' }"
        @click="onModeChange('template')"
        :aria-pressed="mode === 'template'"
      >
        Template note
      </button>
    </div>

    <div class="form">
      <textarea
        class="editor"
        v-model="text"
        rows="12"
        placeholder="Write your journal here... Press Ctrl/Cmd + Enter to submit."
        @input="mode === 'template' && saveDraftDebounced()"
        @keydown.ctrl.enter.prevent="add"
        @keydown.meta.enter.prevent="add"
      />
      <button class="btn" :disabled="!canSubmit" @click="add">Save</button>
    </div>

    <!-- Leave confirmation dialog -->
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
          <div class="dlg-title" id="leave-title">Leave this page?</div>
          <p class="dlg-desc">You have unsaved changes. Drafts in template mode are auto-saved locally.</p>
        </div>
        <div class="dlg-actions">
          <button class="seg-btn seg-btn--outline" @click="confirmLeave">Leave</button>
          <button class="seg-btn seg-btn--solid" @click="cancelLeaveDialog">Continue editing</button>
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

/* Mode switch controls */
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

/* Segmented buttons in dialog footer */
.seg-btn{
  border:1px solid #eaecef; background:#fff; color:#606266;
  border-radius:999px; padding:8px 12px;
  font-weight:800; font-size:13px; letter-spacing:.1px; cursor:pointer;
  transition: background-color .15s ease, border-color .15s ease, color .15s ease, opacity .15s ease;
}
.seg-btn--solid{ background:#f0f3ff; border-color:#dfe6ff; color:#111 }
.seg-btn--outline{ background:#fff; border-color:#eaecef; color:#606266 }
.seg-btn:disabled{ opacity:.5; cursor:not-allowed }

/* Center dialog */
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

