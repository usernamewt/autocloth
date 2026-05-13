<template>
  <div class="space-y-6">
    <header class="flex items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">我的收藏</h1>
        <p class="text-sm text-muted-foreground mt-1">所有标记了收藏的衣物单品</p>
      </div>
      <UiButton variant="outline" size="sm" :disabled="loading" @click="load">刷新</UiButton>
    </header>

    <div v-if="loading" class="text-sm text-muted-foreground">加载中...</div>
    <div v-else-if="error" class="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{{ error }}</div>

    <div v-else-if="items.length === 0" class="rounded-lg border border-dashed p-12 text-center">
      <div class="text-4xl mb-4">⭐</div>
      <div class="text-sm font-medium mb-1">暂无收藏</div>
      <div class="text-xs text-muted-foreground mb-4">在衣物详情页点击「☆ 收藏」即可收藏单品</div>
      <UiButton @click="$router.push('/items')">浏览衣物</UiButton>
    </div>

    <div v-else class="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      <RouterLink
        v-for="it in items"
        :key="it.id"
        :to="`/items/${it.id}`"
        class="group rounded-lg border overflow-hidden hover:bg-accent/30 transition-colors"
      >
        <div class="aspect-square bg-muted overflow-hidden relative">
          <img
            v-if="it.thumbnail_url || it.image_url"
            class="w-full h-full object-cover group-hover:scale-[1.02] transition-transform"
            :src="it.thumbnail_url || it.image_url"
            alt=""
          />
          <div v-else class="w-full h-full flex items-center justify-center text-xs text-muted-foreground">无图</div>
          <span class="absolute top-2 right-2 text-yellow-400 text-sm">★</span>
        </div>
        <div class="p-2">
          <div class="text-xs font-medium truncate">{{ it.name || it.type }}</div>
          <div class="text-[10px] text-muted-foreground">
            <span>{{ it.type }}</span>
            <span v-if="it.primary_color"> · {{ it.primary_color }}</span>
          </div>
        </div>
      </RouterLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { listItems } from '@/lib/itemsApi'
import type { Item } from '@/lib/types'
import UiButton from '@/components/ui/UiButton.vue'

const items = ref<Item[]>([])
const loading = ref(false)
const error = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await listItems({ favorite: true, page_size: 100 })
    items.value = res.items
  } catch (e: any) {
    error.value = e?.message || '加载失败'
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped></style>
