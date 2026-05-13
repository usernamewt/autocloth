<template>
  <div class="space-y-6">
    <header class="flex items-start justify-between gap-4 flex-wrap">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">衣物详情</h1>
        <p v-if="item" class="text-sm text-muted-foreground mt-1">
          {{ item.name || typeLabel }}
          <span class="mx-1">·</span>
          {{ item.status === 'processing' ? '处理中' : item.status === 'ready' ? '就绪' : item.status === 'error' ? '处理失败' : item.status }}
        </p>
      </div>
      <div v-if="item" class="flex items-center gap-2 flex-wrap">
        <button
          class="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm transition-colors"
          :class="item.favorite ? 'border-yellow-400 bg-yellow-50 text-yellow-700' : 'hover:bg-accent'"
          :disabled="saving"
          @click="toggleFavorite"
        >{{ item.favorite ? '★ 已收藏' : '☆ 收藏' }}</button>
        <UiButton variant="outline" size="sm" :disabled="wearing" @click="markWorn">
          {{ wearing ? '记录中...' : '穿着一次' }}
        </UiButton>
        <UiButton variant="outline" size="sm" @click="startEdit">
          {{ editing ? '取消' : '编辑' }}
        </UiButton>
        <ConfirmDialog title="删除衣物" description="删除后无法恢复（含图片），确定删除这件衣物吗？" @confirm="remove">
          <UiButton size="sm" class="border-destructive/40 text-destructive hover:bg-destructive/10" variant="outline" :disabled="deleting">
            {{ deleting ? '删除中...' : '删除' }}
          </UiButton>
        </ConfirmDialog>
        <UiButton variant="outline" size="sm" @click="$router.push('/items')">返回列表</UiButton>
      </div>
      <UiButton v-else variant="outline" size="sm" @click="$router.push('/items')">返回列表</UiButton>
    </header>

    <div
      v-if="error"
      class="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
    >
      {{ error }}
    </div>
    <div v-else-if="loading" class="text-sm text-muted-foreground">加载中...</div>

    <template v-else-if="item">
      <!-- 基本信息 + AI 标签 -->
      <UiCard>
        <div class="p-6">
          <div class="grid gap-6 lg:grid-cols-2">
            <div class="rounded-lg border bg-muted overflow-hidden">
              <img
                v-if="item.image_url || item.thumbnail_url"
                class="w-full max-h-[520px] object-contain"
                :src="item.image_url || item.thumbnail_url"
                alt=""
              />
              <div v-else class="h-[320px] flex items-center justify-center text-xs text-muted-foreground">
                No Image
              </div>
            </div>

            <div class="space-y-4">
              <div class="flex items-center gap-2 flex-wrap">
                <UiBadge variant="secondary">{{ typeLabel }}</UiBadge>
                <UiBadge v-if="item.primary_color" variant="outline">{{ item.primary_color }}</UiBadge>
                <UiBadge v-if="item.favorite" variant="secondary">收藏</UiBadge>
                <UiBadge v-if="item.needs_wash" variant="destructive">需要洗</UiBadge>
              </div>

              <div class="grid gap-2 text-sm">
                <div class="flex items-center justify-between border-b py-2">
                  <span class="text-muted-foreground">状态</span>
                  <span class="font-medium">{{ item.status }}</span>
                </div>
                <div class="flex items-center justify-between border-b py-2">
                  <span class="text-muted-foreground">穿着次数</span>
                  <span class="font-medium">{{ item.wear_count }}</span>
                </div>
                <div class="flex items-center justify-between border-b py-2">
                  <span class="text-muted-foreground">建议次数</span>
                  <span class="font-medium">{{ item.suggestion_count }}</span>
                </div>
              </div>

              <div
                v-if="item.status === 'processing'"
                class="rounded-md border bg-accent/40 p-3 text-xs text-muted-foreground flex items-center gap-2"
              >
                <svg class="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" class="opacity-25" /><path d="M4 12a8 8 0 018-8" stroke="currentColor" stroke-width="4" stroke-linecap="round" class="opacity-75" /></svg>
                正在处理中（图生图抠图），完成后自动刷新
              </div>

              <!-- 颜色调色盘 -->
              <div v-if="colorTerms.length > 0" class="space-y-2">
                <div class="text-sm font-medium text-muted-foreground">颜色</div>
                <div v-if="colorTerms.filter(t => selectedTermIds.has(t.id)).length > 0" class="flex flex-wrap gap-x-3 gap-y-2">
                  <div
                    v-for="term in colorTerms.filter(t => selectedTermIds.has(t.id))"
                    :key="term.id"
                    class="flex flex-col items-center gap-1"
                    :title="term.display_name"
                  >
                    <span
                      class="w-10 h-10 rounded-full shadow-md ring-2 ring-offset-2 ring-offset-background ring-primary/30"
                      :style="getSwatchStyle(term)"
                    />
                    <span class="text-[10px] text-foreground w-10 text-center leading-tight line-clamp-2">{{ term.display_name }}</span>
                  </div>
                </div>
                <div v-else class="text-xs text-muted-foreground">暂未设置颜色</div>
              </div>

              <!-- AI 识别标签 -->
              <div v-if="tagList.length > 0" class="space-y-2">
                <div class="text-sm font-medium text-muted-foreground">AI 识别标签</div>
                <div class="flex flex-wrap gap-1.5">
                  <span
                    v-for="(tag, i) in tagList"
                    :key="i"
                    class="inline-flex items-center px-2 py-0.5 text-xs rounded-full bg-muted text-muted-foreground border"
                  >{{ tag }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </UiCard>

      <!-- 基础分类（品类、颜色、季节、场景、风格） -->
      <UiCard>
        <div class="p-6 space-y-5">
          <div class="flex items-center justify-between gap-2 flex-wrap">
            <h2 class="text-lg font-semibold">基础分类</h2>
            <div class="flex gap-2">
              <UiButton size="sm" variant="outline" :disabled="aiClassifying || savingTaxonomy" @click="runAiClassify">
                <svg v-if="aiClassifying" class="animate-spin h-3.5 w-3.5 mr-1" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" class="opacity-25" /><path d="M4 12a8 8 0 018-8" stroke="currentColor" stroke-width="4" stroke-linecap="round" class="opacity-75" /></svg>
                {{ aiClassifying ? 'AI 识别中...' : 'AI 分类' }}
              </UiButton>
              <UiButton size="sm" :disabled="savingTaxonomy" @click="saveTaxonomy">
                {{ savingTaxonomy ? '保存中...' : '保存分类' }}
              </UiButton>
            </div>
          </div>
          <p class="text-xs text-muted-foreground -mt-3">选择最匹配的标签，用于 LLM 穿搭推荐</p>
          <div v-if="taxonomyMsg" class="text-sm text-green-600">{{ taxonomyMsg }}</div>

          <div v-if="tree.length === 0" class="text-sm text-muted-foreground">
            暂无分类数据，请先在「分类管理」页面初始化种子数据。
          </div>

          <div v-for="group in nonColorBasicGroups" :key="group.id" class="space-y-2">
            <div class="text-sm font-medium text-foreground">{{ group.display_name }}</div>
            <div class="flex flex-wrap gap-1.5">
              <template v-for="term in flatGroupTerms(group)" :key="term.id">
                <button
                  class="px-2 py-0.5 text-xs rounded-md border transition-colors"
                  :class="selectedTermIds.has(term.id) ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-accent'"
                  @click="toggleTerm(term.id)"
                >
                  <span v-if="term._depth > 0" class="text-muted-foreground mr-0.5">·</span>{{ term.display_name }}
                </button>
              </template>
            </div>
          </div>
        </div>
      </UiCard>

      <!-- 详细属性（折叠） -->
      <UiCard v-if="advancedGroups.length > 0">
        <div class="p-6 space-y-4">
          <button
            class="w-full flex items-center justify-between text-left"
            @click="showAdvanced = !showAdvanced"
          >
            <h2 class="text-sm font-semibold text-muted-foreground">详细属性（性别、年龄、袖长、领型、面料、版型）</h2>
            <span class="text-xs text-muted-foreground">{{ showAdvanced ? '收起' : '展开' }}</span>
          </button>

          <template v-if="showAdvanced">
            <div v-for="group in advancedGroups" :key="group.id" class="space-y-2">
              <div class="text-sm font-medium text-foreground">{{ group.display_name }}</div>
              <div class="flex flex-wrap gap-1.5">
                <template v-for="term in flatGroupTerms(group)" :key="term.id">
                  <button
                    class="px-2 py-0.5 text-xs rounded-md border transition-colors"
                    :class="selectedTermIds.has(term.id) ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-accent'"
                    @click="toggleTerm(term.id)"
                  >
                    <span v-if="term._depth > 0" class="text-muted-foreground mr-0.5">·</span>{{ term.display_name }}
                  </button>
                </template>
              </div>
            </div>

            <div class="pt-2">
              <UiButton size="sm" :disabled="savingTaxonomy" @click="saveTaxonomy">
                {{ savingTaxonomy ? '保存中...' : '保存分类' }}
              </UiButton>
            </div>
          </template>
        </div>
      </UiCard>

      <!-- 编辑信息 -->
      <UiCard v-if="editing">
        <div class="p-6 space-y-4">
          <h2 class="text-lg font-semibold">编辑信息</h2>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="grid gap-2">
              <label class="text-sm font-medium">名称</label>
              <UiInput v-model="editForm.name" placeholder="例如：白色衬衫" />
            </div>
            <div class="grid gap-2">
              <label class="text-sm font-medium">类型</label>
              <UiSelectRadix
                :model-value="editTypeTermId"
                :options="garmentTypeOptions"
                placeholder="选择分类"
                @update:model-value="onEditTypeChange"
              />
            </div>
            <div class="grid gap-2">
              <label class="text-sm font-medium">品牌</label>
              <UiInput v-model="editForm.brand" placeholder="可选" />
            </div>
          </div>
          <div class="grid gap-2">
            <label class="text-sm font-medium">备注</label>
            <UiTextarea v-model="editForm.notes" placeholder="可选" />
          </div>
          <div class="flex items-center gap-4">
            <UiCheckbox v-model="editForm.needs_wash">标记为需要清洗</UiCheckbox>
          </div>
          <div v-if="saveMsg" class="text-sm text-green-600">{{ saveMsg }}</div>
          <div v-if="saveError" class="text-sm text-destructive">{{ saveError }}</div>
          <div class="flex gap-2">
            <UiButton :disabled="saving" @click="saveEdit">
              {{ saving ? '保存中...' : '保存' }}
            </UiButton>
            <UiButton variant="outline" @click="editing = false">取消</UiButton>
          </div>
        </div>
      </UiCard>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getItem, subscribeItemStatus, patchItem, deleteItem, wearItem } from '@/lib/itemsApi'
