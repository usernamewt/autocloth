<template>
  <div class="space-y-6">
    <header>
      <h1 class="text-2xl font-bold tracking-tight">试衣间</h1>
      <p class="text-sm text-muted-foreground mt-1">上传形象照 → AI 推荐穿搭 → 图生图合成试衣效果</p>
    </header>

    <div
      v-if="msg"
      class="rounded-md border p-3 text-sm"
      :class="msgType === 'error' ? 'border-destructive/30 bg-destructive/10 text-destructive' : 'border-green-300 bg-green-50 text-green-700'"
    >
      {{ msg }}
    </div>

    <div class="grid gap-6 lg:grid-cols-3">
      <!-- 左栏：形象照管理 -->
      <UiCard class="lg:col-span-1">
        <div class="p-4 space-y-4">
          <h2 class="text-sm font-semibold">我的形象照</h2>

          <div class="space-y-2">
            <div class="flex gap-2">
              <UiSelectRadix
                v-model="uploadType"
                class="flex-1"
                :options="photoTypeOptions"
                placeholder="选择类型"
              />
              <label class="inline-flex items-center px-3 py-1.5 text-sm rounded-md border bg-background hover:bg-accent cursor-pointer transition-colors text-nowrap">
                上传照片
                <input type="file" accept="image/*" class="hidden" @change="handleUpload" />
              </label>
            </div>
            <div v-if="uploading" class="text-xs text-muted-foreground">上传中...</div>
          </div>

          <div v-if="photos.length === 0" class="text-xs text-muted-foreground py-4 text-center">
            还没有形象照，请先上传
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div
              v-for="photo in photos"
              :key="photo.id"
              class="relative rounded-lg border overflow-hidden cursor-pointer group"
              :class="selectedPhotoId === photo.id ? 'ring-2 ring-primary' : ''"
              @click="selectedPhotoId = photo.id"
            >
              <ImageLightbox :src="photo.image_url || ''" alt="形象照">
                <img
                  :src="photo.image_url || undefined"
                  class="w-full h-28 object-cover"
                  alt=""
                  @click.stop
                />
              </ImageLightbox>
              <div class="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors pointer-events-none" />
              <span class="absolute bottom-1 left-1 text-[10px] bg-black/60 text-white px-1 rounded">
                {{ photo.photo_type === 'full_body' ? '全身' : '半身' }}
              </span>
              <ConfirmDialog
                title="删除形象照"
                description="删除后无法恢复，确定要删除这张形象照吗？"
                @confirm="removePhoto(photo.id)"
              >
                <button
                  class="absolute top-1 right-1 bg-black/60 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  @click.stop
                >×</button>
              </ConfirmDialog>
            </div>
          </div>
        </div>
      </UiCard>

      <!-- 右栏：推荐 + 生成 -->
      <div class="lg:col-span-2 space-y-6">
        <!-- 推荐参数 -->
        <UiCard>
          <div class="p-4 space-y-4">
            <h2 class="text-sm font-semibold">穿搭推荐</h2>
            <div class="grid gap-3 sm:grid-cols-3">
              <div class="space-y-1.5">
                <label class="text-xs font-medium text-muted-foreground">场景</label>
                <UiSelectRadix
                  v-model="occasion"
                  :options="occasionOptions"
                  placeholder="选择场景"
                />
              </div>
              <div class="space-y-1.5">
                <label class="text-xs font-medium text-muted-foreground">天气（描述）</label>
                <UiInput v-model="weatherDesc" placeholder="如：晴天 28°C" />
              </div>
              <div class="space-y-1.5">
                <label class="text-xs font-medium text-muted-foreground">日期</label>
                <UiDatePicker v-model="dateStr" />
              </div>
            </div>
            <UiButton :disabled="recommending" @click="doRecommend">
              {{ recommending ? 'AI 思考中...' : '今日穿搭推荐' }}
            </UiButton>
          </div>
        </UiCard>

        <!-- 手动选衣 -->
        <UiCard>
          <div class="p-4 space-y-4">
            <div class="flex items-center justify-between gap-3">
              <div class="flex items-center gap-2 min-w-0">
                <h2 class="text-sm font-semibold">选择衣物</h2>
                <span class="text-xs text-muted-foreground text-nowrap">
                  已选 {{ selectedItemIds.size }} 件衣物
                </span>
              </div>
              <UiButton
                size="sm"
                class="shrink-0"
                :disabled="!selectedPhotoId || selectedItemIds.size === 0 || generating"
                @click="doGenerateManual"
              >
                {{ generating ? '合成中...' : '合成试衣效果' }}
              </UiButton>
            </div>

            <div v-if="loadingItems" class="text-xs text-muted-foreground">加载衣物中...</div>
            <div v-else-if="allItems.length === 0" class="text-xs text-muted-foreground">衣橱中没有已就绪的衣物</div>
            <div v-else class="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6">
              <div
                v-for="item in allItems"
                :key="item.id"
                class="rounded-lg border overflow-hidden cursor-pointer transition-all"
                :class="selectedItemIds.has(item.id) ? 'border-primary shadow-sm' : 'opacity-60 hover:opacity-100'"
                @click="toggleItem(item.id)"
              >
                <ImageLightbox :src="item.image_url || item.thumbnail_url || ''" :alt="item.name || item.taxonomy_type_label || item.type">
                  <img
                    v-if="item.image_url || item.thumbnail_url"
                    :src="item.thumbnail_url || item.image_url"
                    class="w-full h-24 object-cover"
                    alt=""
                    @click.stop
                  />
                </ImageLightbox>
                <div class="px-1.5 py-1">
                  <div class="text-[10px] font-medium truncate">{{ item.name || item.taxonomy_type_label || item.type }}</div>
                  <div class="text-[10px] text-muted-foreground">{{ item.primary_color }}</div>
                </div>
              </div>
            </div>

            <div v-if="!selectedPhotoId" class="text-xs text-destructive">
              ← 请先在左侧选择一张形象照
            </div>
          </div>
        </UiCard>

        <!-- 推荐结果 -->
        <UiCard v-if="recommendation">
          <div class="p-4 space-y-4">
            <div class="flex items-center justify-between">
              <h2 class="text-sm font-semibold">{{ recommendation.outfit_name }}</h2>
              <UiButton
                size="sm"
                :disabled="!selectedPhotoId || generating"
                @click="doGenerate"
              >
                {{ generating ? '合成中...' : '👗 合成试衣效果' }}
              </UiButton>
            </div>
            <p class="text-sm text-muted-foreground">{{ recommendation.reasoning }}</p>
            <p class="text-xs text-muted-foreground">💡 {{ recommendation.style_tips }}</p>

            <div class="flex flex-wrap gap-3">
              <div
                v-for="item in recommendedItems"
                :key="item.id"
                class="rounded-lg border overflow-hidden w-24"
              >
                <ImageLightbox :src="item.image_url || item.thumbnail_url || ''" :alt="item.name || item.taxonomy_type_label || item.type">
                  <img
                    v-if="item.image_url || item.thumbnail_url"
                    :src="item.thumbnail_url || item.image_url"
                    class="w-full h-24 object-cover"
                    alt=""
                  />
                </ImageLightbox>
                <div class="px-1.5 py-1">
                  <div class="text-[10px] font-medium truncate">{{ item.name || item.taxonomy_type_label || item.type }}</div>
                  <div class="text-[10px] text-muted-foreground">{{ item.primary_color }}</div>
                </div>
              </div>
            </div>

            <div v-if="!selectedPhotoId" class="text-xs text-destructive">
              ← 请先在左侧选择一张形象照
            </div>
          </div>
        </UiCard>

        <!-- 合成结果 -->
        <UiCard v-if="generatingResultId">
          <div class="p-4 space-y-4">
            <h2 class="text-sm font-semibold">试衣效果</h2>

            <div v-if="generateStatus === 'generating'" class="flex items-center gap-2 text-sm text-muted-foreground">
              <svg class="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" class="opacity-25" /><path d="M4 12a8 8 0 018-8" stroke="currentColor" stroke-width="4" stroke-linecap="round" class="opacity-75" /></svg>
              正在合成中，请稍候（通常需要 30~120 秒）...
            </div>

            <div v-if="preprocessedImageUrl" class="space-y-2">
              <div class="text-xs font-medium text-muted-foreground">Sharp 预处理图片</div>
              <ImageLightbox :src="preprocessedImageUrl" alt="Sharp 预处理图片">
                <img :src="preprocessedImageUrl" class="w-full max-h-80 object-contain rounded-lg border bg-muted cursor-zoom-in" alt="Sharp 预处理图片" />
              </ImageLightbox>
            </div>

            <div v-if="generateStatus === 'ready' && resultImageUrl" class="space-y-3">
              <ImageLightbox :src="resultImageUrl" alt="试衣效果">
                <img :src="resultImageUrl" class="w-full max-h-[600px] object-contain rounded-lg border cursor-zoom-in hover:shadow-lg transition-shadow" alt="试衣效果" />
              </ImageLightbox>
              <p class="text-xs text-muted-foreground">合成完成 ✓ · 点击图片查看大图</p>
            </div>

            <div v-else-if="generateStatus === 'error'" class="text-sm text-destructive">
              合成失败：{{ generateError }}
            </div>
          </div>
        </UiCard>

        <!-- <UiCard>
          <div class="p-4 space-y-4">
            <h2 class="text-sm font-semibold">下载连通性测试</h2>
            <div class="grid gap-3 sm:grid-cols-3">
              <div class="sm:col-span-2 space-y-1.5">
                <label class="text-xs font-medium text-muted-foreground">测试 URL</label>
                <UiInput v-model="debugUrl" placeholder="请输入图片 URL" />
              </div>
              <div class="space-y-1.5">
                <label class="text-xs font-medium text-muted-foreground">操作</label>
                <UiButton class="w-full" :disabled="debugLoading" @click="doDebugDownload">
                  {{ debugLoading ? '测试中...' : '一键测试下载' }}
                </UiButton>
              </div>
            </div>

            <div v-if="debugResult" class="text-xs rounded-md border bg-muted/30 p-3 whitespace-pre-wrap">
              {{ debugResult }}
            </div>
          </div>
        </UiCard> -->

        <!-- 历史结果 -->
        <UiCard v-if="history.length > 0">
          <div class="p-4 space-y-4">
            <h2 class="text-sm font-semibold">历史试衣记录</h2>
            <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div
                v-for="r in history"
                :key="r.id"
                class="rounded-lg border overflow-hidden group relative"
              >
                <ImageLightbox v-if="r.result_image_url" :src="r.result_image_url" alt="试衣结果">
                  <img
                    :src="r.result_image_url"
                    class="w-full h-40 object-cover cursor-zoom-in"
                    alt=""
                  />
                </ImageLightbox>
                <div v-else-if="r.status === 'pending' && !r.photo_id" class="h-28 flex flex-col items-center justify-center gap-1 bg-muted/50 px-3">
                  <span class="text-lg">👗</span>
                  <span class="text-[10px] text-muted-foreground text-center">穿搭推荐</span>
                </div>
                <div v-else class="h-40 flex items-center justify-center text-xs text-muted-foreground bg-muted">
                  {{ r.status === 'generating' ? '生成中...' : r.status === 'error' ? '失败' : '无图片' }}
                </div>
                <!-- 推荐衣物缩略图 -->
                <div v-if="r.item_ids && r.item_ids.length > 0" class="flex gap-1 px-2 pt-2 flex-wrap">
                  <div
                    v-for="itemId in r.item_ids.slice(0, 5)"
                    :key="itemId"
                    class="w-9 h-9 rounded border overflow-hidden bg-muted flex-shrink-0"
                  >
                    <img
                      v-if="itemMap[itemId]?.thumbnail_url || itemMap[itemId]?.image_url"
                      :src="itemMap[itemId]?.thumbnail_url || itemMap[itemId]?.image_url"
                      class="w-full h-full object-cover"
                      alt=""
                    />
                    <div v-else class="w-full h-full flex items-center justify-center text-[8px] text-muted-foreground">?</div>
                  </div>
                  <div v-if="r.item_ids.length > 5" class="w-9 h-9 rounded border bg-muted flex-shrink-0 flex items-center justify-center text-[10px] text-muted-foreground">
                    +{{ r.item_ids.length - 5 }}
                  </div>
                </div>
                <div class="px-2 py-1.5 space-y-0.5">
                  <div v-if="r.outfit_name" class="text-xs font-medium truncate">{{ r.outfit_name }}</div>
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <span v-if="r.occasion" class="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{{ r.occasion }}</span>
                    <span v-if="r.outfit_date" class="text-[10px] text-muted-foreground">{{ r.outfit_date }}</span>
                  </div>
                  <div v-if="r.reasoning" class="text-[10px] text-muted-foreground line-clamp-2 leading-relaxed">{{ r.reasoning }}</div>
                  <div v-if="r.style_tips" class="text-[10px] text-muted-foreground/70 line-clamp-1 italic">💡 {{ r.style_tips }}</div>
                  <div class="flex items-center justify-between pt-0.5">
                    <div class="text-[10px] text-muted-foreground">{{ formatTime(r.created_at) }}</div>
                    <ConfirmDialog
                      title="删除试衣记录"
                      description="删除后无法恢复，确定要删除这条试衣记录吗？"
                      @confirm="removeResult(r.id)"
                    >
                      <button
                        class="text-[10px] text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                        @click.stop
                      >删除</button>
                    </ConfirmDialog>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </UiCard>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiCard from '@/components/ui/UiCard.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiSelectRadix from '@/components/ui/UiSelectRadix.vue'
