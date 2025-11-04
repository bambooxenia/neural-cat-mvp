<script setup lang="ts">
defineOptions({ name: 'MoodPage' })

import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Plus, EditPen, Delete as DeleteIcon, List } from '@element-plus/icons-vue'

/** Stores */
import { useMoodCatalogStore } from '@/features/mood-baits/stores/moodCatalog.store'
import { useMoodSessionStore } from '@/features/mood-baits/stores/moodSession.store'
import { useUserBaitStore } from '@/features/mood-baits/stores/userBait.store'

/** 唯一共享组件 */
import MoodChooser from '@/features/mood-baits/components/MoodChooser.vue'
import PageHeader from '@/shared/components/PageHeader.vue'

const router = useRouter()
const route = useRoute()

const catalog = useMoodCatalogStore()
const session = useMoodSessionStore()
const userBait = useUserBaitStore()

/** 与 session.currentMood 同步的本地选中值 */
const selected = ref<string>('')

/* -------------------------------- 首屏编排 -------------------------------- */
onMounted(() => {
  catalog.load()
  session.hydrate(catalog.moodList)
  userBait.normalizeByResolver(catalog.resolveKey)
  userBait.ensureSeededFromDefaults(catalog.moodList)

  const q = (route.query.mood as string | undefined)?.trim()
  if (q && catalog.moodList.includes(q)) {
    session.setMood(q)
  }
  selected.value = session.currentMood
  navigator?.vibrate?.(6)
})

/** 可见列表变更时，保证 selected 合法 */
watch(
  () => catalog.moodList,
  (list) => {
    if (!Array.isArray(list) || list.length === 0) {
      selected.value = ''
      return
    }
    if (!selected.value || !list.includes(selected.value)) {
      selected.value = list[0]
      session.setMood(selected.value)
    }
  }
)

/* ----------------------------- 选择 / 下一步 ----------------------------- */
const onSelectMood = (value: string) => {
  selected.value = value
  session.setMood(value)
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

  // 进入诱饵池：使用命名路由，保留返回栈（push 而不是 replace）
  await router.push({
    name: 'home.mood.baits',
    query: { mood: session.currentMood },
  })
}

/* ------------------------------- 新增心情 ------------------------------- */
const addVisible = ref(false)
const addKey = ref('')
const addLabel = ref('')
const addIcon = ref('✨')
const addSub = ref('自定义心情')

const openAdd = () => {
  addKey.value = ''
  addLabel.value = ''
  addIcon.value = '✨'
  addSub.value = '自定义心情'
  addVisible.value = true
}

const confirmAdd = () => {
  const key = addKey.value.trim()
  const label = (addLabel.value || key).trim()
  const icon = String(addIcon.value || '✨')
  const sub = (addSub.value || '自定义心情').trim()
  if (!key) return ElMessage.warning('请输入内部名称（key）')
  const ok = catalog.addCustomMood(key, { label, icon, sub })
  if (!ok) return ElMessage.warning('该心情已存在或不合法')
  session.setMood(key)
  selected.value = key
  addVisible.value = false
  ElMessage.success('已添加心情')
}

/* ------------------------------- 编辑心情 ------------------------------- */
const editVisible = ref(false)
const editingKey = ref('')
const editIsBase = ref(false)
const editLabel = ref('')
const editIcon = ref('')
const editSub = ref('')
const editNewKey = ref('')

const openEdit = (value: string) => {
  const card = catalog.moodCards.find((c) => c.value === value)
  if (!card) return
  editingKey.value = value
  editIsBase.value = !!card.isBase
  editLabel.value = card.meta.label
  editIcon.value = card.meta.icon
  editSub.value = card.meta.sub
  editNewKey.value = card.isBase ? '' : value
  editVisible.value = true
}

const confirmEdit = () => {
  const oldKey = editingKey.value
  const patch = {
    label: String(editLabel.value || '').trim(),
    icon: String(editIcon.value || '').trim(),
    sub: String(editSub.value || '').trim(),
  }
  catalog.editMoodMeta(oldKey, patch)

  if (!editIsBase.value) {
    const newKey = String(editNewKey.value || '').trim()
    if (newKey && newKey !== oldKey) {
      const ok = catalog.renameCustomMood(oldKey, newKey)
      if (!ok) return ElMessage.warning('改名失败：新名称冲突、形成环或不合法')
      userBait.migrateOnRename(oldKey, newKey)
      userBait.normalizeByResolver(catalog.resolveKey)
      if (session.currentMood === oldKey) {
        session.setMood(newKey)
        selected.value = newKey
      }
    }
  }

  editVisible.value = false
  ElMessage.success('已保存')
}

