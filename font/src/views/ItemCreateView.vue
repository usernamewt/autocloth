<template>
  <div class="space-y-6 max-w-3xl">
    <header>
      <h1 class="text-2xl font-bold tracking-tight">录入衣服</h1>
      <p class="text-sm text-muted-foreground mt-1">上传单件衣服图片，后端会自动抠图并替换纯色背景</p>
    </header>

    <UiCard>
      <div class="p-6 space-y-6">
        <div class="grid gap-2">
          <label class="text-sm font-medium">图片 <span class="text-destructive">*</span></label>
          <div class="flex items-center gap-3">
            <input
              type="file"
              accept="image/*"
              :disabled="loading"
              class="block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-secondary file:px-4 file:py-2 file:text-sm file:font-medium file:text-secondary-foreground hover:file:bg-secondary/80"
              @change="onFile"
            />
          </div>
          <div v-if="fileName" class="text-xs text-muted-foreground">已选择：{{ fileName }}</div>
          <div v-if="previewUrl" class="rounded-lg border bg-muted overflow-hidden">
            <img :src="previewUrl" class="w-full max-h-[420px] object-contain" alt="preview" />
          </div>
        </div>

        <div class="grid gap-2">
          <label class="text-sm font-medium">部位 <span class="text-destructive">*</span></label>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="p in PARTS"
              :key="p.value"
              type="button"
              :disabled="loading"
              :class="[
                'px-3 py-1.5 rounded-full text-sm font-medium border transition-colors',
                part === p.value
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground border-border hover:border-primary/60',
              ]"
              @click="selectPart(p.value)"
            >{{ p.label }}</button>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div class="grid gap-2">
            <label class="text-sm font-medium">名称（可选）</label>
            <UiInput v-model="name" :disabled="loading" placeholder="例如：白色衬衫" />
          </div>
          <div class="grid gap-2">
            <label class="text-sm font-medium">类型（可选）</label>
            <UiInput v-model="type" :disabled="loading" placeholder="例如：shirt" />
          </div>
        </div>

        <div class="grid gap-2">
          <label class="text-sm font-medium">默认提示词（prompt）</label>
          <UiTextarea v-model="prompt" :disabled="loading" />
          <div class="text-xs text-muted-foreground">
            不填写也会使用默认 prompt（用于抠出单件衣服并替换电商纯色背景）
          </div>
        </div>

        <UiButton :disabled="loading || processing || classifying || !file" @click="submit">
          {{ loading ? '上传中...' : processing ? '处理中...' : classifying ? 'AI 分类中...' : '开始录入' }}
        </UiButton>

        <div
          v-if="processing"
          class="rounded-md border bg-accent/40 p-3 text-sm text-muted-foreground flex items-center gap-2"
        >
          <svg class="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" class="opacity-25" /><path d="M4 12a8 8 0 018-8" stroke="currentColor" stroke-width="4" stroke-linecap="round" class="opacity-75" /></svg>
          AI 正在抠图 & 替换背景，处理完成后会自动跳转…
        </div>

        <div
          v-if="classifying"
          class="rounded-md border bg-accent/40 p-3 text-sm text-muted-foreground flex items-center gap-2"
        >
          <svg class="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" class="opacity-25" /><path d="M4 12a8 8 0 018-8" stroke="currentColor" stroke-width="4" stroke-linecap="round" class="opacity-75" /></svg>
          AI 正在识别衣服分类，稍后自动跳转…
        </div>

        <div
          v-if="classifyWarning"
          class="rounded-md border border-yellow-400/40 bg-yellow-50/60 p-3 text-sm text-yellow-700"
        >
          AI 自动分类未完成（{{ classifyWarning }}），已跳过，可手动添加分类。
        </div>

        <div
          v-if="error"
          class="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {{ error }}
        </div>
      </div>
    </UiCard>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { useRouter } from 'vue-router'
import { createItem, subscribeItemStatus } from '@/lib/itemsApi'
import { autoClassifyItem } from '@/lib/taxonomyApi'
import UiButton from '@/components/ui/UiButton.vue'
import UiCard from '@/components/ui/UiCard.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiTextarea from '@/components/ui/UiTextarea.vue'

const router = useRouter()

const PARTS = [
  { value: 'top',   label: '上衣' },
  { value: 'pants', label: '裤子' },
  { value: 'hat',   label: '帽子' },
  { value: 'bag',   label: '包' },
  { value: 'shoes', label: '鞋子' },
  { value: 'scarf', label: '围巾' },
]

