<template>
  <div class="space-y-6 max-w-2xl">
    <header>
      <h1 class="text-2xl font-bold tracking-tight">功能介绍</h1>
      <p class="text-sm text-muted-foreground mt-1">Wardrobe AI 的全部能力一览</p>
    </header>

    <div class="grid gap-4">
      <UiCard v-for="f in features" :key="f.title">
        <div class="p-5 flex items-start gap-4">
          <div class="text-3xl flex-shrink-0">{{ f.icon }}</div>
          <div class="space-y-1">
            <div class="font-semibold text-sm">{{ f.title }}</div>
            <div class="text-sm text-muted-foreground">{{ f.desc }}</div>
            <RouterLink
              v-if="f.route"
              :to="f.route"
              class="inline-block mt-2 text-xs text-primary hover:underline"
            >立即体验 →</RouterLink>
          </div>
        </div>
      </UiCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'
import UiCard from '@/components/ui/UiCard.vue'

const features = [
  {
    icon: '📸',
    title: 'AI 自动抠图',
    desc: '上传衣物原图，AI 自动去除背景、抠出衣物主体，替换为电商纯色底图，方便管理和搭配。',
    route: '/items/new',
  },
  {
    icon: '🏷️',
    title: '智能分类标签',
    desc: '基于 AI 自动识别颜色、风格、季节、场景等属性，也可手动在详情页调整分类，让推荐更精准。',
    route: '/taxonomy',
  },
  {
    icon: '👗',
    title: 'AI 穿搭推荐',
    desc: '输入当天天气和场合，DeepSeek 从你的衣橱中智能搭配，给出完整穿搭方案和穿搭建议。',
    route: '/outfits',
  },
  {
    icon: '🪞',
    title: 'AI 虚拟试衣',
    desc: '上传形象照，选择想穿的单品，AI 将衣物合成到你身上，直观预览穿搭效果后再决定是否出门。',
    route: '/fitting',
  },
  {
    icon: '⭐',
    title: '收藏管理',
    desc: '在衣物详情页收藏喜爱的单品，在「收藏」页统一查看和快速访问，也方便作为试衣选项。',
    route: '/social',
  },
  {
    icon: '🗂️',
    title: '多衣橱管理',
    desc: '按季节或用途创建多个衣橱（如夏装、冬装、通勤），衣物可归属到不同衣橱，条理更清晰。',
    route: '/wardrobes',
  },
  {
    icon: '🧺',
    title: '穿着与清洗追踪',
    desc: '在衣物详情页记录穿着次数，系统自动追踪清洗周期，提醒你该洗的衣物，延长衣物寿命。',
    route: '/items',
  },
  {
    icon: '🕓',
    title: '试衣历史',
    desc: '查看所有历史试衣记录，包含 sharp 预处理合成图和 AI 最终效果图，方便对比和调试。',
    route: '/history',
  },
]
</script>

<style scoped></style>
