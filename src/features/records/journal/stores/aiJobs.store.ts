// src/features/records/journal/stores/aiJobs.store.ts
import { defineStore } from 'pinia'
import { LS } from '@/shared/constants/ls-keys'
import { getJSON, setJSON } from '@/shared/utils/storage'
import { toDayKeyLocal } from '../utils/dayKeyLocal'
import { useNCJournalSummaryStore } from './journalSummary.store'
import type { AIJob } from '../types/journal'

type State = {
  jobs: AIJob[]
  maxKeep: number
}

const KEY = LS.journalAIJobs ?? 'nc:journal:aiJobs'

function genJobId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export const useNCJournalAIJobsStore = defineStore('nc-journal-ai-jobs', {
  state: (): State => ({
    jobs: getJSON(KEY, [] as AIJob[]),
    maxKeep: 200,
  }),

  getters: {
    /** 某日最新的一条任务（通常用于 UI 展示状态） */
    latestForDay:
      (s) =>
      (dayKeyLocal: string): AIJob | undefined =>
        s.jobs.find((j) => j.dayKeyLocal === dayKeyLocal),

    /** 正在运行/排队的任务 */
    runningFor:
      (s) =>
      (dayKeyLocal: string): AIJob | undefined =>
        s.jobs.find(
          (j) =>
            j.dayKeyLocal === dayKeyLocal &&
            (j.status === 'queued' || j.status === 'running')
        ),
  },

  actions: {
    load() {
      this.jobs = getJSON(KEY, [] as AIJob[])
    },

    /** 基于“日 + 模板”创建任务，并做幂等保护（同日同模板仅保留一个在途任务） */
    createJobFromDay(payload: {
      day?: Date
      dayKeyLocal?: string
      templateId: string
      noteIds?: number[] // 可指定参与的散记清单；不传则由 service 自行聚合
    }): AIJob {
      const now = new Date()
      const dayKeyLocal =
        payload.dayKeyLocal ?? toDayKeyLocal(payload.day ?? now)

      // 幂等：同日同模板在“在途状态”就直接返回那条
      const inflight =
        this.jobs.find(
          (j) =>
            j.dayKeyLocal === dayKeyLocal &&
            j.templateId === payload.templateId &&
            (j.status === 'queued' || j.status === 'running')
        ) ?? null
      if (inflight) return inflight

      const job: AIJob = {
        jobId: genJobId(),
        dayKeyLocal,
        templateId: payload.templateId,
        status: 'queued',
        noteIds: payload.noteIds ?? [],
        createdAtISO: now.toISOString(),
        updatedAtISO: now.toISOString(),
      }
      this.jobs.unshift(job)
      if (this.jobs.length > this.maxKeep) this.jobs.length = this.maxKeep
      setJSON(KEY, this.jobs)
      return job
    },

    markRunning(jobId: string) {
      const job = this.jobs.find((j) => j.jobId === jobId)
      if (!job) return
      job.status = 'running'
      job.updatedAtISO = new Date().toISOString()
      setJSON(KEY, this.jobs)
    },

    /** 成功后：写入 Summary 草稿，并把 summaryId 记录到 job */
    succeed(jobId: string, draft: {
      text: string
      usedNoteIds?: number[]
      templateId?: string
      templateVersion?: number
      modelMeta?: Record<string, unknown>
    }) {
      const job = this.jobs.find((j) => j.jobId === jobId)
      if (!job) return
      const summaryStore = useNCJournalSummaryStore()

      const summaryId = summaryStore.upsertDraft({
        dayKeyLocal: job.dayKeyLocal,
        text: draft.text,
        usedNoteIds: draft.usedNoteIds ?? job.noteIds ?? [],
        templateId: draft.templateId ?? job.templateId,
        templateVersion: draft.templateVersion,
        modelMeta: draft.modelMeta,
      })

      job.status = 'succeeded'
      job.summaryId = summaryId
      job.updatedAtISO = new Date().toISOString()
      setJSON(KEY, this.jobs)
    },

    fail(jobId: string, errorMessage?: string) {
      const job = this.jobs.find((j) => j.jobId === jobId)
      if (!job) return
      job.status = 'failed'
      job.errorMessage = errorMessage
      job.updatedAtISO = new Date().toISOString()
      setJSON(KEY, this.jobs)
    },

    cancel(jobId: string) {
      const job = this.jobs.find((j) => j.jobId === jobId)
      if (!job) return
      job.status = 'canceled'
      job.updatedAtISO = new Date().toISOString()
      setJSON(KEY, this.jobs)
    },

    remove(jobId: string) {
      this.jobs = this.jobs.filter((j) => j.jobId !== jobId)
      setJSON(KEY, this.jobs)
    },

    clear() {
      this.jobs = []
      setJSON(KEY, this.jobs)
    },
  },
})
