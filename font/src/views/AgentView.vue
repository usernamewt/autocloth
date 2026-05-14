<template>
  <div class="min-h-full">
    <!-- Page header -->
    <div class="flex items-center gap-3 mb-6">
      <button
        @click="router.back()"
        class="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
      >
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 12H5M12 5l-7 7 7 7" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
      <h1 class="text-lg font-semibold flex-1 truncate">{{ agentStore.pageTitle || '智能助手' }}</h1>
      <span class="flex-shrink-0 text-xs px-2.5 py-1 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20 font-medium">
        AI 生成
      </span>
      <button
        @click="agentStore.clear()"
        class="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
        title="清除页面"
      >
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
    </div>

    <!-- Template error -->
    <div
      v-if="templateError"
      class="mb-4 px-4 py-3 rounded-xl bg-red-500/10 text-red-300 border border-red-500/20 text-sm"
    >
      模板渲染错误：{{ templateError }}
    </div>

    <!-- Dynamic component rendered from LLM template -->
    <div v-if="agentStore.template && dynamicComp" class="rounded-xl overflow-hidden">
      <component :is="dynamicComp" />
    </div>

    <!-- Empty state -->
    <div
      v-else-if="!agentStore.template"
      class="flex flex-col items-center justify-center py-28 text-center"
    >
      <div class="w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-500/15 to-fuchsia-500/15 border border-violet-500/20 flex items-center justify-center mb-5">
        <svg class="w-9 h-9 text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </div>
      <p class="text-sm font-medium text-foreground mb-1.5">万能页面</p>
      <p class="text-xs text-muted-foreground max-w-xs">
        双击 <kbd class="px-1.5 py-0.5 rounded bg-accent text-foreground text-xs font-mono">Enter</kbd> 唤醒 Agent，让 AI 为你生成专属展示页面
      </p>
    </div>

    <!-- Data loading indicator -->
    <div v-if="dataLoading" class="fixed bottom-4 right-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-card border text-xs text-muted-foreground shadow-lg">
      <svg class="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 12a9 9 0 11-6.219-8.56" stroke-linecap="round" />
      </svg>
      正在加载数据...
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAgentStore } from '@/stores/agent'
import { useAuthStore } from '@/stores/auth'
import * as itemsApi from '@/lib/itemsApi'
import * as fittingApi from '@/lib/fittingApi'
import * as wardrobesApi from '@/lib/wardrobesApi'
import * as dailyOutfitApi from '@/lib/dailyOutfitApi'
import * as taxonomyApi from '@/lib/taxonomyApi'

const agentStore = useAgentStore()
const router = useRouter()
const auth = useAuthStore()

const dataLoading = ref(false)
const templateError = ref<string | null>(null)

// Pre-fetched reactive data exposed to dynamic templates
const items = ref<any[]>([])
const fittingResults = ref<any[]>([])
const fittingPhotos = ref<any[]>([])
const wardrobes = ref<any[]>([])
const todayStatus = ref<any>(null)

onMounted(async () => {
  dataLoading.value = true
  await Promise.allSettled([
    itemsApi.listItems({ page_size: 50 }).then((r: any) => { items.value = r.items || [] }).catch(() => {}),
    fittingApi.listFittingResults().then((r) => { fittingResults.value = r }).catch(() => {}),
    fittingApi.listFittingPhotos().then((r) => { fittingPhotos.value = r }).catch(() => {}),
    wardrobesApi.listWardrobes().then((r) => { wardrobes.value = r }).catch(() => {}),
    dailyOutfitApi.getTodayStatus().then((r) => { todayStatus.value = r }).catch(() => {}),
  ])
  dataLoading.value = false
})

const navigateTo = (route: string) => router.push('/' + route)

// Dynamic data containers exposed to LLM templates
const $data = reactive<Record<string, any>>({})
const $results = reactive<Record<string, any>>({})
const $loadings = reactive<Record<string, boolean>>({})
const $errors = reactive<Record<string, string | null>>({})

async function $run(fn: () => Promise<any>, key: string) {
  $loadings[key] = true
  $errors[key] = null
  try {
    const result = await fn()
    $results[key] = result
    return result
  } catch (e: any) {
    $errors[key] = e?.message || '操作失败'
    return null
  } finally {
    $loadings[key] = false
  }
}

const dynamicComp = computed(() => {
  if (!agentStore.template) return null
  templateError.value = null
  try {
    return defineComponent({
      template: agentStore.template,
      setup() {
        return {
          // Pre-fetched reactive data
          items,
          fittingResults,
          fittingPhotos,
          wardrobes,
          todayStatus,
          auth,
          // Dynamic containers for LLM template use
          $data,
          $results,
          $loadings,
          $errors,
          $run,
          // Navigation
          router,
          navigateTo,
          // Items API
          listItems: itemsApi.listItems,
          getItem: itemsApi.getItem,
          wearItem: itemsApi.wearItem,
          patchItem: itemsApi.patchItem,
          deleteItem: itemsApi.deleteItem,
          // Fitting API
          getRecommendation: fittingApi.getRecommendation,
          generateFitting: fittingApi.generateFitting,
          listFittingResults: fittingApi.listFittingResults,
          getFittingResult: fittingApi.getFittingResult,
          deleteFittingResult: fittingApi.deleteFittingResult,
          listFittingPhotos: fittingApi.listFittingPhotos,
          // Wardrobes API
          listWardrobes: wardrobesApi.listWardrobes,
          createWardrobe: wardrobesApi.createWardrobe,
          // Daily outfit API
          getTodayStatus: dailyOutfitApi.getTodayStatus,
          getSchedule: dailyOutfitApi.getSchedule,
          // Taxonomy API
          getTaxonomyTree: taxonomyApi.getTaxonomyTree,
        }
      },
    })
  } catch (e: any) {
    templateError.value = e?.message || '模板编译失败'
    return null
  }
})
</script>