import {
  getItemTaxonomy,
  getTaxonomyTree,
  setItemTaxonomy,
  autoClassifyItem,
  type TaxonomyGroupTree,
  type TaxonomyTermTree,
} from '@/lib/taxonomyApi'
import type { Item } from '@/lib/types'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiCard from '@/components/ui/UiCard.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiSelectRadix from '@/components/ui/UiSelectRadix.vue'
import UiTextarea from '@/components/ui/UiTextarea.vue'
import UiCheckbox from '@/components/ui/UiCheckbox.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'

const BASIC_KEYS = new Set(['garment_type', 'color', 'season', 'scene', 'style'])

const route = useRoute()
const router = useRouter()
const id = computed(() => String(route.params.id || ''))

const item = ref<Item | null>(null)
const loading = ref(false)
const error = ref('')
const showAdvanced = ref(false)

// Edit
const editing = ref(false)
const editForm = reactive({ name: '', type: '', brand: '', notes: '', needs_wash: false })
const editTypeTermId = ref('')
const saving = ref(false)
const saveMsg = ref('')
const saveError = ref('')

// Actions
const wearing = ref(false)
const deleting = ref(false)

let closeSse: (() => void) | null = null

// Taxonomy
const tree = ref<TaxonomyGroupTree[]>([])
const selectedTermIds = reactive(new Set<string>())
const savingTaxonomy = ref(false)
const taxonomyMsg = ref('')
const aiClassifying = ref(false)

