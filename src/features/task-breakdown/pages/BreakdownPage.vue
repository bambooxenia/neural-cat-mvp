<!-- src/features/home/pages/BreakdownPage.vue -->
<template>
  <div class="m-page safe-bottom">
    <!-- 头部 -->
    <header class="m-hd">
      <BackButton aria-label="返回上一级" />
      <h1 class="m-title">任务拆分</h1>
      <p class="m-sub">随手写下你要做的事，点保存即可</p>
    </header>

    <!-- 单输入 + 保存 -->
    <section class="section">
      <h2 class="sec-title primary">
        <span class="bar" aria-hidden="true"></span> 快速记录
      </h2>

      <el-card class="m-card" shadow="hover">
        <el-input
          v-model="text"
          type="textarea"
          :rows="8"
          placeholder="例如：整理论文资料，先把参考文献按年份分类……"
          aria-label="任务内容"
        />
        <div class="m-actions">
          <el-button type="primary" @click="save">保存</el-button>
        </div>
        <p v-if="savedAt" class="hint">已保存：{{ formatTime(savedAt) }}</p>
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
  ElMessage.success('已保存')
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