/* ------------------------------- 删除心情 ------------------------------- */
const delVisible = ref(false)
const delKey = ref('')
const delLabel = ref('')
const delStrategy = ref<'drop-bait' | 'assign-fallback'>('drop-bait')
const delFallback = ref('')

const openDelete = (value: string) => {
  if (catalog.moodList.length <= 1) return ElMessage.info('至少保留一个心情类型哦')
  const card = catalog.moodCards.find((c) => c.value === value)
  delKey.value = value
  delLabel.value = card?.meta.label || value
  delStrategy.value = 'drop-bait'
  delFallback.value = ''
  delVisible.value = true
}

const fallbackOptions = computed(() =>
  catalog.moodCards.map((c) => c.value).filter((v) => v !== delKey.value)
)

const confirmDelete = () => {
  const key = delKey.value
  if (!key) return (delVisible.value = false)

  if (catalog.moodList.length <= 1) {
    delVisible.value = false
    return ElMessage.info('至少保留一个心情类型哦')
  }

  const ok = catalog.removeMood(key)
  if (!ok) return ElMessage.warning('删除失败：至少需保留一个心情')

  const onEmpty = delStrategy.value
  const fallback = onEmpty === 'assign-fallback' ? String(delFallback.value || '').trim() : ''
  if (onEmpty === 'assign-fallback') {
    if (!fallback || fallback === key || !catalog.moodList.includes(fallback)) {
      delVisible.value = false
      return ElMessage.warning('请选择有效的回退心情')
    }
  }

  userBait.purgeOnRemove(key, { onEmpty, fallback })
  session.reconcileCurrentAfterCatalogChanged(catalog.moodList)

  delVisible.value = false
  navigator?.vibrate?.(10)
  ElMessage.success('已删除')
}

/* ------------------------------- 新增诱饵 ------------------------------- */
const baitAddVisible = ref(false)
const baitTitle = ref('')
const baitMood = ref('')

const openAddBait = () => {
  if (!selected.value) return ElMessage.info('请先选择一个心情类型')
  baitTitle.value = ''
  baitMood.value = selected.value
  baitAddVisible.value = true
}

const confirmAddBait = () => {
  const title = baitTitle.value.trim()
  const mood = String(baitMood.value || '').trim()
  if (!title) return ElMessage.warning('请填写诱饵标题')
  if (!mood) return ElMessage.warning('请选择心情类型')
  const ok = userBait.add(title, [mood])
  if (!ok) return ElMessage.error('添加失败')
  baitAddVisible.value = false
  navigator?.vibrate?.(10)
  ElMessage.success('已添加诱饵')
}

/* -------------------------- 诱饵管理（编辑/删除） -------------------------- */
const manageVisible = ref(false)
const openManageBaits = () => {
  manageVisible.value = true
}
const baitsOfSelected = computed(() => {
  const key = catalog.resolveKey(selected.value)
  return userBait.list.filter((b) => b.mood?.some((m) => catalog.resolveKey(m) === key))
})

/** 编辑诱饵弹窗 */
const baitEditVisible = ref(false)
const baitEditId = ref<number | null>(null)
const baitEditTitle = ref('')
const baitEditMoods = ref<string[]>([])

const openEditBait = (id: number) => {
  const row = userBait.list.find((b) => b.id === id)
  if (!row) return
  baitEditId.value = row.id
  baitEditTitle.value = row.title
  baitEditMoods.value = [...row.mood]
  baitEditVisible.value = true
}
const confirmEditBait = () => {
  if (!baitEditId.value) return
  const title = baitEditTitle.value.trim()
  const moods = baitEditMoods.value.slice()
  if (!title) return ElMessage.warning('标题不能为空')
  if (!moods.length) return ElMessage.warning('至少选择一个心情')
  const ok = userBait.update({ id: baitEditId.value, title, mood: moods })
  if (!ok) return ElMessage.error('保存失败')
  baitEditVisible.value = false
  ElMessage.success('已保存')
}
const removeBait = (id: number) => {
  userBait.remove(id)
  ElMessage.success('已删除诱饵')
}
</script>