const basicGroups = computed(() => tree.value.filter((g) => BASIC_KEYS.has(g.key_name)))
const nonColorBasicGroups = computed(() => basicGroups.value.filter((g) => g.key_name !== 'color'))
const advancedGroups = computed(() => tree.value.filter((g) => !BASIC_KEYS.has(g.key_name)))
const colorGroup = computed(() => tree.value.find((g) => g.key_name === 'color') ?? null)
const colorTerms = computed(() => colorGroup.value ? flatGroupTerms(colorGroup.value) : [])

const typeLabel = computed(() => {
  const garmentGroup = tree.value.find((g) => g.key_name === 'garment_type')
  if (garmentGroup) {
    const flat = flatGroupTerms(garmentGroup)
    const selected = flat.filter((t) => selectedTermIds.has(t.id))
    if (selected.length > 0) return selected.map((t) => t.display_name).join('/')
  }
  return item.value?.type || ''
})

const garmentTypeOptions = computed(() => {
  const garmentGroup = tree.value.find((g) => g.key_name === 'garment_type')
  if (!garmentGroup) return []
  return flatGroupTerms(garmentGroup).map((t) => ({ value: t.id, label: t.display_name }))
})

const tagList = computed<string[]>(() => {
  if (!item.value?.tags) return []
  const tags = item.value.tags
  if (Array.isArray(tags)) return tags.map(String)
  if (typeof tags === 'object') {
    const result: string[] = []
    for (const [k, v] of Object.entries(tags as Record<string, unknown>)) {
      if (Array.isArray(v)) {
        v.forEach((val) => result.push(`${k}: ${val}`))
      } else if (v !== null && v !== undefined && v !== '') {
        result.push(`${k}: ${v}`)
      }
    }
    return result
  }
  return []
})

