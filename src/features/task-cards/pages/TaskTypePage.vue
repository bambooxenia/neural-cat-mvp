<!-- src/features/task-cards/pages/TaskTypePage.vue -->
<script setup lang="ts">
defineOptions({ name: 'TaskTypePage' })

import { ref, onMounted, watch, nextTick, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, EditPen, Delete as DeleteIcon, List } from '@element-plus/icons-vue'

import PageHeader from '@/shared/components/PageHeader.vue'

/** Stores */
import { useTaskCatalogStore } from '@/features/task-cards/stores/taskCatalog.store'
import { useTaskSessionStore } from '@/features/task-cards/stores/taskSession.store'

/** 常量与类型 */
import { TYPE_TO_DOMAINS } from '@/features/task-cards/constants/task-types'
import type { Domain } from '@/entities/task'

const router = useRouter()
const route = useRoute()
const catalog = useTaskCatalogStore()
const session = useTaskSessionStore()

/** 与 selectedTaskType 同步的本地选中值（对齐 MoodPage） */
const selected = ref<string>('')

/* -------------------------------- 首屏编排 -------------------------------- */
onMounted(async () => {
  await catalog.load()
  // 初始选中：优先使用已持久化的 selectedTaskType
  selected.value = catalog.selectedTaskType || catalog.taskTypes[0] || ''
  navigator?.vibrate?.(6)
})

/** 类型列表变化时，保证 selected 合法（对齐 MoodPage 的 watch） */
watch(
  () => catalog.taskTypes,
  (list) => {
    if (!Array.isArray(list) || list.length === 0) {
      selected.value = ''
      return
    }
    if (!selected.value || !list.includes(selected.value)) {
      selected.value = catalog.selectedTaskType || list[0]
    }
  }
)

/* ----------------------------- 选择 / 下一步 ----------------------------- */
const onSelectType = (t: string) => {
  selected.value = t
  navigator?.vibrate?.(8)
}

const breathing = ref(false)
const triggerBreath = () => {
  breathing.value = true
  window.setTimeout(() => (breathing.value = false), 420)
}

const goNext = async () => {
  if (!selected.value) return
  triggerBreath()
  await catalog.setTaskType(selected.value)
  session.reset()
  const r = route.query.redirect
  if (typeof r === 'string' && r.startsWith('/')) {
    await router.push(r as string)
  } else {
    await router.push({ name: 'home.tasks.card' })
  }
}

/* ------------------------------- 新增类型 ------------------------------- */
const addVisible = ref(false)
const addName = ref('')

const openAdd = () => {
  addName.value = ''
  addVisible.value = true
}
const confirmAdd = async () => {
  const name = addName.value.trim()
  if (!name) return ElMessage.warning('请输入类型名称')
  const res = await catalog.addTaskType(name)
  if (!res.ok) {
    const map: Record<string, string> = {
      empty: '名称不能为空',
      too_long: '名称过长（最多 16 字）',
      duplicated: '该类型已存在',
    }
    return ElMessage.warning(map[res.reason ?? ''] || '添加失败')
  }
  selected.value = name
  addVisible.value = false
  ElMessage.success('已添加类型')
}

/* ------------------------------- 编辑类型 ------------------------------- */
const editVisible = ref(false)
const editingName = ref('')
const editNewName = ref('')

const openEdit = (name: string) => {
  editingName.value = name
  editNewName.value = name
  editVisible.value = true
}
const confirmEdit = async () => {
  const oldName = (editingName.value || '').trim()
  const newName = (editNewName.value || '').trim()
  if (!newName) return ElMessage.warning('名称不能为空')
  const res = await catalog.renameTaskType(oldName, newName)
  if (!res.ok) {
    const map: Record<string, string> = {
      too_long: '名称过长（最多 16 字）',
      duplicated: '该名称已存在',
      invalid: '无效的名称',
    }
    return ElMessage.warning(map[res.reason ?? ''] || '保存失败')
  }
  if (selected.value === oldName) selected.value = newName
  editVisible.value = false
  ElMessage.success('已保存')
}

/* ------------------------------- 删除类型 ------------------------------- */
const delVisible = ref(false)
const delName = ref('')

const openDelete = async (name: string) => {
  if (catalog.taskTypes.length <= 1) return ElMessage.info('至少保留一个类型哦')
  delName.value = name
  delVisible.value = true
}
const confirmDelete = async () => {
  const name = delName.value
  if (!name) return (delVisible.value = false)
  if (catalog.taskTypes.length <= 1) {
    delVisible.value = false
    return ElMessage.info('至少保留一个类型哦')
  }
  await catalog.removeTaskType(name)
  if (selected.value === name) selected.value = catalog.taskTypes[0] || ''
  delVisible.value = false
  navigator?.vibrate?.(10)
  ElMessage.success('已删除')
}

