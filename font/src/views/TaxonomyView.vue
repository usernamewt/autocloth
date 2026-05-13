<template>
  <div class="space-y-6">
    <header class="flex items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">分类管理</h1>
        <p class="text-sm text-muted-foreground mt-1">管理分类组与分类项（2-3 级层级），用于精细化标签与 LLM 推荐</p>
      </div>
      <div class="flex gap-2">
        <UiButton variant="outline" size="sm" :disabled="loadingTree" @click="loadTree">刷新</UiButton>
        <UiButton size="sm" :disabled="seeding" @click="seed">
          {{ seeding ? '初始化中...' : '初始化种子数据' }}
        </UiButton>
      </div>
    </header>

    <div
      v-if="msg"
      class="rounded-md border p-3 text-sm"
      :class="msgType === 'error' ? 'border-destructive/30 bg-destructive/10 text-destructive' : 'border-green-300 bg-green-50 text-green-700'"
    >
      {{ msg }}
    </div>

    <div v-if="loadingTree" class="text-sm text-muted-foreground">加载中...</div>

    <div v-else-if="tree.length === 0" class="text-sm text-muted-foreground">
      暂无分类数据，点击右上角「初始化种子数据」一键生成完整分类体系。
    </div>

    <!-- 基础分类 -->
    <div v-if="basicGroups.length > 0" class="space-y-3">
      <h2 class="text-sm font-semibold">基础分类</h2>
      <UiCard v-for="group in basicGroups" :key="group.id">
        <div class="p-4 space-y-3">
          <button
            class="w-full text-left flex items-center justify-between"
            @click="toggleExpand(group.id)"
          >
            <div class="flex items-center gap-2">
              <span class="font-semibold text-sm">{{ group.display_name }}</span>
              <span class="text-xs text-muted-foreground">({{ group.key_name }})</span>
              <span class="px-1.5 py-0.5 text-[10px] rounded bg-primary/10 text-primary">基础</span>
            </div>
            <span class="text-xs text-muted-foreground">{{ expanded.has(group.id) ? '收起' : '展开' }}</span>
          </button>

          <div v-if="expanded.has(group.id)" class="space-y-1 pl-2 border-l-2 border-primary/30">
            <template v-for="term in group.terms" :key="term.id">
              <div class="py-1 pl-2">
                <span class="text-sm font-medium">{{ term.display_name }}</span>
                <span class="ml-1 text-xs text-muted-foreground">({{ term.key_name }})</span>
              </div>
              <div v-if="term.children && term.children.length > 0" class="pl-6 space-y-0.5">
                <div v-for="child in term.children" :key="child.id" class="py-0.5 flex items-center gap-1">
                  <span class="text-muted-foreground text-xs">└</span>
                  <span class="text-xs">{{ child.display_name }}</span>
                  <span class="text-[10px] text-muted-foreground">({{ child.key_name }})</span>
                </div>
              </div>
            </template>
          </div>
        </div>
      </UiCard>
    </div>

    <!-- 详细属性 -->
    <div v-if="advancedGroups.length > 0" class="space-y-3">
      <h2 class="text-sm font-semibold text-muted-foreground">详细属性</h2>
      <UiCard v-for="group in advancedGroups" :key="group.id">
        <div class="p-4 space-y-3">
          <button
            class="w-full text-left flex items-center justify-between"
            @click="toggleExpand(group.id)"
          >
            <div class="flex items-center gap-2">
              <span class="font-semibold text-sm">{{ group.display_name }}</span>
              <span class="text-xs text-muted-foreground">({{ group.key_name }})</span>
            </div>
            <span class="text-xs text-muted-foreground">{{ expanded.has(group.id) ? '收起' : '展开' }}</span>
          </button>

          <div v-if="expanded.has(group.id)" class="space-y-1 pl-2 border-l-2 border-muted">
            <template v-for="term in group.terms" :key="term.id">
              <div class="py-1 pl-2">
                <span class="text-sm font-medium">{{ term.display_name }}</span>
                <span class="ml-1 text-xs text-muted-foreground">({{ term.key_name }})</span>
              </div>
              <div v-if="term.children && term.children.length > 0" class="pl-6 space-y-0.5">
                <div v-for="child in term.children" :key="child.id" class="py-0.5 flex items-center gap-1">
                  <span class="text-muted-foreground text-xs">└</span>
                  <span class="text-xs">{{ child.display_name }}</span>
                  <span class="text-[10px] text-muted-foreground">({{ child.key_name }})</span>
                </div>
              </div>
            </template>
          </div>
        </div>
      </UiCard>
    </div>

    <!-- 手动新增分类组/项 -->
    <UiCard>
      <div class="p-4 space-y-4">
        <h3 class="text-sm font-semibold">手动新增</h3>
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <UiInput v-model="newGroupName" placeholder="组显示名称" />
          <UiInput v-model="newGroupKey" placeholder="组 key" />
          <UiButton :disabled="creatingGroup || !newGroupName.trim() || !newGroupKey.trim()" @click="addGroup">
            新增分类组
          </UiButton>
        </div>
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <UiSelectRadix v-model="selectedGroupId" :options="groupOptions" placeholder="选择分类组" />
          <UiInput v-model="newTermName" placeholder="项显示名称" />
          <UiInput v-model="newTermKey" placeholder="项 key" />
          <UiSelectRadix v-model="newTermParentId" :options="termParentOptions" />
          <UiButton :disabled="creatingTerm || !selectedGroupId || !newTermName.trim() || !newTermKey.trim()" @click="addTerm">
            新增分类项
          </UiButton>
        </div>
      </div>
    </UiCard>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiCard from '@/components/ui/UiCard.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiSelectRadix from '@/components/ui/UiSelectRadix.vue'
