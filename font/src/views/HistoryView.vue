<template>
  <div class="space-y-6">
    <header class="flex items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">历史试衣</h1>
        <p class="text-sm text-muted-foreground mt-1">查看所有试衣记录，包含预处理图和最终效果</p>
      </div>
      <UiButton variant="outline" size="sm" :disabled="loading" @click="load">刷新</UiButton>
    </header>

    <!-- AI 穿搭闹钟今日结果 banner -->
    <div
      v-if="todayBanner"
      class="flex items-center gap-3 rounded-lg border bg-primary/10 border-primary/20 px-4 py-3"
    >
      <span class="text-xl">{{ todayBanner.status === 'ready' ? '✨' : '⏳' }}</span>
      <div class="flex-1 min-w-0">
        <div class="text-xs text-muted-foreground font-medium">穿搭闹钟 · 今日已备好</div>
        <div class="text-sm font-semibold truncate">{{ todayBanner.outfitName }}</div>
      </div>
      <RouterLink
        v-if="todayBanner.resultId"
        to="/history"
        class="text-xs text-primary font-medium hover:underline shrink-0"
      >查看 →</RouterLink>
    </div>

    <div v-if="loading" class="text-sm text-muted-foreground">加载中...</div>
    <div v-else-if="error" class="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{{ error }}</div>

    <div v-else-if="results.length === 0" class="rounded-lg border border-dashed p-12 text-center">
      <div class="text-4xl mb-4">🪞</div>
      <div class="text-sm font-medium mb-1">暂无试衣记录</div>
      <div class="text-xs text-muted-foreground mb-4">前往试衣间，选择形象照和衣物来生成试衣效果</div>
      <UiButton @click="$router.push('/fitting')">前往试衣间</UiButton>
    </div>

    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <UiCard v-for="r in results" :key="r.id">
        <div class="p-4 space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-xs text-muted-foreground">{{ formatTime(r.created_at) }}</span>
            <span
              class="text-xs px-2 py-0.5 rounded-full border"
              :class="{
                'border-green-400 text-green-700 bg-green-50': r.status === 'ready',
                'border-yellow-400 text-yellow-700 bg-yellow-50': r.status === 'generating',
                'border-destructive/40 text-destructive bg-destructive/10': r.status === 'error',
              }"
            >{{ statusLabel(r.status) }}</span>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div class="space-y-1">
              <div class="text-[10px] text-muted-foreground font-medium">预处理合成图</div>
              <ImageLightbox v-if="r.preprocessed_image_url" :src="r.preprocessed_image_url" alt="预处理图">
                <img :src="r.preprocessed_image_url" class="w-full h-28 object-cover rounded border cursor-zoom-in" alt="" />
              </ImageLightbox>
              <div v-else class="h-28 rounded border bg-muted flex items-center justify-center text-xs text-muted-foreground">无</div>
            </div>
            <div class="space-y-1">
              <div class="text-[10px] text-muted-foreground font-medium">最终试衣效果</div>
              <ImageLightbox v-if="r.result_image_url" :src="r.result_image_url" alt="试衣效果">
                <img :src="r.result_image_url" class="w-full h-28 object-cover rounded border cursor-zoom-in" alt="" />
              </ImageLightbox>
              <div v-else class="h-28 rounded border bg-muted flex items-center justify-center text-xs text-muted-foreground">
                {{ r.status === 'generating' ? '生成中...' : r.status === 'error' ? '失败' : '无' }}
              </div>
            </div>
          </div>

          <div v-if="r.error_message" class="text-xs text-destructive truncate">{{ r.error_message }}</div>

          <div class="flex justify-end">
            <ConfirmDialog title="删除记录" description="确定删除这条试衣记录吗？" @confirm="remove(r.id)">
              <button class="text-xs text-muted-foreground hover:text-destructive transition-colors">删除</button>
            </ConfirmDialog>
          </div>
        </div>
      </UiCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { RouterLink } from 'vue-router'
import { listFittingResults, deleteFittingResult, type FittingResult } from '@/lib/fittingApi'
import { getTodayStatus, markSeen } from '@/lib/dailyOutfitApi'
import UiButton from '@/components/ui/UiButton.vue'
import UiCard from '@/components/ui/UiCard.vue'
import ImageLightbox from '@/components/ui/ImageLightbox.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'

const router = useRouter()
const results = ref<FittingResult[]>([])
const loading = ref(false)
const error = ref('')

const todayBanner = ref<{ outfitName: string; resultId: string | null; status: string | null } | null>(null)

async function checkTodayBanner() {
  try {
    const res = await getTodayStatus()
    if (res.has_today_result) {
      todayBanner.value = {
        outfitName: res.today_outfit_name || '今日穿搭已备好',
        resultId: res.today_result_id,
        status: res.today_result_status,
      }
    }
    if (res.notification_pending) {
      await markSeen()
    }
  } catch { /* ignore */ }
}

function statusLabel(s: string) {
  return s === 'ready' ? '完成' : s === 'generating' ? '生成中' : s === 'error' ? '失败' : s
}

function formatTime(ts: string) {
  if (!ts) return ''
  const d = new Date(ts)
  return d.toLocaleDateString('zh-CN') + ' ' + d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    results.value = await listFittingResults()
  } catch (e: any) {
    error.value = e?.message || '加载失败'
  } finally {
    loading.value = false
  }
}

async function remove(id: string) {
  try {
    await deleteFittingResult(id)
    results.value = results.value.filter((r) => r.id !== id)
  } catch (e: any) {
    error.value = e?.message || '删除失败'
  }
}

onMounted(() => {
  load()
  checkTodayBanner()
})
</script>

<style scoped></style>