/* ------------------------------- 新增任务 ------------------------------- */
const taskAddVisible = ref(false)
const taskTitle = ref('')
const taskMinutes = ref<5 | 10>(5)
const taskTypeSel = ref<string>('')
const taskDomainSel = ref<Domain | ''>('')

// 是否为“有映射”的类型（有映射才显示领域下拉）
const hasMapping = computed(() => {
  const arr = TYPE_TO_DOMAINS[taskTypeSel.value] as Domain[] | undefined
  return Array.isArray(arr) && arr.length > 0
})
const domainsForType = computed<Domain[]>(() => {
  const arr = TYPE_TO_DOMAINS[taskTypeSel.value] as Domain[] | undefined
  return hasMapping.value ? (arr as Domain[]) : []
})

watch(taskTypeSel, () => {
  const list = domainsForType.value
  taskDomainSel.value = (list[0] ?? '') as Domain | ''
})

const openAddTask = () => {
  if (!selected.value) return ElMessage.info('请先选择一个类型')
  taskTitle.value = ''
  taskMinutes.value = 5
  taskTypeSel.value = selected.value
  nextTick(() => {
    const list = domainsForType.value
    taskDomainSel.value = (list[0] ?? '') as Domain | ''
  })
  taskAddVisible.value = true
}

const confirmAddTask = async () => {
  const title = taskTitle.value.trim()
  if (!title) return ElMessage.warning('请填写任务标题')
  if (!taskTypeSel.value) return ElMessage.warning('请选择类型')

  // 对有映射的类型，要求必须选择领域；无映射则不校验 domain（store 已放行）
  if (hasMapping.value && !taskDomainSel.value) return ElMessage.warning('请选择任务领域')

  const res = await catalog.addUserTask({
    title,
    minutes: taskMinutes.value,
    domain: (taskDomainSel.value || 'write') as Domain, // 占位，store 在无映射时不会拦截
    typeTag: taskTypeSel.value,
  } as any)
  if (!res.ok) {
    const map: Record<string, string> = {
      empty_title: '标题不能为空',
      title_too_long: '标题过长（最多 60 字）',
      invalid_minutes: '时长不合法（仅支持 5 / 10 分钟）',
      unknown_type: '未知的类型，请重试',
      invalid_domain_for_type: '该领域不属于此类型',
    }
    return ElMessage.error(map[res.reason ?? ''] || '添加失败')
  }

  taskAddVisible.value = false
  navigator?.vibrate?.(10)
  ElMessage.success('已添加任务')
}

/* -------------------------- 任务管理（编辑/删除） -------------------------- */
const manageVisible = ref(false)
const openManageTasks = () => { manageVisible.value = true }

// 管理列表：对齐 Mood 的 baitsOfSelected（此处合并“内置+自建”，无映射时只有自建）
const tasksOfSelected = computed(() => {
  return selected.value ? catalog.getManageListByType(selected.value) : []
})

/** 编辑任务弹窗 */
const taskEditVisible = ref(false)
const taskEditId = ref<number | null>(null)
const taskEditSource = ref<'base' | 'user' | null>(null)
const taskEditTitle = ref('')
const taskEditMinutes = ref<5 | 10>(5)
const taskEditType = ref<string>('')        // 仅 user 可改
const taskEditDomain = ref<Domain | ''>('')

const openEditTask = (row: any) => {
  taskEditId.value = row.id
  taskEditSource.value = row.source
  taskEditTitle.value = row.title
  taskEditMinutes.value = row.minutes
  taskEditType.value = row.source === 'user' ? (row.typeTag || selected.value) : selected.value
  nextTick(() => {
    const list = TYPE_TO_DOMAINS[taskEditType.value] as Domain[] | undefined
    taskEditDomain.value = (list && list.includes(row.domain)) ? row.domain : (list?.[0] ?? '')
  })
  taskEditVisible.value = true
}

const confirmEditTask = async () => {
  if (!taskEditId.value) return
  const title = taskEditTitle.value.trim()
  if (!title) return ElMessage.warning('标题不能为空')

  if (taskEditSource.value === 'base') {
    // 编辑内置：覆盖（仅当该类型有映射时才限制 domain；store 会二次校验）
    const ok = await catalog.updateBaseTaskForType(
      selected.value,
      taskEditId.value,
      {
        title,
        minutes: taskEditMinutes.value,
        ...(TYPE_TO_DOMAINS[selected.value] ? { domain: taskEditDomain.value as Domain } : {})
      }
    )
    if (!ok.ok) return ElMessage.error('保存失败')
  } else {
    // 编辑自建
    const res = await catalog.updateUserTask(taskEditId.value, {
      title,
      minutes: taskEditMinutes.value,
      typeTag: taskEditType.value,
      ...(TYPE_TO_DOMAINS[taskEditType.value] ? { domain: taskEditDomain.value as Domain } : {})
    })
    if (!res.ok) return ElMessage.error('保存失败')
  }

  taskEditVisible.value = false
  ElMessage.success('已保存')
}

