<!-- src/features/records/journal/pages/JournalDetailPage.vue -->
<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '@/shared/components/PageHeader.vue'
import { useNCJournalSummaryStore } from '../stores'
import { formatDayKeyLocalSlash } from '../utils/dayKeyLocal'

defineOptions({ name: 'JournalDetailPage' })

const route = useRoute()
const router = useRouter()
const summary = useNCJournalSummaryStore()

onMounted(() => summary.load?.())

const item = computed(() => {
  const id = Number(route.params.id)
  return summary.summaries.find(s => s.id === id)
})

const title = computed(() => {
  const s = item.value
  if (!s) return '奇迹日记'
  const hhmm = s.createdAtISO
    ? new Date(s.createdAtISO).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : ''
  const dateTxt = formatDayKeyLocalSlash(s.dayKeyLocal)
  return `奇迹日记 ${dateTxt}${hhmm ? `（${hhmm}）` : ''}`
})

/* —— 内联编辑 —— */
const editing = ref(false)
const editText = ref('')
const editorRef = ref<HTMLTextAreaElement | null>(null)

function startEdit() {
  const s = item.value; if (!s) return
  editing.value = true
  editText.value = s.text
  nextTick(() => editorRef.value?.focus?.())
}
function cancelEdit() { editing.value = false }
function saveEdit() {
  const s = item.value; if (!s) return
  const t = editText.value.trim()
  if (!t || t === s.text) { editing.value = false; return }
  summary.updateText(s.id, t)
  editing.value = false
}
const canSave = computed(() => {
  const s = item.value
  if (!s) return false
  const t = editText.value.trim()
  return t.length > 0 && t !== s.text
})

/* —— 删除确认（中置对话框） —— */
const showDeleteDialog = ref(false)
function requestDelete() { showDeleteDialog.value = true }
async function doDelete() {
  const s = item.value; if (!s) return
  summary.remove(s.id)
  showDeleteDialog.value = false
  await router.replace({ name: 'records.sticker-wall' }).catch(() => {})
}
</script>

<template>
  <div class="m-page">
    <PageHeader :title="title">
      <!-- 右上角：与“自由记录/模板记录”对齐的胶囊分段按钮 -->
      <template #extra>
        <div v-if="item" class="seg seg--hdr">
          <template v-if="!editing">
            <button class="seg-btn seg-btn--solid" @click="startEdit">编辑</button>
            <button class="seg-btn seg-btn--outline seg-btn--danger" @click="requestDelete">删除</button>
          </template>
          <template v-else>
            <button class="seg-btn seg-btn--solid" :disabled="!canSave" @click="saveEdit">保存</button>
            <button class="seg-btn seg-btn--outline" @click="cancelEdit">取消</button>
          </template>
        </div>
      </template>
    </PageHeader>

    <div v-if="item" class="card">
      <template v-if="!editing">
        <pre class="content">{{ item.text }}</pre>
        <div class="meta">
          <span class="badge" :class="item.status === 'final' ? 'ok' : 'warn'">
            {{ item.status === 'final' ? '已确认' : '草稿' }}
          </span>
        </div>
      </template>

      <template v-else>
        <textarea
          ref="editorRef"
          class="editor"
          v-model="editText"
          rows="14"
          placeholder="在此修改日记内容…"
        />
      </template>
    </div>

    <div v-else class="empty">未找到这条日记</div>

    <!-- 中置对话框：删除确认（轻量样式） -->
    <Teleport to="body">
      <div
        v-if="showDeleteDialog"
        class="dlg-mask"
        aria-hidden="true"
        @click="showDeleteDialog=false"
        @touchmove.prevent
      />
      <div
        v-if="showDeleteDialog"
        class="dlg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dlg-title"
        @click.stop
      >
        <div class="dlg-body">
          <div class="dlg-title" id="dlg-title">删除这条日记？</div>
          <p class="dlg-desc">删除后不可恢复。</p>
        </div>
        <div class="dlg-actions">
          <button class="seg-btn seg-btn--outline seg-btn--danger" @click="doDelete">确认删除</button>
          <button class="seg-btn seg-btn--solid" @click="showDeleteDialog=false">取消</button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.m-page{max-width:640px;margin:0 auto;padding:12px}

/* —— 胶囊分段按钮：与编辑页一致的风格 —— */
.seg{display:flex;gap:8px;align-items:center}
.seg-btn{
  border:1px solid #eaecef; background:#fff; color:#606266;
  border-radius:999px; padding:8px 12px;
  font-weight:800; font-size:13px; letter-spacing:.1px; cursor:pointer;
  transition: background-color .15s ease, border-color .15s ease, color .15s ease, opacity .15s ease;
}
.seg-btn--solid{ background:#f0f3ff; border-color:#dfe6ff; color:#111 }
.seg-btn--outline{ background:#fff; border-color:#eaecef; color:#606266 }
.seg-btn--danger{ color:#c0392b; border-color:#ffd8d6 }
.seg-btn:disabled{ opacity:.5; cursor:not-allowed }
.seg-btn:not(:disabled):hover{ filter:brightness(0.98) }

/* 卡片与内容 */
.card{border:1px solid #eaecef;border-radius:12px;padding:12px;background:#fff}
.content{
  white-space:pre-wrap;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
  line-height:1.6;font-size:14px
}
.meta{margin-top:10px}
.badge{display:inline-block;padding:2px 8px;border-radius:999px;font-size:12px;border:1px solid #eaecef}
.badge.ok{background:#edf9f0;border-color:#cfe9d7;color:#2e7d32}
.badge.warn{background:#fff7eb;border-color:#ffe0b2;color:#c77800}
.empty{ text-align:center; color:#606266; padding:40px 0 }

.editor{
  width:100%;box-sizing:border-box;border:1px solid #eaecef;border-radius:12px;padding:12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
  line-height:1.6;font-size:15px;min-height:260px
}

/* 中置对话框（轻量） */
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
