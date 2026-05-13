<template>
  <div class="space-y-6">
    <header>
      <h1 class="text-2xl font-bold tracking-tight">衣橱管理</h1>
      <p class="text-sm text-muted-foreground mt-1">创建多个衣橱（夏/冬/通勤等），并设置默认衣橱</p>
    </header>

    <div class="grid gap-6 lg:grid-cols-3">
      <UiCard class="lg:col-span-1">
        <div class="p-4 space-y-4">
          <div class="text-sm font-medium">新增衣橱</div>
          <div class="grid gap-2">
            <label class="text-sm text-muted-foreground">名称</label>
            <UiInput v-model="name" placeholder="例如：夏天衣橱" />
          </div>
          <div class="grid gap-2">
            <label class="text-sm text-muted-foreground">季节</label>
            <UiSelectRadix v-model="season" :options="SEASON_OPTIONS" />
          </div>
          <UiCheckbox v-model="isDefault">设为默认</UiCheckbox>
          <UiButton :disabled="creating || !name.trim()" @click="create">创建</UiButton>

          <div v-if="error" class="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {{ error }}
          </div>
        </div>
      </UiCard>

      <UiCard class="lg:col-span-2">
        <div class="p-4 space-y-4">
          <div class="flex items-center justify-between">
            <div class="text-sm font-medium">衣橱列表</div>
            <UiButton variant="outline" size="sm" :disabled="loading" @click="load">刷新</UiButton>
          </div>

          <div v-if="loading" class="text-sm text-muted-foreground">加载中...</div>
          <div v-else-if="wardrobes.length === 0" class="text-sm text-muted-foreground">暂无衣橱</div>

          <div v-else class="grid gap-2 sm:grid-cols-2">
            <div v-for="w in wardrobes" :key="w.id" class="rounded-md border p-4 space-y-2">
              <div class="flex items-center justify-between gap-3">
                <div class="font-medium truncate">{{ w.name }}</div>
                <UiBadge v-if="w.is_default" variant="secondary">默认</UiBadge>
              </div>
              <div class="text-xs text-muted-foreground">季节：{{ seasonLabel(w.season) }}</div>
              <div class="flex items-center gap-2 pt-1">
                <button
                  v-if="!w.is_default"
                  class="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  @click="setDefault(w.id)"
                >设为默认</button>
                <ConfirmDialog title="删除衣橱" description="删除后衣橱内的衣物将移出该衣橱（不会删除衣物），确认删除？" @confirm="remove(w.id)">
                  <button class="text-xs text-muted-foreground hover:text-destructive transition-colors">删除</button>
                </ConfirmDialog>
              </div>
            </div>
          </div>
        </div>
      </UiCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiCard from '@/components/ui/UiCard.vue'
import UiCheckbox from '@/components/ui/UiCheckbox.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiSelectRadix from '@/components/ui/UiSelectRadix.vue'
import { createWardrobe, deleteWardrobe, listWardrobes, patchWardrobe, type Wardrobe } from '@/lib/wardrobesApi'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'

const SEASON_OPTIONS = [
  { value: 'all_season', label: '全年' },
  { value: 'spring', label: '春' },
  { value: 'summer', label: '夏' },
  { value: 'autumn', label: '秋' },
  { value: 'winter', label: '冬' },
]
const SEASON_LABELS: Record<string, string> = {
  all_season: '全年', spring: '春', summer: '夏', autumn: '秋', winter: '冬',
}
function seasonLabel(s: string) { return SEASON_LABELS[s] || s }

const wardrobes = ref<Wardrobe[]>([])
const loading = ref(false)
const error = ref('')

const name = ref('')
const season = ref<Wardrobe['season']>('all_season')
const isDefault = ref(false)
const creating = ref(false)

async function load() {
  loading.value = true
  error.value = ''
  try {
    wardrobes.value = await listWardrobes()
  } catch (e: any) {
    error.value = e?.message || '加载失败'
  } finally {
    loading.value = false
  }
}

async function create() {
  creating.value = true
  error.value = ''
  try {
    const created = await createWardrobe({
      name: name.value.trim(),
      season: season.value,
      is_default: isDefault.value,
    })
    wardrobes.value = [created, ...wardrobes.value]
    name.value = ''
    season.value = 'all_season'
    isDefault.value = false
  } catch (e: any) {
    error.value = e?.message || '创建失败'
  } finally {
    creating.value = false
  }
}

async function setDefault(id: string) {
  error.value = ''
  try {
    await patchWardrobe(id, { is_default: true })
    wardrobes.value = wardrobes.value.map((w) => ({ ...w, is_default: w.id === id }))
  } catch (e: any) {
    error.value = e?.message || '操作失败'
  }
}

async function remove(id: string) {
  error.value = ''
  try {
    await deleteWardrobe(id)
    wardrobes.value = wardrobes.value.filter((w) => w.id !== id)
  } catch (e: any) {
    error.value = e?.message || '删除失败'
  }
}

onMounted(load)
</script>

<style scoped></style>
