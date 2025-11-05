<!-- src/features/home/pages/BreakdownPage.vue -->
<template>
  <div class="m-page safe-bottom">
    <!-- 头部 -->
    <header class="m-hd">
      <BackButton aria-label="Go back" />
      <h1 class="m-title">Task Breakdown</h1>
      <p class="m-sub">Jot down what you need to do and tap Save when you're ready.</p>
    </header>

    <!-- 单输入 + 保存 -->
    <section class="section">
      <h2 class="sec-title primary">
        <span class="bar" aria-hidden="true"></span> Quick Capture
      </h2>

      <el-card class="m-card" shadow="hover">
        <el-input
          v-model="text"
          type="textarea"
          :rows="8"
          placeholder="Example: organize thesis materials—start by sorting references by year…"
          aria-label="Task details"
        />
        <div class="m-actions">
          <el-button type="primary" @click="save">Save</el-button>
        </div>
        <p v-if="savedAt" class="hint">Saved: {{ formatTime(savedAt) }}</p>
      </el-card>
    </section>

    <div class="safe-pad"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import BackButton from '@/shared/components/BackButton.vue'

defineOptions({ name: 'BreakdownPage' })

const STORAGE_KEY = 'nc:breakdown:note'

const text = ref('')
const savedAt = ref<number | null>(null)

onMounted(() => {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return
  try {
    const data = JSON.parse(raw)
    text.value = data.text ?? ''
    savedAt.value = data.ts ?? null
  } catch {
    // ignore
  }
})

function save() {
  const payload = { text: text.value, ts: Date.now() }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  savedAt.value = payload.ts
  ElMessage.success('Saved')
}

function formatTime(ts: number) {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
</script>

<style scoped>
.section { margin-top: 20px; }
.m-card { margin-top: 8px; }
.m-actions { display: flex; gap: 8px; margin-top: 12px; }
.hint { margin-top: 8px; font-size: 12px; color: var(--el-text-color-secondary, #666); }
.safe-pad { height: 24px; }

/* 继承你的标题风格 */
.sec-title { display: flex; align-items: center; gap: 8px; font-size: 14px; }
.sec-title.primary .bar {
  width: 8px; height: 20px; border-radius: 6px;
  background: linear-gradient(180deg, #7c3aed, #22d3ee);
}
</style>