const removeTask = async (row: any) => {
  if (row.source === 'base') {
    await catalog.hideBaseTaskForType(selected.value, row.id)
  } else {
    await catalog.removeUserTask(row.id)
  }
  ElMessage.success('已删除')
}
</script>

<template>
  <div class="m-page">
    <PageHeader title="先选一个任务类型">
      <template #extra>
        <el-button text type="primary" @click="openAdd">
          <el-icon style="margin-right:4px"><Plus /></el-icon> 添加任务类型
        </el-button>
        <el-button text type="primary" :disabled="!selected" @click="openAddTask">
          <el-icon style="margin-right:4px"><EditPen /></el-icon> 添加任务
        </el-button>
        <el-button text type="primary" :disabled="!selected" @click="openManageTasks">
          <el-icon style="margin-right:4px"><List /></el-icon> 管理任务
        </el-button>
      </template>
    </PageHeader>

    <div class="badges" style="margin:4px 2px 8px">
      <span class="tag tag--ok">可点选/编辑</span>
      <span class="tag tag--warn">右滑或删除按钮可删除</span>
    </div>

    <!-- 类型宫格（对齐 Mood 的可编辑卡片思路） -->
    <div class="m-grid">
      <el-card
        v-for="t in catalog.taskTypes"
        :key="t"
        class="m-tile"
        :class="{ active: selected === t }"
        shadow="hover"
        @click="onSelectType(t)"
        @contextmenu.prevent
      >
        <div class="tile-title">{{ t }}</div>
        <div class="tile-desc">5–10 分钟小行动</div>

        <div class="tile-actions">
          <el-button text type="primary" size="small" @click.stop="openEdit(t)">
            <el-icon style="margin-right:4px"><EditPen /></el-icon> 编辑
          </el-button>
          <el-button text type="danger" size="small" @click.stop="openDelete(t)">
            <el-icon style="margin-right:4px"><DeleteIcon /></el-icon> 删除
          </el-button>
        </div>
      </el-card>
    </div>

    <el-empty
      v-if="!catalog.taskTypes.length"
      description="还没有任何类型，点右上角「添加任务类型」吧"
      style="margin-top:12px"
    />

    <!-- 悬浮主 CTA（对齐 Mood 的按钮） -->
    <div class="floating-cta">
      <button
        class="cta-btn"
        :disabled="!selected"
        :class="{ 'is-breathing': breathing }"
        @click="goNext"
      >
        按「{{ selected || '选择类型' }}」开始
      </button>
    </div>

    <!-- =============== 新增类型 =============== -->
    <el-dialog v-model="addVisible" :width="'min(520px,92vw)'" align-center>
      <template #header><strong>添加任务类型</strong></template>
      <el-form label-width="108px">
        <el-form-item label="类型名称">
          <el-input
            v-model="addName"
            maxlength="16"
            show-word-limit
            placeholder="例如：写小说 / 学习外语 ..."
            @keyup.enter="confirmAdd"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addVisible=false">取消</el-button>
        <el-button type="primary" @click="confirmAdd">添加</el-button>
      </template>
    </el-dialog>

    <!-- =============== 编辑类型 =============== -->
    <el-dialog v-model="editVisible" :width="'min(560px,92vw)'" align-center>
      <template #header><strong>编辑任务类型</strong></template>
      <el-form label-width="108px">
        <el-form-item label="类型名称">
          <el-input v-model="editNewName" maxlength="16" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible=false">取消</el-button>
        <el-button type="primary" @click="confirmEdit">保存</el-button>
      </template>
    </el-dialog>

    <!-- =============== 删除类型确认 =============== -->
    <el-dialog v-model="delVisible" :width="'min(520px,92vw)'" align-center>
      <template #header><strong>删除类型</strong></template>
      <div style="margin:4px 0 12px">
        确定要删除「<strong>{{ delName }}</strong>」吗？该类型下自建任务将被移除。
      </div>
      <template #footer>
        <el-button @click="delVisible=false">取消</el-button>
        <el-button type="danger" @click="confirmDelete">
          <el-icon style="margin-right:6px"><DeleteIcon /></el-icon> 删除
        </el-button>
      </template>
    </el-dialog>

    <!-- =============== 新增任务 =============== -->
    <el-dialog v-model="taskAddVisible" :width="'min(520px,92vw)'" align-center>
      <template #header><strong>添加任务</strong></template>
      <el-form label-width="88px">
        <el-form-item label="标题">
          <el-input
            v-model="taskTitle"
            maxlength="60"
            show-word-limit
            placeholder="如：写 400 字 / 快速列大纲"
            @keyup.enter="confirmAddTask"
          />
        </el-form-item>
        <el-form-item label="时长">
          <el-radio-group v-model="taskMinutes">
            <el-radio-button :label="5">5 分钟</el-radio-button>
            <el-radio-button :label="10">10 分钟</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="taskTypeSel" style="width: 280px" placeholder="选择类型">
            <el-option v-for="t in catalog.taskTypes" :key="t" :label="t" :value="t" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="hasMapping" label="领域">
          <el-select v-model="taskDomainSel" style="width: 280px" placeholder="选择领域">
            <el-option
              v-for="d in domainsForType"
              :key="d"
              :label="d"
              :value="d"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="taskAddVisible=false">取消</el-button>
        <el-button type="primary" @click="confirmAddTask">添加</el-button>
      </template>
    </el-dialog>

    <!-- =============== 管理任务（当前类型） =============== -->
    <el-dialog v-model="manageVisible" :width="'min(680px,96vw)'" align-center>
      <template #header>
        <strong>管理任务</strong>
        <span style="margin-left:8px;font-weight:400;color:var(--el-text-color-secondary)">
          （当前：{{ selected || '未选择' }}）
        </span>
      </template>

      <div v-if="tasksOfSelected.length === 0" class="empty">暂无任务，先添加一个吧～</div>

      <el-table v-else :data="tasksOfSelected" border style="width:100%">
        <el-table-column prop="title" label="标题" min-width="260" />
        <el-table-column prop="minutes" label="时长" width="100">
          <template #default="{ row }">{{ row.minutes }} 分钟</template>
        </el-table-column>
        <el-table-column
          v-if="TYPE_TO_DOMAINS[selected]?.length"
          prop="domain"
          label="领域"
          min-width="120"
        />
        <el-table-column label="来源" width="100" align="center">
          <template #default="{ row }">
            <el-tag type="info" v-if="row.source==='base'">内置</el-tag>
            <el-tag type="success" v-else>自建</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160" align="center">
          <template #default="{ row }">
            <el-button size="small" text type="primary" @click="openEditTask(row)">
              <el-icon style="margin-right:4px"><EditPen /></el-icon> 编辑
            </el-button>
            <el-button size="small" text type="danger" @click="removeTask(row)">
              <el-icon style="margin-right:4px"><DeleteIcon /></el-icon> 删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <template #footer>
        <el-button @click="manageVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.m-page{max-width:480px;margin:0 auto;padding:12px 12px calc(var(--layout-footer-h,56px) + 140px + env(safe-area-inset-bottom))}
