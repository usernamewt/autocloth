<template>
  <div class="space-y-6">
    <header>
      <h1 class="text-2xl font-bold tracking-tight">穿搭推荐</h1>
      <p class="text-sm text-muted-foreground mt-1">告诉 AI 今天的天气和场合，获取个性化穿搭建议</p>
    </header>

    <!-- 条件输入 -->
    <UiCard>
      <div class="p-6 space-y-4">
        <h2 class="text-sm font-semibold">推荐条件</h2>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div class="grid gap-2">
            <label class="text-sm font-medium">日期</label>
            <UiDatePicker v-model="dateStr" />
          </div>
          <div class="grid gap-2">
            <label class="text-sm font-medium">场合</label>
            <UiSelectRadix v-model="occasion" :options="OCCASION_OPTIONS" />
          </div>
          <div class="grid gap-2">
            <label class="text-sm font-medium">天气描述（可选）</label>
            <UiInput v-model="weatherDesc" placeholder="例如：晴、25°C、微风" />
          </div>
        </div>
        <div class="flex items-center gap-3 flex-wrap">
          <UiButton :disabled="recommending" @click="doRecommend">
            {{ recommending ? 'AI 推荐中...' : '生成穿搭推荐' }}
          </UiButton>
          <span v-if="recSaved" class="text-xs text-green-600">✓ 已保存到试衣历史</span>
        </div>
        <div v-if="recError" class="text-sm text-destructive">{{ recError }}</div>
      </div>
    </UiCard>

    <!-- 推荐结果 -->
    <template v-if="recommendation">
      <UiCard>
        <div class="p-6 space-y-4">
          <div class="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 class="text-lg font-semibold">{{ recommendation.outfit_name }}</h2>
              <p class="text-sm text-muted-foreground mt-1">{{ recommendation.reasoning }}</p>
            </div>
            <UiButton variant="outline" size="sm" @click="doRecommend">换一套</UiButton>
          </div>
          <div v-if="recommendation.style_tips" class="rounded-md bg-accent/40 p-3 text-sm text-muted-foreground">
            💡 {{ recommendation.style_tips }}
          </div>

          <!-- 推荐单品 -->
          <div v-if="recommendedItems.length > 0">
            <div class="text-sm font-medium mb-3">推荐单品（{{ recommendedItems.length }} 件）</div>
            <div class="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
              <div
                v-for="it in recommendedItems"
                :key="it.id"
                class="rounded-lg border overflow-hidden cursor-pointer hover:bg-accent/30 transition-colors"
                @click="$router.push(`/items/${it.id}`)"
              >
                <div class="aspect-square bg-muted overflow-hidden">
                  <img
                    v-if="it.thumbnail_url || it.image_url"
                    class="w-full h-full object-cover"
                    :src="it.thumbnail_url || it.image_url"
                    alt=""
                  />
                  <div v-else class="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                    无图
                  </div>
                </div>
                <div class="p-2">
                  <div class="text-xs font-medium truncate">{{ it.name || it.taxonomy_type_label || it.type }}</div>
                  <div class="text-[10px] text-muted-foreground truncate">{{ it.primary_color }}</div>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="text-sm text-muted-foreground">
            暂无可用单品，请先在「衣物」页面录入衣服。
          </div>

          <!-- 试衣操作 -->
          <div class="pt-2 border-t flex flex-wrap gap-3 items-center">
            <span class="text-sm text-muted-foreground">想看穿上的效果？</span>
            <UiButton @click="goFitting">前往试衣间试穿</UiButton>
          </div>
        </div>
      </UiCard>
    </template>

    <!-- 空引导 -->
    <div v-else-if="!recommending" class="rounded-lg border border-dashed p-12 text-center">
      <div class="text-4xl mb-4">👗</div>
      <div class="text-sm font-medium mb-1">还没有穿搭推荐</div>
      <div class="text-xs text-muted-foreground mb-4">设置日期和场合，让 AI 为你搭配衣橱中的单品</div>
      <UiButton @click="doRecommend">立即生成推荐</UiButton>
    </div>

    <!-- 历史记录 -->
    <UiCard v-if="history.length > 0">
      <div class="p-6 space-y-4">
        <h2 class="text-sm font-semibold">历史推荐记录</h2>
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div
            v-for="r in history"
            :key="r.id"
            class="rounded-lg border overflow-hidden"
          >
            <div v-if="r.result_image_url" class="h-32 overflow-hidden">
              <img :src="r.result_image_url" class="w-full h-full object-cover" alt="" />
            </div>
            <div v-else class="h-20 flex flex-col items-center justify-center gap-1 bg-muted/50">
              <span class="text-xl">{{ r.status === 'generating' ? '⏳' : '👗' }}</span>
              <span class="text-[10px] text-muted-foreground">{{ r.status === 'generating' ? '合成中...' : r.status === 'error' ? '合成失败' : '穿搭推荐' }}</span>
            </div>
            <!-- 推荐衣物缩略图 -->
            <div v-if="r.item_ids && r.item_ids.length > 0" class="flex gap-1 p-2 flex-wrap">
              <div
                v-for="itemId in r.item_ids.slice(0, 5)"
                :key="itemId"
                class="w-10 h-10 rounded border overflow-hidden bg-muted flex-shrink-0"
              >
                <img
                  v-if="itemMap[itemId]?.thumbnail_url || itemMap[itemId]?.image_url"
                  :src="itemMap[itemId]?.thumbnail_url || itemMap[itemId]?.image_url"
                  class="w-full h-full object-cover"
                  alt=""
                />
                <div v-else class="w-full h-full flex items-center justify-center text-[8px] text-muted-foreground">?</div>
              </div>
              <div v-if="r.item_ids.length > 5" class="w-10 h-10 rounded border bg-muted flex-shrink-0 flex items-center justify-center text-[10px] text-muted-foreground">
                +{{ r.item_ids.length - 5 }}
              </div>
            </div>
            <div class="px-2 pb-2 space-y-0.5">
              <div v-if="r.outfit_name" class="text-xs font-medium truncate">{{ r.outfit_name }}</div>
              <div class="flex items-center gap-1.5 flex-wrap">
                <span v-if="r.occasion" class="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{{ r.occasion }}</span>
                <span v-if="r.outfit_date" class="text-[10px] text-muted-foreground">{{ r.outfit_date }}</span>
              </div>
              <div v-if="r.reasoning" class="text-[10px] text-muted-foreground line-clamp-2">{{ r.reasoning }}</div>
              <div class="text-[10px] text-muted-foreground/60 pt-0.5">{{ r.created_at ? new Date(r.created_at).toLocaleDateString('zh-CN') : '' }}</div>
            </div>
          </div>
        </div>
      </div>
    </UiCard>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '@/lib/api'