import UiDatePicker from '@/components/ui/UiDatePicker.vue'
import ImageLightbox from '@/components/ui/ImageLightbox.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import { api } from '@/lib/api'
import {
  deleteFittingPhoto,
  deleteFittingResult,
  debugDownloadFittingImage,
  generateFitting,
  getFittingResult,
  getRecommendation,
  listFittingPhotos,
  listFittingResults,
  subscribeFittingResult,
  uploadFittingResultImage,
  uploadFittingPhoto,
  type FittingPhoto,
  type FittingResult,
  type RecommendationResult,
} from '@/lib/fittingApi'

// Options
const photoTypeOptions = [
  { value: 'full_body', label: '全身照' },
  { value: 'half_body', label: '半身照' },
]
const occasionOptions = [
  { value: '日常', label: '日常' },
  { value: '通勤', label: '通勤' },
  { value: '约会', label: '约会' },
  { value: '运动', label: '运动' },
  { value: '宴会', label: '宴会' },
  { value: '旅游', label: '旅游' },
]

// Message
const msg = ref('')
const msgType = ref<'success' | 'error'>('success')

const debugUrl = ref('https://file1.aitohumanize.com/file/c990d01248ca46d5af51f7c69f4f9782.png')
const debugLoading = ref(false)
const debugResult = ref('')

