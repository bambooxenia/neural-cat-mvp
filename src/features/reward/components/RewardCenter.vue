<!-- src/features/reward/components/RewardCenter.vue -->
<template>
  <!-- 🎊 纸屑庆祝层：由 store 统一控制数量与开关 -->
  <ConfettiLayer :show="reward.confettiOn" :pieces="reward.confetti" />

  <el-dialog
    v-model="reward.visible"
    :width="'min(420px, 92vw)'"
    align-center
    :close-on-click-modal="false"
    :show-close="false"
    :destroy-on-close="true"
  >
    <!-- 仅在有当前奖励时渲染头部 -->
    <template #header v-if="reward.current">
      <div class="dlg-title">🎉 Great job!</div>
    </template>

    <!-- 仅在有当前奖励时渲染主体 -->
    <div class="reward-wrap" v-if="reward.current">
      <!-- 贴纸奖励（展示内容全部来自 store 的统一随机） -->
      <div v-if="isSticker" class="reward-sticker">
        <div class="kaomoji-cat">{{ reward.kaomoji }}</div>
        <p class="reward-text">{{ reward.caption }}</p>
      </div>

      <!-- 兜底块：如暂未使用，可直接移除；若保留，务必加严格可见性条件 -->
      <!-- <div v-else-if="!isSticker">
      <p class="reward-text">获得奖励 🎁</p>
    </div> -->
    </div>

    <!-- 仅在有当前奖励时渲染底部按钮 -->
    <template #footer v-if="reward.current">
      <div class="dlg-footer">
        <el-button @click="onDismiss">Maybe later</el-button>
        <el-button type="primary" @click="onAccept">Claim reward</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import ConfettiLayer from './ConfettiLayer.vue'

import { useRewardStore } from '@/features/reward'
import { useRewardTokensStore } from '@/features/reward/stores/rewardTokens.store'
import { useNCStickerStore } from '@/features/records/sticker-wall/store'
import { logRewardAccepted, subscribe, type JournalCreatedPayload } from '@/app/analytics'

defineOptions({ inheritAttrs: false })

const reward = useRewardStore()
const wallet = useRewardTokensStore()
const sticker = useNCStickerStore()

/* ------------------------------ 渲染态 ------------------------------ */
const isSticker = computed(() => reward.current?.type === 'sticker')

/* ------------------------------ 领取 / 放弃 ------------------------------ */
const onAccept = () => {
  const r = reward.accept()
  if (!r) return
  logRewardAccepted({ type: r.type, amount: 1 })
  if (r.type === 'sticker') {
    const km = reward.kaomoji || ''
    wallet.earn(1)
    if (km) sticker.add(km)
  }
}
const onDismiss = () => reward.dismiss()

/* ------------------------------ 全局单例订阅锁 ------------------------------ */
/**
 * 目的：保证 reward.* 主题只被订阅一次，避免多实例/HMR 导致的重复 enqueue。
 * - 第一个挂载的 RewardCenter 获得“所有权”，注册订阅；
 * - 之后的实例发现已被占用，就不再订阅；
 * - 卸载或 HMR 时，只有持有者会注销订阅并释放所有权。
 */
const OWNER_KEY = '__nc_reward_center_owner__'
type GlobalBus = { owner: string | null; unsubs: Array<() => void> }
const g = globalThis as any
if (!g[OWNER_KEY]) g[OWNER_KEY] = { owner: null, unsubs: [] } as GlobalBus
const bus: GlobalBus = g[OWNER_KEY]
const ownerId = Math.random().toString(36).slice(2, 10)

/* 轻量去重（同实例防抖，防止短时间内重复事件） */
let lastSig = ''
let lastAt = 0
function isDup(sig: string, win = 2000) {
  const now = Date.now()
  if (sig === lastSig && now - lastAt < win) return true
  lastSig = sig
  lastAt = now
  return false
}

/* 实际的订阅处理器 */
function handleJournal(p: JournalCreatedPayload) {
  const sig = `journal:${p?.dayKeyLocal ?? ''}:${p?.length ?? 0}`
  if (isDup(sig)) return
  reward.enqueueSticker()
}
function handleBait() {
  const sig = 'bait:completed'
  if (isDup(sig)) return
  reward.enqueueSticker()
}
function handleTask() {
  const sig = 'task:completed'
  if (isDup(sig)) return
  reward.enqueueSticker()
}

onMounted(() => {
  // 如果没有人持有所有权，则当前实例接管并注册订阅
  if (!bus.owner) {
    bus.owner = ownerId
    const u1 = subscribe('reward.journal.created', handleJournal)
    const u2 = subscribe('reward.bait.completed', handleBait)
    const u3 = subscribe('reward.task.completed', handleTask)
    bus.unsubs = [u1, u2, u3]

    // 开发期调试：观察是否只订阅了一次
    if (import.meta.env?.DEV) {
      // eslint-disable-next-line no-console
      console.log('[RewardCenter] subscriptions installed by', ownerId)
    }
  } else if (import.meta.env?.DEV) {
    // eslint-disable-next-line no-console
    console.warn(
      '[RewardCenter] another instance detected; subscriptions already owned by',
      bus.owner
    )
  }

})

onUnmounted(() => {
  // 只有持有者才有权释放订阅
  if (bus.owner === ownerId) {
    for (const un of bus.unsubs) {
      try {
        un()
      } catch {}
    }
    bus.unsubs = []
    bus.owner = null
  }

})

// HMR：当前 SFC 被热替换时，若本实例是持有者，主动释放订阅，避免残留监听
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    if (bus.owner === ownerId) {
      for (const un of bus.unsubs) {
        try {
          un()
        } catch {}
      }
      bus.unsubs = []
      bus.owner = null
    }
  })
}
</script>

<style scoped>
.dlg-title {
  font-weight: 600;
}
.reward-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}
.kaomoji-cat {
  font-size: 44px;
  line-height: 1.2;
  text-align: center;
  animation: bounce 1s infinite alternate;
}
.reward-text {
  margin: 6px 0 2px;
  color: var(--el-text-color-regular);
}
@keyframes bounce {
  from {
    transform: translateY(0);
  }
  to {
    transform: translateY(-6px);
  }
}
.dlg-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-bottom: env(safe-area-inset-bottom);
}
</style>