<template>
  <div class="m-page">
    <PageHeader title="先选一个心情类型">
      <template #extra>
        <el-button text type="primary" @click="openAdd">
          <el-icon style="margin-right: 4px"><Plus /></el-icon> 添加心情
        </el-button>
        <el-button text type="primary" :disabled="!selected" @click="openAddBait">
          <el-icon style="margin-right: 4px"><EditPen /></el-icon> 添加诱饵
        </el-button>
        <el-button text type="primary" :disabled="!selected" @click="openManageBaits">
          <el-icon style="margin-right: 4px"><List /></el-icon> 管理诱饵
        </el-button>
      </template>
    </PageHeader>

    <div class="badges" style="margin: 4px 2px 8px">
      <span class="tag tag--ok">可点选/双击编辑</span>
      <span class="tag tag--warn">右滑或删除按钮可删除</span>
    </div>

    <!-- 心情选择网格 -->
    <MoodChooser
      :cards="catalog.moodCards"
      :selected="selected"
      :min-keep="1"
      @select="onSelectMood"
      @request-edit="openEdit"
      @request-delete="openDelete"
    />

    <div v-if="!catalog.moodList?.length" class="empty">
      没有可选心情了，点右上角「添加心情」吧
      <div class="empty-actions">
        <el-button type="primary" size="small" @click="openAdd">添加心情</el-button>
      </div>
    </div>

    <!-- 悬浮主 CTA -->
    <div class="floating-cta">
      <button
        class="cta-btn"
        :disabled="!selected"
        :class="{ 'is-breathing': breathing }"
        @click="goNext"
      >
        按「{{
          catalog.moodCards.find((x) => x.value === selected)?.meta.label || '选择心情'
        }}」开始
      </button>
    </div>

    <!-- =============== 新增心情 =============== -->
    <el-dialog v-model="addVisible" :width="'min(520px,92vw)'" align-center>
      <template #header><strong>添加心情</strong></template>
      <el-form label-width="108px">
        <el-form-item label="内部名称（key）">
          <el-input
            v-model="addKey"
            maxlength="32"
            show-word-limit
            placeholder="如：excited / sleepy"
          />
        </el-form-item>
        <el-form-item label="显示标题">
          <el-input
            v-model="addLabel"
            maxlength="16"
            show-word-limit
            placeholder="默认使用 key，可稍后再改"
          />
        </el-form-item>
        <el-form-item label="图标">
          <el-input v-model="addIcon" placeholder="😀 / 😴 / ⚡️ / ✨ ..." />
        </el-form-item>
        <el-form-item label="描述">
          <el-input
            v-model="addSub"
            type="textarea"
            :rows="2"
            maxlength="60"
            show-word-limit
            placeholder="一句话描述这个心情…"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmAdd">添加</el-button>
      </template>
    </el-dialog>

    <!-- =============== 编辑心情 =============== -->
    <el-dialog v-model="editVisible" :width="'min(560px,92vw)'" align-center>
      <template #header><strong>编辑心情</strong></template>
      <el-form label-width="108px">
        <el-form-item label="显示标题">
          <el-input v-model="editLabel" maxlength="16" show-word-limit />
        </el-form-item>
        <el-form-item label="图标">
          <el-input v-model="editIcon" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="editSub" type="textarea" :rows="2" maxlength="60" show-word-limit />
        </el-form-item>
        <el-form-item v-if="!editIsBase" label="内部名称（可选）">
          <el-input
            v-model="editNewKey"
            maxlength="32"
            show-word-limit
            placeholder="仅自定义心情可改 key；改名会迁移诱饵"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmEdit">保存</el-button>
      </template>
    </el-dialog>

    <!-- =============== 删除心情（含回退策略） =============== -->
    <el-dialog v-model="delVisible" :width="'min(520px,92vw)'" align-center>
      <template #header><strong>删除心情</strong></template>
      <div style="margin: 4px 0 12px">
        确定要删除「<strong>{{ delLabel }}</strong
        >」吗？
        <div style="margin-top: 6px; font-size: 12px; color: var(--el-text-color-secondary)">
          该心情下的诱饵将被处理：你可以选择全部删除，或把“只属于该心情”的诱饵迁移到另一个心情。
        </div>
      </div>
      <el-form label-width="108px">
        <el-form-item label="处理方式">
          <el-radio-group v-model="delStrategy">
            <el-radio label="drop-bait">删除这些诱饵</el-radio>
            <el-radio label="assign-fallback">迁移到其他心情</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="delStrategy === 'assign-fallback'" label="迁移目标">
          <el-select v-model="delFallback" style="width: 280px" placeholder="选择回退心情">
            <el-option
              v-for="v in fallbackOptions"
              :key="v"
              :label="catalog.getMeta(v).label"
              :value="v"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="delVisible = false">取消</el-button>
        <el-button type="danger" @click="confirmDelete">
          <el-icon style="margin-right: 6px"><DeleteIcon /></el-icon> 删除
        </el-button>
      </template>
    </el-dialog>

    <!-- =============== 新增诱饵 =============== -->
    <el-dialog v-model="baitAddVisible" :width="'min(520px,92vw)'" align-center>
      <template #header><strong>添加诱饵</strong></template>
      <el-form label-width="88px">
        <el-form-item label="标题">
          <el-input
            v-model="baitTitle"
            maxlength="60"
            show-word-limit
            placeholder="如：先喝一杯水 / 收拾桌面 2 分钟"
            @keyup.enter="confirmAddBait"
          />
        </el-form-item>
        <el-form-item label="心情">
          <el-select v-model="baitMood" style="width: 280px" placeholder="选择心情">
            <el-option
              v-for="c in catalog.moodCards"
              :key="c.value"
              :label="c.meta.label"
              :value="c.value"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="baitAddVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmAddBait">添加</el-button>
      </template>
    </el-dialog>

    <!-- =============== 管理诱饵（当前心情） =============== -->
    <el-dialog v-model="manageVisible" :width="'min(680px,96vw)'" align-center>
      <template #header>
        <strong>管理诱饵</strong>
        <span style="margin-left: 8px; font-weight: 400; color: var(--el-text-color-secondary)">
          （当前：{{ catalog.getMeta(selected).label || selected }}）
        </span>
      </template>

      <div v-if="baitsOfSelected.length === 0" class="empty">暂无诱饵，先添加一个吧～</div>

      <el-table v-else :data="baitsOfSelected" border style="width: 100%">
        <el-table-column prop="title" label="标题" min-width="260" />
        <el-table-column prop="mood" label="心情" min-width="180">
          <template #default="{ row }">
            <el-tag v-for="m in row.mood" :key="m" style="margin-right: 6px; margin-bottom: 4px">
              {{ catalog.getMeta(m).label || m }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160" align="center">
          <template #default="{ row }">
            <el-button size="small" text type="primary" @click="openEditBait(row.id)">
              <el-icon style="margin-right: 4px"><EditPen /></el-icon> 编辑
            </el-button>
            <el-button size="small" text type="danger" @click="removeBait(row.id)">
              <el-icon style="margin-right: 4px"><DeleteIcon /></el-icon> 删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <template #footer>
        <el-button @click="manageVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- =============== 编辑诱饵 =============== -->
    <el-dialog v-model="baitEditVisible" :width="'min(560px,92vw)'" align-center>
      <template #header><strong>编辑诱饵</strong></template>
      <el-form label-width="88px">
        <el-form-item label="标题">
          <el-input v-model="baitEditTitle" maxlength="60" show-word-limit />
        </el-form-item>
        <el-form-item label="心情">
          <el-select
            v-model="baitEditMoods"
            multiple
            style="width: 360px"
            placeholder="选择一个或多个心情"
          >
            <el-option
              v-for="c in catalog.moodCards"
              :key="c.value"
              :label="c.meta.label"
              :value="c.value"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="baitEditVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmEditBait">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
/* 页面骨架：为悬浮按钮 + 底部 Tab 预留空间 */
.m-page {
  max-width: 480px;
  margin: 0 auto;
  padding: 12px 12px calc(var(--layout-footer-h, 56px) + 140px + env(safe-area-inset-bottom));
}

.badges {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.tag {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid #eaecef;
  background: #fafafa;
}
.tag--ok {
  background: #edf9f0;
  border-color: #cfe9d7;
  color: #2e7d32;
}
.tag--warn {
  background: #fff7eb;
  border-color: #ffe0b2;
  color: #c77800;
}

.seg-tabs {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  padding: 6px;
  border-radius: 12px;
  background: #f6f7fb;
  border: 1px solid #eff0f4;
  margin: 4px 0 10px;
}
.seg-item {
  border: 0;
  background: #fff;
  border-radius: 999px;
  padding: 10px 4px;
  font-weight: 800;
  font-size: 13px;
  color: #606266;
  cursor: pointer;
  user-select: none;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  transition: transform 0.16s ease, box-shadow 0.16s ease, color 0.16s ease,
    background-color 0.16s ease;
}
.seg-item.active {
  color: #111;
  background: linear-gradient(135deg, #f5f3ff 0%, #eef2ff 50%, #ecfeff 100%);
  box-shadow: 0 2px 10px rgba(124, 58, 237, 0.1);
}
.seg-item:focus-visible {
  outline: 2px solid rgba(124, 58, 237, 0.25);
}

.m-groups {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.m-group {
  background: #fff;
  border: 1px solid #eaecef;
  border-radius: 14px;
  padding: 10px 12px;
}
.g-title {
  font-weight: 700;
  color: #303133;
  margin-bottom: 6px;
}
.g-subtitle {
  font-size: 12px;
  color: #909399;
  margin: 6px 0 6px;
}

.paw-grid {
  display: grid;
  gap: 8px;
  padding: 2px 0 6px;
}
.sticker {
  min-width: 44px;
  height: 34px;
  border-radius: 10px;
  background: #fffaf2;
  border: 1px dashed #ffcf99;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  padding: 2px 4px;
}
.sticker .kaomoji {
  font-size: 12px;
  line-height: 1;
  white-space: nowrap;
  letter-spacing: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: clip;
}
.paw {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  height: 34px;
  border-radius: 10px;
  border: 1px dashed #e8e9ed;
  background: #fafafa;
  font-size: 12px;
  opacity: 0.55;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
  transform: translateY(calc(var(--j, 0) * 1px)) rotate(calc(var(--r, 0) * 1deg));
}
.paw-grid .paw:nth-of-type(3n) {
  opacity: 0.6;
  --r: -6;
  --j: -1;
}
.paw-grid .paw:nth-of-type(4n) {
  opacity: 0.48;
  --r: 5;
  --j: 1;
}
.paw-grid .paw:nth-of-type(5n) {
  opacity: 0.58;
  --r: 9;
  --j: -2;
}
.paw-grid .paw:nth-of-type(7n) {
  opacity: 0.45;
  --r: -8;
  --j: 2;
}

.g-card {
  border: 1px solid #eaecef;
  border-radius: 10px;
  padding: 8px 10px;
  background: #fff;
}
.j-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.j-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
}
.j-link {
  border: 0;
  background: none;
  color: #409eff;
  cursor: pointer;
  font-weight: 600;
}
.j-time {
  color: #909399;
  font-size: 12px;
}

.empty {
  text-align: center;
  color: #606266;
  padding: 40px 0;
}
.empty-actions {
  margin-top: 10px;
}

/* 悬浮主 CTA：不越界、与内容宽度协调 */
.floating-cta {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  bottom: calc(var(--layout-footer-h, 56px) + 12px + env(safe-area-inset-bottom));
  width: min(92vw, 640px);
  box-sizing: border-box;
  pointer-events: none;
  z-index: 100;
}
.cta-btn {
  pointer-events: auto;
  width: 100%;
  border: 0;
  border-radius: 999px;
  padding: 14px 18px;
  font-weight: 900;
  font-size: 16px;
  color: #fff;
  letter-spacing: 0.2px;
  background: linear-gradient(135deg, #7c3aed 0%, #22d3ee 100%);
  box-shadow: 0 10px 24px rgba(124, 58, 237, 0.25), 0 2px 6px rgba(0, 0, 0, 0.08);
  cursor: pointer;
  user-select: none;
  transition: transform 0.16s ease, box-shadow 0.16s ease, filter 0.16s ease;
}
.cta-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 14px 30px rgba(124, 58, 237, 0.28), 0 4px 10px rgba(0, 0, 0, 0.1);
}
.cta-btn:focus-visible {
  outline: 2px solid rgba(124, 58, 237, 0.28);
}

@keyframes breathTap {
  0% {
    transform: scale(1);
    box-shadow: 0 0 0 rgba(124, 58, 237, 0);
  }
  50% {
    transform: scale(1.03);
    box-shadow: 0 10px 20px rgba(124, 58, 237, 0.1);
  }
  100% {
    transform: scale(1);
    box-shadow: 0 0 0 rgba(124, 58, 237, 0);
  }
}
.is-breathing {
  animation: breathTap 420ms ease;
}

@media (min-width: 640px) {
  .m-page {
    max-width: 640px;
  }
}
</style>
