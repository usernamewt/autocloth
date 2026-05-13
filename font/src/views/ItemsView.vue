<template>
  <div class="space-y-6">
    <header class="flex items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">衣物</h1>
        <p class="text-sm text-muted-foreground mt-1">管理你的衣橱单品</p>
      </div>
      <RouterLink
        to="/items/new"
        class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4"
      >
        + 录入衣服
      </RouterLink>
    </header>

    <UiCard>
      <div class="p-4">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex-1">
            <UiInput v-model="search" placeholder="搜索（名称/类型/备注）" />
          </div>
          <div class="flex items-center gap-3">
            <UiCheckbox v-model="onlyFavorites">只看收藏</UiCheckbox>
            <UiButton variant="outline" :disabled="loading" @click="load">刷新</UiButton>
          </div>
        </div>

        <div v-if="error" class="mt-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {{ error }}
        </div>

        <div v-else-if="loading && items.length === 0" class="mt-6 text-sm text-muted-foreground">
          加载中...
        </div>
        <div v-else-if="items.length === 0" class="mt-6 text-sm text-muted-foreground">
          暂无衣物，先去录入一件吧。
        </div>

        <div v-else class="mt-6 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <div
            v-for="it in items"
            :key="it.id"
            class="group relative overflow-hidden rounded-lg border bg-card hover:bg-accent/30 transition-colors"
          >
            <RouterLink :to="`/items/${it.id}`" class="block">
              <div class="relative aspect-[4/3] bg-muted overflow-hidden">
                <img
                  v-if="it.thumbnail_url || it.image_url"
                  class="h-full w-full object-cover group-hover:scale-[1.02] transition-transform"
                  :src="it.thumbnail_url || it.image_url"
                  alt=""
                />
                <div v-else class="h-full w-full flex items-center justify-center text-xs text-muted-foreground">
                  No Image
                </div>

                <div class="absolute left-3 top-3 flex items-center gap-2">
                  <UiBadge v-if="it.status !== 'ready'" variant="secondary">{{ it.status }}</UiBadge>
                </div>
              </div>

              <div class="p-3">
                <div class="flex items-center justify-between gap-3">
                  <div class="font-medium truncate">{{ it.name || it.taxonomy_type_label || it.type }}</div>
                  <span v-if="it.favorite" class="text-xs text-muted-foreground">★</span>
                </div>
                <div class="mt-1 text-xs text-muted-foreground truncate">
                  <span>{{ it.taxonomy_type_label || it.type }}</span>
                </div>
                <div v-if="it.taxonomy_color_labels?.length" class="mt-1.5 flex gap-1 flex-wrap">
                  <span
                    v-for="c in it.taxonomy_color_labels"
                    :key="c"
                    class="inline-block w-3.5 h-3.5 rounded-full border border-black/10"
                    :title="c"
                    :style="{ background: resolveColorName(c) }"
                  />
                </div>
              </div>
            </RouterLink>

            <button
              class="absolute right-2 top-2 hidden group-hover:flex items-center justify-center w-7 h-7 rounded-full bg-destructive/80 hover:bg-destructive text-white shadow transition-colors"
              :disabled="deletingId === it.id"
              title="删除"
              @click.prevent="confirmDelete(it)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            </button>
          </div>
        </div>

        <div v-if="polling" class="mt-4 text-xs text-muted-foreground">
          有单品正在处理中，列表将自动刷新...
        </div>
      </div>
    </UiCard>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { listItems, deleteItem } from '@/lib/itemsApi'
import type { Item } from '@/lib/types'
import UiButton from '@/components/ui/UiButton.vue'
import UiCard from '@/components/ui/UiCard.vue'
import UiCheckbox from '@/components/ui/UiCheckbox.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiBadge from '@/components/ui/UiBadge.vue'

const items = ref<Item[]>([])
const loading = ref(false)
const error = ref('')
const deletingId = ref('')

function resolveColorName(name: string): string {
  const s = name.toLowerCase()
  if (/白/.test(s)) return '#F3F3F3'
  if (/黑/.test(s)) return '#1F1F1F'
  if (/灰/.test(s)) return '#9CA3AF'
  if (/藏蓝|深蓝/.test(s)) return '#1E3A5F'
  if (/浅蓝/.test(s)) return '#93C5FD'
  if (/蓝/.test(s)) return '#3B82F6'
  if (/绿/.test(s)) return '#22C55E'
  if (/红/.test(s)) return '#EF4444'
  if (/粉/.test(s)) return '#F472B6'
  if (/橙/.test(s)) return '#F97316'
  if (/黄/.test(s)) return '#EAB308'
  if (/紫/.test(s)) return '#A855F7'
  if (/棕|褐/.test(s)) return '#92400E'
  if (/米|奶/.test(s)) return '#F5E6D0'
  if (/卡其|驼/.test(s)) return '#C4A472'
  if (/金/.test(s)) return '#D4AF37'
  if (/银/.test(s)) return '#B0B0B0'
  return 'conic-gradient(from 0deg,#ef4444 0%,#f97316 16%,#eab308 33%,#22c55e 50%,#3b82f6 66%,#a855f7 83%,#ef4444 100%)'
}

async function confirmDelete(it: Item) {
  if (!window.confirm(`确认删除「${it.name || it.type || '该衣物'}」？此操作不可恢复。`)) return
  deletingId.value = it.id
  try {
    await deleteItem(it.id)
    items.value = items.value.filter((i) => i.id !== it.id)
  } catch (e: any) {
    alert(e?.message || '删除失败')
  } finally {
    deletingId.value = ''
  }
}

const search = ref('')
const onlyFavorites = ref(false)

const polling = computed(() => items.value.some((i) => i.status === 'processing'))

let pollTimer: number | null = null

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await listItems({
      page: 1,
      page_size: 50,
      search: search.value.trim() || undefined,
      favorite: onlyFavorites.value ? true : undefined,
    })
    items.value = res.items
  } catch (e: any) {
    error.value = e?.message || '加载失败'
  } finally {
    loading.value = false
  }
}

function startPollingIfNeeded() {
  if (pollTimer) window.clearInterval(pollTimer)
  pollTimer = null
  if (!polling.value) return
  pollTimer = window.setInterval(() => {
    load()
  }, 5000)
}

watch([search, onlyFavorites], () => {
  load()
})

watch(polling, () => {
  startPollingIfNeeded()
})

onMounted(async () => {
  await load()
  startPollingIfNeeded()
})

onBeforeUnmount(() => {
  if (pollTimer) window.clearInterval(pollTimer)
})
</script>

<style scoped></style>
