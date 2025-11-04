// src/features/records/metrics/store.ts
import { defineStore } from 'pinia'

export const useNCMetricStore = defineStore('nc-metric', {
  state: () => ({
    count: 0,
  }),
  actions: {
    save(delta = 1) {
      this.count += delta
      // 这里以后可以接本地存储 / 上报服务
    },
    reset() {
      this.count = 0
    },
  },
})