interface FlatTerm {
  id: string
  key_name: string
  display_name: string
  _depth: number
}

function flatGroupTerms(group: TaxonomyGroupTree): FlatTerm[] {
  const result: FlatTerm[] = []
  function walk(terms: TaxonomyTermTree[], depth: number) {
    for (const t of terms) {
      result.push({ id: t.id, key_name: t.key_name, display_name: t.display_name, _depth: depth })
      if (t.children && t.children.length > 0) walk(t.children, depth + 1)
    }
  }
  walk(group.terms, 0)
  return result
}

function resolveSwatchColor(term: FlatTerm): string | null {
  const s = term.key_name.toLowerCase() + '|' + term.display_name
  if (/white|白/.test(s)) return '#F3F3F3'
  if (/black|黑/.test(s)) return '#1F1F1F'
  if (/gr[ae]y|灰/.test(s)) return '#9CA3AF'
  if (/navy|藏蓝|深蓝/.test(s)) return '#1E3A5F'
  if (/light.?blue|浅蓝/.test(s)) return '#93C5FD'
  if (/blue|蓝/.test(s)) return '#3B82F6'
  if (/green|绿/.test(s)) return '#22C55E'
  if (/red|红/.test(s)) return '#EF4444'
  if (/pink|粉/.test(s)) return '#F472B6'
  if (/orange|橙/.test(s)) return '#F97316'
  if (/yellow|黄/.test(s)) return '#EAB308'
  if (/purple|紫/.test(s)) return '#A855F7'
  if (/brown|棕|褐/.test(s)) return '#92400E'
  if (/beige|米白|米色|奶/.test(s)) return '#F5E6D0'
  if (/khaki|卡其|驼/.test(s)) return '#C4A472'
  if (/gold|金色/.test(s)) return '#D4AF37'
  if (/silver|银色/.test(s)) return '#B0B0B0'
  return null
}

function getSwatchStyle(term: FlatTerm): Record<string, string> {
  const color = resolveSwatchColor(term)
  if (!color) {
    const s = term.key_name + term.display_name
    if (/strip|条纹/.test(s)) {
      return { background: 'repeating-linear-gradient(45deg,#d1d5db 0px,#d1d5db 4px,#fff 4px,#fff 8px)', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.1)' }
    }
    return { background: 'conic-gradient(from 0deg,#ef4444 0%,#f97316 16%,#eab308 33%,#22c55e 50%,#3b82f6 66%,#a855f7 83%,#ef4444 100%)', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.1)' }
  }
  return { background: color, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.12)' }
}

function toggleTerm(termId: string) {
  if (selectedTermIds.has(termId)) selectedTermIds.delete(termId)
  else selectedTermIds.add(termId)
}

function startEdit() {
  if (!item.value) return
  if (editing.value) { editing.value = false; return }
  editForm.name = item.value.name || ''
  editForm.type = item.value.type || ''
  editForm.brand = item.value.brand || ''
  editForm.notes = item.value.notes || ''
  editForm.needs_wash = item.value.needs_wash
  const garmentGroup = tree.value.find((g) => g.key_name === 'garment_type')
  if (garmentGroup) {
    const flat = flatGroupTerms(garmentGroup)
    const found = flat.find((t) => selectedTermIds.has(t.id))
    editTypeTermId.value = found?.id || ''
  }
  saveMsg.value = ''
  saveError.value = ''
  editing.value = true
}

