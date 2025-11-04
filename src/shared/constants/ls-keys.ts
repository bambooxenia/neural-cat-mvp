// src/shared/constants/ls-keys.ts
// localStorage Key 统一管理（前缀：nc_）
export const LS = {
  // — 计数 & 今日状态 —
  appearance: 'nc_appearance_count',
  todayDone: 'nc_today_done',
  todayDate: 'nc_today_date',

  // — 日记 —
  journal: 'nc_journal_list',
  journalMode: 'nc_journal_mode',
  journalDraftTemplate: 'nc_journal_draft_tpl',
  journalSummary: 'nc:journal:summary',
  journalNotes: 'nc:journal:notes',
  journalAIJobs: 'nc:journal:aiJobs',

  // — 贴纸 —
  stickers: 'nc_stickers',

  // — 任务类型 & 用户任务 —
  taskTypes: 'nc_task_types',
  taskTypeSelected: 'nc_task_type_selected',
  userTasks: 'nc_user_tasks',

  // — 计时器 —
  taskTimer: 'NC_TASK_TIMER_V1',
  baitTimer: 'NC_BAIT_TIMER_V1',

  // — 情绪诱饵（精简 6 种） —
  mood: 'nc_current_mood',
  moodAt: 'nc_mood_chosen_at',
  moodList: 'nc_mood_list',
  moodMeta: 'nc_mood_meta',
  userBaits: 'nc_user_baits',

  // — 任务拆分（简化版草稿） —
  breakdownNote: 'nc_breakdown_note',

  // — 情绪目录扩展（alias/removed 等，供 catalog 持久化） —
  moodCatalogV1: 'nc_mood_catalog_v1',

  // — 全局埋点/统计事件 —
  analyticsV1: 'nc_analytics_v1',
} as const

export type LSKey = typeof LS[keyof typeof LS]

// 兼容已在其他模块直接按常量名引用的场景（例如 shared/services/mood.service.ts）
export const NC_MOOD_CATALOG_V1 = LS.moodCatalogV1
export const NC_ANALYTICS_V1 = LS.analyticsV1