const PART_PROMPTS: Record<string, string> = {
  top:   '请从图片中只保留单件上衣本体，完整呈现出衣服轮廓（包含袖子、领口、下摆等），移除人物、皮肤、头发、手、背景、衣架、地面、阴影杂物与文字水印。\n将衣服居中摆放，保持真实颜色与材质纹理，不要改变款式、不增加配饰。\n背景替换为干净的纯色背景（浅灰/米白，接近 #F7F7F7），允许非常轻微的柔和落影增强立体感，但不要出现地面/桌面。\n输出为电商商品图风格，清晰、整洁、高质量。',
  pants: '请从图片中只保留裤子本体，完整呈现出裤子轮廓（包含腰头、裤腿、口袋等细节），移除人物、皮肤、鞋子、背景、衣架、阴影杂物与文字水印。\n将裤子居中摆放，保持真实颜色与材质纹理，不要改变款式、不增加配饰。\n背景替换为干净的纯色背景（浅灰/米白，接近 #F7F7F7），允许非常轻微的柔和落影。\n输出为电商商品图风格，清晰、整洁、高质量。',
  hat:   '请从图片中只保留帽子本体，完整呈现出帽子轮廓（包含帽顶、帽檐、帽带等细节），移除人物、头发、皮肤、背景、阴影杂物与文字水印。\n将帽子居中摆放，保持真实颜色与材质纹理，不要改变款式。\n背景替换为干净的纯色背景（浅灰/米白，接近 #F7F7F7），允许非常轻微的柔和落影。\n输出为电商商品图风格，清晰、整洁、高质量。',
  bag:   '请从图片中只保留包袋本体，完整呈现出包袋轮廓（包含提手、背带、五金配件、缝线等细节），移除人物、皮肤、背景、阴影杂物与文字水印。\n将包袋居中摆放，保持真实颜色与材质纹理，不要改变款式。\n背景替换为干净的纯色背景（浅灰/米白，接近 #F7F7F7），允许非常轻微的柔和落影。\n输出为电商商品图风格，清晰、整洁、高质量。',
  shoes: '请从图片中只保留鞋子本体，完整呈现出鞋子轮廓（包含鞋面、鞋底、鞋头、后跟等细节），移除人物、脚踝、地面、背景、阴影杂物与文字水印。\n将鞋子居中摆放，保持真实颜色与材质纹理，不要改变款式。\n背景替换为干净的纯色背景（浅灰/米白，接近 #F7F7F7），允许非常轻微的柔和落影。\n输出为电商商品图风格，清晰、整洁、高质量。',
  scarf: '请从图片中只保留围巾/领巾本体，完整呈现出围巾形状（包含图案、边缘细节等），移除人物、颈部、背景、阴影杂物与文字水印。\n将围巾平铺或自然悬挂展示，保持真实颜色与材质纹理，不要改变图案。\n背景替换为干净的纯色背景（浅灰/米白，接近 #F7F7F7），允许非常轻微的柔和落影。\n输出为电商商品图风格，清晰、整洁、高质量。',
}

const file = ref<File | null>(null)
const fileName = ref('')
const previewUrl = ref('')

const name = ref('')
const type = ref('')
const part = ref('top')

const prompt = ref(PART_PROMPTS.top)

function selectPart(value: string) {
  part.value = value
  prompt.value = PART_PROMPTS[value] ?? ''
}

const loading = ref(false)
const processing = ref(false)
const classifying = ref(false)
const classifyWarning = ref('')
const error = ref('')

let closeSse: (() => void) | null = null

function onFile(e: Event) {
  const input = e.target as HTMLInputElement
  const f = input.files?.[0] ?? null
  file.value = f
  fileName.value = f?.name ?? ''

  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = f ? URL.createObjectURL(f) : ''
}

async function submit() {
  if (!file.value) return
  loading.value = true
  error.value = ''
  try {
    const fd = new FormData()
    fd.append('image', file.value)
    if (name.value.trim()) fd.append('name', name.value.trim())
    fd.append('type', type.value.trim() || 'unknown')
    fd.append('part', part.value)
    if (prompt.value.trim()) fd.append('prompt', prompt.value.trim())

    const created = await createItem(fd)
    loading.value = false

    if (created.status === 'processing') {
      processing.value = true
      closeSse = subscribeItemStatus(created.id, {
        onReady: async () => {
          processing.value = false
          classifying.value = true
          classifyWarning.value = ''
          try {
            await autoClassifyItem(created.id)
          } catch (classifyErr: any) {
            classifyWarning.value = classifyErr?.message || '未知错误'
          } finally {
            classifying.value = false
            router.replace(`/items/${created.id}`)
          }
        },
        onError: (msg) => {
          processing.value = false
          error.value = msg || 'AI 处理失败'
        },
      })
    } else {
      router.replace(`/items/${created.id}`)
    }
  } catch (e: any) {
    error.value = e?.message || '录入失败'
    loading.value = false
  }
}

onBeforeUnmount(() => {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  closeSse?.()
})
</script>

<style scoped></style>