.badges{display:flex;gap:6px;flex-wrap:wrap}
.tag{font-size:12px;padding:2px 8px;border-radius:999px;border:1px solid #eaecef;background:#fafafa}
.tag--ok{background:#edf9f0;border-color:#cfe9d7;color:#2e7d32}
.tag--warn{background:#fff7eb;border-color:#ffe0b2;color:#c77800}

.m-grid{margin-top:8px;display:grid;grid-template-columns:1fr 1fr;gap:12px}
.m-tile{border-radius:16px;cursor:pointer;min-height:112px;position:relative}
.m-tile.active{border-color:var(--el-color-primary)}
.tile-title{font-weight:700}
.tile-desc{margin-top:4px;color:var(--el-text-color-secondary);font-size:12px}
.tile-actions{position:absolute;right:10px;bottom:8px;display:flex;gap:6px}

.empty{ text-align:center;color:#606266;padding:40px 0 }

.floating-cta{
  position:fixed;left:50%;transform:translateX(-50%);
  bottom:calc(var(--layout-footer-h,56px) + 12px + env(safe-area-inset-bottom));
  width:min(92vw,640px);box-sizing:border-box;pointer-events:none;z-index:100;
}
.cta-btn{
  pointer-events:auto;width:100%;border:0;border-radius:999px;padding:14px 18px;
  font-weight:900;font-size:16px;color:#fff;letter-spacing:.2px;
  background:linear-gradient(135deg,#7c3aed 0%,#22d3ee 100%);
  box-shadow:0 10px 24px rgba(124,58,237,.25),0 2px 6px rgba(0,0,0,.08);
  cursor:pointer;user-select:none;transition:transform .16s ease, box-shadow .16s ease, filter .16s ease;
}
.cta-btn:hover{ transform:translateY(-1px); box-shadow:0 14px 30px rgba(124,58,237,.28),0 4px 10px rgba(0,0,0,.1) }
@keyframes breathTap{0%{transform:scale(1);box-shadow:0 0 0 rgba(124,58,237,0)}50%{transform:scale(1.03);box-shadow:0 10px 20px rgba(124,58,237,.1)}100%{transform:scale(1);box-shadow:0 0 0 rgba(124,58,237,0)}}
.is-breathing{ animation:breathTap 420ms ease }
</style>