import {
  createTaxonomyGroup,
  createTaxonomyTerm,
  getTaxonomyTree,
  seedTaxonomy,
  type TaxonomyGroupTree,
  type TaxonomyTermTree,
} from '@/lib/taxonomyApi'

const BASIC_KEYS = new Set(['garment_type', 'color', 'season', 'scene', 'style'])

const tree = ref<TaxonomyGroupTree[]>([])
const loadingTree = ref(false)
const seeding = ref(false)

const basicGroups = computed(() => tree.value.filter((g) => BASIC_KEYS.has(g.key_name)))
const advancedGroups = computed(() => tree.value.filter((g) => !BASIC_KEYS.has(g.key_name)))

const msg = ref('')
const msgType = ref<'success' | 'error'>('success')

const expanded = reactive(new Set<string>())

const creatingGroup = ref(false)
const newGroupName = ref('')
const newGroupKey = ref('')

const creatingTerm = ref(false)
const selectedGroupId = ref('')
const newTermName = ref('')
const newTermKey = ref('')
const newTermParentId = ref('__none__')

const parentCandidates = computed(() => {
  const group = tree.value.find((g) => g.id === selectedGroupId.value)
  if (!group) return []
  const result: { id: string; display_name: string }[] = []
  function walk(terms: TaxonomyTermTree[]) {
    for (const t of terms) {
      result.push({ id: t.id, display_name: t.display_name })
      if (t.children) walk(t.children)
    }
  }
  walk(group.terms)
  return result
})

const groupOptions = computed(() =>
  tree.value.map((g) => ({ value: g.id, label: g.display_name }))
)

const termParentOptions = computed(() => [
  { value: '__none__', label: '无父级' },
  ...parentCandidates.value.map((t) => ({ value: t.id, label: t.display_name })),
])

function toggleExpand(id: string) {
  if (expanded.has(id)) expanded.delete(id)
  else expanded.add(id)
}

async function loadTree() {
  loadingTree.value = true
  msg.value = ''
  try {
    tree.value = await getTaxonomyTree()
    // 默认展开基础分类组
    for (const g of tree.value) {
      if (BASIC_KEYS.has(g.key_name)) expanded.add(g.id)
    }
  } catch (e: any) {
    msg.value = e?.message || '加载失败'
    msgType.value = 'error'
  } finally {
    loadingTree.value = false
  }
}

async function seed() {
  seeding.value = true
  msg.value = ''
  try {
    const result = await seedTaxonomy()
    msg.value = `初始化完成：新增 ${result.groups_created} 个组，${result.terms_created} 个分类项`
    msgType.value = 'success'
    await loadTree()
  } catch (e: any) {
    msg.value = e?.message || '初始化失败'
    msgType.value = 'error'
  } finally {
    seeding.value = false
  }
}

async function addGroup() {
  creatingGroup.value = true
  msg.value = ''
  try {
    await createTaxonomyGroup({
      key_name: newGroupKey.value.trim(),
      display_name: newGroupName.value.trim(),
    })
    newGroupKey.value = ''
    newGroupName.value = ''
    await loadTree()
  } catch (e: any) {
    msg.value = e?.message || '创建失败'
    msgType.value = 'error'
  } finally {
    creatingGroup.value = false
  }
}

async function addTerm() {
  if (!selectedGroupId.value) return
  creatingTerm.value = true
  msg.value = ''
  try {
    await createTaxonomyTerm(selectedGroupId.value, {
      key_name: newTermKey.value.trim(),
      display_name: newTermName.value.trim(),
      parent_id: newTermParentId.value === '__none__' ? null : newTermParentId.value,
    })
    newTermKey.value = ''
    newTermName.value = ''
    newTermParentId.value = '__none__'
    await loadTree()
  } catch (e: any) {
    msg.value = e?.message || '创建失败'
    msgType.value = 'error'
  } finally {
    creatingTerm.value = false
  }
}

onMounted(loadTree)
</script>

<style scoped></style>