import { getRecommendation, listFittingResults, type FittingResult, type RecommendationResult } from '@/lib/fittingApi'
import UiButton from '@/components/ui/UiButton.vue'
import UiCard from '@/components/ui/UiCard.vue'
import UiDatePicker from '@/components/ui/UiDatePicker.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiSelectRadix from '@/components/ui/UiSelectRadix.vue'

const OCCASION_OPTIONS = [
  { value: '日常', label: '日常' },
  { value: '通勤', label: '通勤' },
  { value: '约会', label: '约会' },
  { value: '运动', label: '运动' },
  { value: '商务', label: '商务' },
  { value: '聚会', label: '聚会' },
]

const router = useRouter()

const dateStr = ref(new Date().toISOString().slice(0, 10))
const occasion = ref('日常')
const weatherDesc = ref('')

const recommending = ref(false)
const recError = ref('')
const recSaved = ref(false)
const recommendation = ref<RecommendationResult | null>(null)
const recommendedItems = ref<any[]>([])

async function doRecommend() {
  recommending.value = true
  recError.value = ''
  recSaved.value = false
  try {
    const weather = weatherDesc.value ? { description: weatherDesc.value } : undefined
    const result = await getRecommendation({ weather, date: dateStr.value, occasion: occasion.value })
    recommendation.value = result.recommendation
    recommendedItems.value = result.items
    recSaved.value = !!result.recommendation_id
    loadHistory()
  } catch (e: any) {
    recError.value = e?.message || '推荐失败，请确保衣橱中有衣物'
  } finally {
    recommending.value = false
  }
}

function goFitting() {
  router.push('/fitting')
}

// History
const history = ref<FittingResult[]>([])
const loadingHistory = ref(false)
const itemMap = ref<Record<string, any>>({})

async function loadHistory() {
  loadingHistory.value = true
  try {
    const [results, itemsRes] = await Promise.all([
      listFittingResults(),
      api.get<{ items: any[] }>('/items?page=1&page_size=200'),
    ])
    history.value = results
    const map: Record<string, any> = {}
    for (const it of (itemsRes.items || [])) map[it.id] = it
    itemMap.value = map
  } catch { /* ignore */ } finally {
    loadingHistory.value = false
  }
}

onMounted(loadHistory)
</script>

<style scoped></style>