function onEditTypeChange(termId: string) {
  editTypeTermId.value = termId
  const garmentGroup = tree.value.find((g) => g.key_name === 'garment_type')
  if (garmentGroup) {
    flatGroupTerms(garmentGroup).forEach((t) => selectedTermIds.delete(t.id))
  }
  if (termId) {
    selectedTermIds.add(termId)
    const term = garmentGroup ? flatGroupTerms(garmentGroup).find((t) => t.id === termId) : undefined
    editForm.type = term?.key_name || ''
  } else {
    editForm.type = ''
  }
}

async function saveEdit() {
  if (!item.value) return
  saving.value = true
  saveMsg.value = ''
  saveError.value = ''
  try {
    item.value = await patchItem(item.value.id, {
      name: editForm.name.trim() || undefined,
      type: editForm.type.trim() || undefined,
      brand: editForm.brand.trim() || undefined,
      notes: editForm.notes.trim() || undefined,
      needs_wash: editForm.needs_wash,
    })
    await setItemTaxonomy(item.value.id, [...selectedTermIds])
    saveMsg.value = '已保存'
    setTimeout(() => { saveMsg.value = '' }, 2000)
    editing.value = false
  } catch (e: any) {
    saveError.value = e?.message || '保存失败'
  } finally {
    saving.value = false
  }
}

async function toggleFavorite() {
  if (!item.value || saving.value) return
  saving.value = true
  try {
    item.value = await patchItem(item.value.id, { favorite: !item.value.favorite })
  } catch { /* ignore */ } finally {
    saving.value = false
  }
}

async function markWorn() {
  if (!item.value || wearing.value) return
  wearing.value = true
  try {
    item.value = await wearItem(item.value.id)
  } catch { /* ignore */ } finally {
    wearing.value = false
  }
}

async function remove() {
  if (!item.value) return
  deleting.value = true
  try {
    await deleteItem(item.value.id)
    router.push('/items')
  } catch (e: any) {
    error.value = e?.message || '删除失败'
    deleting.value = false
  }
}

async function runAiClassify() {
  if (!item.value) return
  aiClassifying.value = true
  taxonomyMsg.value = ''
  try {
    await autoClassifyItem(item.value.id)
    const assigned = await getItemTaxonomy(item.value.id)
    selectedTermIds.clear()
    for (const t of assigned) selectedTermIds.add(t.term_id)
    taxonomyMsg.value = 'AI 分类完成'
    setTimeout(() => { taxonomyMsg.value = '' }, 3000)
  } catch (e: any) {
    taxonomyMsg.value = 'AI 分类失败：' + (e?.message || '未知错误')
  } finally {
    aiClassifying.value = false
  }
}

async function saveTaxonomy() {
  if (!item.value) return
  savingTaxonomy.value = true
  taxonomyMsg.value = ''
  try {
    await setItemTaxonomy(item.value.id, [...selectedTermIds])
    taxonomyMsg.value = '分类已保存'
    setTimeout(() => { taxonomyMsg.value = '' }, 3000)
  } catch (e: any) {
    taxonomyMsg.value = ''
    error.value = e?.message || '保存失败'
  } finally {
    savingTaxonomy.value = false
  }
}

async function load() {
  if (!id.value) return
  loading.value = true
  error.value = ''
  try {
    item.value = await getItem(id.value)
  } catch (e: any) {
    error.value = e?.message || '加载失败'
  } finally {
    loading.value = false
  }
}

async function loadTaxonomyData() {
  try {
    tree.value = await getTaxonomyTree()
  } catch { /* taxonomy not seeded yet */ }
  if (!id.value) return
  try {
    const assigned = await getItemTaxonomy(id.value)
    selectedTermIds.clear()
    for (const t of assigned) selectedTermIds.add(t.term_id)
  } catch { /* ignore */ }
}

function startSseIfNeeded() {
  closeSse?.()
  closeSse = null
  if (item.value?.status !== 'processing') return
  closeSse = subscribeItemStatus(item.value.id, {
    onReady: (updated) => { item.value = updated },
    onError: () => { if (item.value) item.value.status = 'error' },
  })
}

watch(id, async () => {
  closeSse?.()
  closeSse = null
  editing.value = false
  await load()
  await loadTaxonomyData()
  startSseIfNeeded()
})

onMounted(async () => {
  await load()
  await loadTaxonomyData()
  startSseIfNeeded()
})

onBeforeUnmount(() => { closeSse?.() })
</script>

<style scoped></style>
