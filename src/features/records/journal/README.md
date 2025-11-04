<!-- src/features/records/journal/README.md -->

# Journal 模块（records/journal）

> 目标：**编辑/详情 + 数据层**。列表首页统一由 `sticker-wall/StickerWallPage.vue` 承担（爪印墙 + 奇迹日记链接）。

## 目录结构

pages/
JournalEditPage.vue # 新增/编辑（自由/模板；本地草稿；提交后回列表）
JournalDetailPage.vue # 详情（展示 Summary Markdown；返回回列表）

stores/
index.ts # 统一出口（兼容旧名 useNCJournalStore=Summary）
journalSummary.store.ts # Summary CRUD：{ id, text(MD), dayKeyLocal, usedNoteIds, status, ... }
journalNotes.store.ts # Notes CRUD：{ id, text, createdAtISO, dayKeyLocal, tags? }
aiJobs.store.ts # AI 编排/任务状态：queued→running→succeeded|failed（成功后写 Summary:draft）

services/
ai/journalSummarize.client.ts # AI 汇总唯一入口（可走后端/本地 synth）

constants/
registry.ts # 模板注册中心（getTemplateSpec / listTemplates）
daily-default.ts # 默认「奇蹟日終記錄」模板定义（繁体）

types/
journal.ts # Note / Summary / AIJob / DayKeyLocal 等类型

utils/
dayKeyLocal.ts # 本地日 DayKey 生成/校验（SSOT；写入时固化）

migrations/
0001-add-dayKeyLocal.ts # 迁移：旧 nc:journal → Summary(final)，并补写 dayKeyLocal/status

routes.ts # 仅注册 edit/detail 两条路由（列表首页在 sticker-wall 模块）

## 单一事实源（SSOT）

- **分组口径**：按**本地日**分组。写入 Note / Summary 时即固化 `dayKeyLocal = "YYYY-MM-DD"`（见 `utils/dayKeyLocal.ts`）。  
- **列表首页**：`sticker-wall/pages/StickerWallPage.vue` 负责“爪印墙 + 奇迹日记链接”，按 **本地日**聚合显示。  
- **返回策略**：编辑/详情页返回**固定回**列表页，而非 `history.back()`。在 `routes.ts` 中通过 `meta.backTo = { name: 'records.stickerWall' }` 明确。

## 路由

- `GET /records/journal/new` → `records.journal.edit`（新增/编辑）  
- `GET /records/journal/:id` → `records.journal.detail`（详情）  
- 列表页：在 sticker-wall 模块，通常命名为 `records.stickerWall`（作为 `meta.backTo` 的目标）。

## Store 使用方式

```ts
import {
  useNCJournalStore,            // 兼容旧名 = Summary store
  useNCJournalSummaryStore,     // 显式 Summary
  useNCJournalNotesStore,       // 散记
  useNCJournalAIJobsStore,      // AI 任务
} from '@/features/records/journal/stores'
数据模型概览

Note（散记）：{ id, text, createdAtISO, dayKeyLocal, tags? }

Summary（总结）：{ id, status:'draft|final', dayKeyLocal, text(MD), usedNoteIds[], templateId?, templateVersion?, modelMeta?, createdAtISO, updatedAtISO }

AIJob：{ jobId, dayKeyLocal, templateId, noteIds?, status, summaryId?, errorMessage?, createdAtISO, updatedAtISO }

AI 汇总流程（notes → jobs → service → summary）

用户当天多次写 Notes（散记） → journalNotes.add()（写入即固化 dayKeyLocal）。

点击“生成当日总结” → aiJobs.createJobFromDay({ dayKeyLocal, templateId })。

journalSummarize.client.summarizeDay() 收集 notes + 模板 →

provider='http'：POST 至后端；

provider='local'：本地生成占位 Markdown。

成功 → aiJobs.succeed(jobId, draft)：将返回写入 Summary(status='draft')，并把 summaryId 记录到 job。

在 JournalDetailPage 审阅 → “确认完成” → journalSummary.markFinal(id)。

metrics/奖励等横切逻辑不在 store 内处理，如需可在更上层订阅领域事件实现。

模板与文案

模板注册于 constants/registry.ts，默认模板见 constants/daily-default.ts（与你提供的“奇蹟日終記錄”一致）。

journalSummarize.client.ts 会读取 templateId（如 daily-default-zh）构造 prompt 或生成本地草稿。

迁移

在应用启动阶段调用一次 runJournalMigration0001()：

将旧的 { id, text, dateISO }（如存在）迁移为 Summary(final)；

为现有 Summary 补齐 dayKeyLocal 与 status。

迁移是幂等的，可重复运行；完成会打标 nc:journal:migration:0001:done。

无障碍与细节

草稿保存：编辑页的模板模式采用 ~500ms 防抖写入草稿键，3 秒内刷新仍能保留。

时区：采用 dayKeyLocal 固化后，分组/检索稳定；若以后需要“随当前时区动态变更”，需另立开关。

本地容量：Notes 默认 maxKeep=2000；如有需要可按年清理或做导出。

命名规范

模块路径使用复数：stores/、constants/ 与全局一致。

路由名前缀：records.journal.*；列表页名由 sticker-wall 模块提供（建议 records.stickerWall）。