async function doDebugDownload() {
  debugLoading.value = true
  debugResult.value = ''
  try {
    const r = await debugDownloadFittingImage(debugUrl.value)
    debugResult.value = JSON.stringify(r, null, 2)
  } catch (e: any) {
    debugResult.value = e?.message || '测试失败'
  } finally {
    debugLoading.value = false
  }
}

function showMsg(text: string, type: 'success' | 'error' = 'success') {
  msg.value = text
  msgType.value = type
  if (type === 'success') setTimeout(() => { msg.value = '' }, 5000)
}

function formatTime(s?: string) {
  if (!s) return ''
  const d = new Date(s)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// Photos
const photos = ref<FittingPhoto[]>([])
const selectedPhotoId = ref('')
const uploading = ref(false)
const uploadType = ref('full_body')

async function loadPhotos() {
  try {
    photos.value = await listFittingPhotos()
    if (!selectedPhotoId.value && photos.value.length > 0) {
      selectedPhotoId.value = photos.value[0].id
    }
  } catch { /* ignore */ }
}

async function handleUpload(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  uploading.value = true
  try {
    const photo = await uploadFittingPhoto(file, uploadType.value as 'full_body' | 'half_body')
    photos.value.unshift(photo)
    selectedPhotoId.value = photo.id
    showMsg('形象照上传成功')
  } catch (err: any) {
    showMsg(err?.message || '上传失败', 'error')
  } finally {
    uploading.value = false
    input.value = ''
  }
}

async function removePhoto(id: string) {
  try {
    await deleteFittingPhoto(id)
    photos.value = photos.value.filter((p) => p.id !== id)
    if (selectedPhotoId.value === id) {
      selectedPhotoId.value = photos.value[0]?.id || ''
    }
    showMsg('形象照已删除')
  } catch (err: any) {
    showMsg(err?.message || '删除失败', 'error')
  }
}

// All items (manual selection)
const allItems = ref<any[]>([])
const loadingItems = ref(false)
const selectedItemIds = reactive(new Set<string>())

const itemMap = computed(() => {
  const m: Record<string, any> = {}
  for (const it of allItems.value) m[it.id] = it
  return m
})

async function loadItems() {
  loadingItems.value = true
  try {
    const res = await api.get<{ items: any[] }>('/items')
    allItems.value = (res.items || []).filter((i: any) => i.status === 'ready')
  } catch { /* ignore */ }
  loadingItems.value = false
}

function toggleItem(id: string) {
  if (selectedItemIds.has(id)) selectedItemIds.delete(id)
  else selectedItemIds.add(id)
}

async function doGenerateManual() {
  if (!selectedPhotoId.value || selectedItemIds.size === 0) return
  generating.value = true
  generateStatus.value = 'generating'
  preprocessedImageUrl.value = ''
  resultImageUrl.value = ''
  generateError.value = ''
  msg.value = ''

  try {
    const result = await generateFitting({
      photo_id: selectedPhotoId.value,
      item_ids: Array.from(selectedItemIds),
      occasion: occasion.value || undefined,
      outfit_date: dateStr.value || undefined,
      weather: weatherDesc.value ? { description: weatherDesc.value } : undefined,
    })
    generatingResultId.value = result.id
    generating.value = false
    loadHistory()

    closeSse?.()
    closeSse = subscribeFittingResult(result.id, {
      onReady: (data) => {
        generateStatus.value = 'ready'
        preprocessedImageUrl.value = data.preprocessed_image_url || ''
        resultImageUrl.value = data.result_image_url
        ensureFittingResultLocal(result.id, data.result_image_url)
        loadHistory()
      },
      onError: (errMsg, data) => {
        generateStatus.value = 'error'
        preprocessedImageUrl.value = data?.preprocessed_image_url || preprocessedImageUrl.value
        generateError.value = errMsg
        loadHistory()
      },
    })
    startPolling(result.id)
  } catch (err: any) {
    generating.value = false
    showMsg(err?.message || '生成失败', 'error')
  }
}

// Recommendation
const occasion = ref('日常')
const weatherDesc = ref('')
const dateStr = ref(new Date().toISOString().slice(0, 10))
const recommending = ref(false)
const recommendation = ref<RecommendationResult | null>(null)
const recommendedItems = ref<any[]>([])
const recommendationId = ref<string>('')

async function doRecommend() {
  recommending.value = true
  recommendation.value = null
  recommendedItems.value = []
  recommendationId.value = ''
  msg.value = ''
  try {
    const weather = weatherDesc.value ? { description: weatherDesc.value } : undefined
    const result = await getRecommendation({
      weather,
      date: dateStr.value,
      occasion: occasion.value,
    })
    recommendation.value = result.recommendation
    recommendedItems.value = result.items
    recommendationId.value = result.recommendation_id || ''
    loadHistory()
  } catch (err: any) {
    showMsg(err?.message || '推荐失败', 'error')
  } finally {
    recommending.value = false
  }
}

// Generate
const generating = ref(false)
const generatingResultId = ref('')
const generateStatus = ref<'generating' | 'ready' | 'error'>('generating')
const preprocessedImageUrl = ref('')
const resultImageUrl = ref('')
const generateError = ref('')
let closeSse: (() => void) | null = null

const reuploadingResultId = ref('')

function isExternalUrl(url: string) {
  return /^https?:\/\//i.test(url)
}

async function ensureFittingResultLocal(resultId: string, url: string) {
  if (!url || !isExternalUrl(url)) return
  if (reuploadingResultId.value === resultId) return
  reuploadingResultId.value = resultId
  try {
    const resp = await fetch(url)
    if (!resp.ok) throw new Error(`下载图片失败: ${resp.status}`)
    const blob = await resp.blob()
    const updated = await uploadFittingResultImage(resultId, blob, 'result.png')
    if (updated.result_image_url) resultImageUrl.value = updated.result_image_url
    await loadHistory()
  } catch (e: any) {
    showMsg(e?.message || '保存到本地失败', 'error')
  } finally {
    if (reuploadingResultId.value === resultId) reuploadingResultId.value = ''
  }
}

async function doGenerate() {
  if (!selectedPhotoId.value || !recommendation.value) return
  generating.value = true
  generateStatus.value = 'generating'
  preprocessedImageUrl.value = ''
  resultImageUrl.value = ''
  generateError.value = ''
  msg.value = ''

  try {
    const result = await generateFitting({
      photo_id: selectedPhotoId.value,
      item_ids: recommendation.value.item_ids,
      prompt: recommendation.value.prompt,
      outfit_name: recommendation.value.outfit_name,
      reasoning: recommendation.value.reasoning,
      style_tips: recommendation.value.style_tips,
      occasion: occasion.value || undefined,
      outfit_date: dateStr.value || undefined,
      weather: weatherDesc.value ? { description: weatherDesc.value } : undefined,
    })
    generatingResultId.value = result.id
    generating.value = false
    loadHistory()

    closeSse?.()
    closeSse = subscribeFittingResult(result.id, {
      onReady: (data) => {
        generateStatus.value = 'ready'
        preprocessedImageUrl.value = data.preprocessed_image_url || ''
        resultImageUrl.value = data.result_image_url
        ensureFittingResultLocal(result.id, data.result_image_url)
        loadHistory()
      },
      onError: (errMsg, data) => {
        generateStatus.value = 'error'
        preprocessedImageUrl.value = data?.preprocessed_image_url || preprocessedImageUrl.value
        generateError.value = errMsg
        loadHistory()
      },
    })

    startPolling(result.id)
  } catch (err: any) {
    generating.value = false
    showMsg(err?.message || '生成失败', 'error')
  }
}

let pollTimer: ReturnType<typeof setInterval> | null = null

function startPolling(resultId: string) {
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = setInterval(async () => {
    if (generateStatus.value !== 'generating') {
      if (pollTimer) clearInterval(pollTimer)
      return
    }
    try {
      const r = await getFittingResult(resultId)
      preprocessedImageUrl.value = r.preprocessed_image_url || preprocessedImageUrl.value
      if (r.status === 'ready') {
        generateStatus.value = 'ready'
        resultImageUrl.value = r.result_image_url || ''
        if (r.result_image_url) ensureFittingResultLocal(resultId, r.result_image_url)
        closeSse?.()
        if (pollTimer) clearInterval(pollTimer)
        loadHistory()
      } else if (r.status === 'error') {
        generateStatus.value = 'error'
        generateError.value = r.error_message || '未知错误'
        closeSse?.()
        if (pollTimer) clearInterval(pollTimer)
        loadHistory()
      }
    } catch { /* ignore */ }
  }, 5000)
}

// History
const history = ref<FittingResult[]>([])

async function loadHistory() {
  try {
    history.value = await listFittingResults()
  } catch { /* ignore */ }
}

async function removeResult(id: string) {
  try {
    await deleteFittingResult(id)
    history.value = history.value.filter((r) => r.id !== id)
    showMsg('试衣记录已删除')
  } catch (err: any) {
    showMsg(err?.message || '删除失败', 'error')
  }
}

onMounted(async () => {
  await Promise.all([loadPhotos(), loadHistory(), loadItems()])
})
</script>

<style scoped></style>
