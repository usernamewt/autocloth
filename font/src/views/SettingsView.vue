<template>
  <div class="space-y-6 max-w-2xl">
    <header>
      <h1 class="text-2xl font-bold tracking-tight">设置</h1>
      <p class="text-sm text-muted-foreground mt-1">账号信息与衣橱数据概览</p>
    </header>

    <!-- 账号信息 -->
    <UiCard>
      <div class="p-6 space-y-4">
        <h2 class="text-sm font-semibold">账号信息</h2>
        <div v-if="userLoading" class="text-sm text-muted-foreground">加载中...</div>
        <div v-else-if="user" class="grid gap-3 text-sm">
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-full bg-accent flex items-center justify-center text-lg font-semibold">
              {{ (user.display_name || user.email || '?').charAt(0).toUpperCase() }}
            </div>
            <div>
              <div class="font-medium">{{ user.display_name || '未设置名称' }}</div>
              <div class="text-xs text-muted-foreground">{{ user.email }}</div>
            </div>
          </div>
          <div class="grid gap-2 pt-2 border-t">
            <div class="flex justify-between border-b py-2">
              <span class="text-muted-foreground">用户 ID</span>
              <span class="font-mono text-xs">{{ user.id.slice(0, 8) }}...</span>
            </div>
            <div class="flex justify-between border-b py-2">
              <span class="text-muted-foreground">注册时间</span>
              <span>{{ formatDate(user.created_at) }}</span>
            </div>
            <div class="flex justify-between py-2">
              <span class="text-muted-foreground">引导完成</span>
              <span>{{ user.onboarding_completed ? '✓ 已完成' : '未完成' }}</span>
            </div>
          </div>
        </div>
      </div>
    </UiCard>

    <!-- 数据概览 -->
    <UiCard>
      <div class="p-6 space-y-4">
        <h2 class="text-sm font-semibold">数据概览</h2>
        <div v-if="statsLoading" class="text-sm text-muted-foreground">加载中...</div>
        <div v-else class="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div class="rounded-lg bg-accent/40 p-4 text-center">
            <div class="text-2xl font-bold">{{ stats.total }}</div>
            <div class="text-xs text-muted-foreground mt-1">衣物总数</div>
          </div>
          <div class="rounded-lg bg-accent/40 p-4 text-center">
            <div class="text-2xl font-bold">{{ stats.favorites }}</div>
            <div class="text-xs text-muted-foreground mt-1">已收藏</div>
          </div>
          <div class="rounded-lg bg-accent/40 p-4 text-center">
            <div class="text-2xl font-bold">{{ stats.needsWash }}</div>
            <div class="text-xs text-muted-foreground mt-1">待清洗</div>
          </div>
          <div class="rounded-lg bg-accent/40 p-4 text-center">
            <div class="text-2xl font-bold">{{ stats.wardrobes }}</div>
            <div class="text-xs text-muted-foreground mt-1">衣橱数量</div>
          </div>
        </div>
      </div>
    </UiCard>

    <!-- 快捷入口 -->
    <UiCard>
      <div class="p-6 space-y-3">
        <h2 class="text-sm font-semibold">快捷入口</h2>
        <div class="grid gap-2">
          <RouterLink to="/items/new" class="flex items-center justify-between rounded-md border p-3 hover:bg-accent/30 transition-colors text-sm">
            <span>录入新衣物</span><span class="text-muted-foreground">→</span>
          </RouterLink>
          <RouterLink to="/fitting" class="flex items-center justify-between rounded-md border p-3 hover:bg-accent/30 transition-colors text-sm">
            <span>前往试衣间</span><span class="text-muted-foreground">→</span>
          </RouterLink>
          <RouterLink to="/wardrobes" class="flex items-center justify-between rounded-md border p-3 hover:bg-accent/30 transition-colors text-sm">
            <span>管理衣橱</span><span class="text-muted-foreground">→</span>
          </RouterLink>
          <RouterLink to="/taxonomy" class="flex items-center justify-between rounded-md border p-3 hover:bg-accent/30 transition-colors text-sm">
            <span>初始化分类标签</span><span class="text-muted-foreground">→</span>
          </RouterLink>
        </div>
      </div>
    </UiCard>

    <!-- ⏰ AI 穿搭闹钟 -->
    <UiCard>
      <div class="p-6 space-y-5">
        <div>
          <h2 class="text-sm font-semibold">⏰穿搭闹钟</h2>
          <p class="text-xs text-muted-foreground mt-1">设定出门时间，系统提前5分钟自动备好今日穿搭</p>
        </div>

        <div v-if="alarmLoading" class="text-sm text-muted-foreground">加载中…</div>

        <div v-else class="space-y-4">
          <!-- 时间 + 场合 -->
          <div class="grid gap-4 sm:grid-cols-2">
            <div class="grid gap-1.5">
              <label class="text-xs font-medium text-muted-foreground">出门时间</label>
              <input
                v-model="alarmTime"
                type="time"
                :disabled="alarmSaving"
                class="border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <span class="text-xs text-muted-foreground">
                将在 {{ triggerTime }} 开始自动生成
              </span>
            </div>
            <div class="grid gap-1.5">
              <label class="text-xs font-medium text-muted-foreground">触发时间</label>
              <div class="border rounded-md px-3 py-2 text-sm bg-muted/30 text-muted-foreground">
                {{ triggerTime }}（出门前5分钟自动运行）
              </div>
            </div>
          </div>

          <div class="grid gap-1.5">
            <label class="text-xs font-medium text-muted-foreground">出行场合</label>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="occ in OCCASIONS"
                :key="occ"
                type="button"
                :disabled="alarmSaving"
                :class="[
                  'px-3 py-1 rounded-full text-xs border transition-colors',
                  alarmOccasion === occ
                    ? 'bg-primary text-primary-foreground border-primary font-semibold'
                    : 'border-border text-muted-foreground hover:border-primary/50',
                ]"
                @click="alarmOccasion = occ"
              >{{ occ }}</button>
            </div>
          </div>

          <!-- 状态 & 操作 -->
          <div class="flex items-center justify-between pt-2 border-t">
            <div v-if="alarmExists" class="flex items-center gap-2 text-sm">
              <span
                class="inline-block w-2 h-2 rounded-full"
                :class="alarmEnabled ? 'bg-green-500' : 'bg-muted-foreground/40'"
              ></span>
              <span class="text-muted-foreground">{{ alarmEnabled ? '运行中' : '已暂停' }}</span>
              <span v-if="alarmLastRunDate" class="text-xs text-muted-foreground">· 上次运行 {{ alarmLastRunDate }}</span>
            </div>
            <div v-else class="text-xs text-muted-foreground">尚未设置闹钟</div>

            <div class="flex gap-2">
              <button
                v-if="alarmExists"
                type="button"
                :disabled="alarmSaving"
                class="text-xs px-3 py-1.5 rounded-md border hover:bg-accent/40 transition-colors"
                @click="toggleAlarm"
              >{{ alarmEnabled ? '暂停' : '恢复' }}</button>
              <button
                v-if="alarmExists"
                type="button"
                :disabled="alarmSaving"
                class="text-xs px-3 py-1.5 rounded-md border border-destructive/40 text-destructive hover:bg-destructive/10 transition-colors"
                @click="removeAlarm"
              >删除</button>
              <UiButton size="sm" :disabled="alarmSaving || !alarmTime" @click="saveAlarm">
                {{ alarmSaving ? '保存中…' : alarmExists ? '更新设置' : '开启闹钟' }}
              </UiButton>
            </div>
          </div>
        </div>
      </div>
    </UiCard>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { api } from '@/lib/api'
import { listItems } from '@/lib/itemsApi'
import { listWardrobes } from '@/lib/wardrobesApi'
import { getSchedule, saveSchedule, deleteSchedule } from '@/lib/dailyOutfitApi'
import UiCard from '@/components/ui/UiCard.vue'
import UiButton from '@/components/ui/UiButton.vue'

const OCCASIONS = ['日常', '通勤', '约会', '运动', '商务', '聚会']

interface UserMe {
  id: string
  email: string
  display_name: string | null
  avatar_url: string | null
  onboarding_completed: boolean
  created_at: string
  updated_at: string
}

const user = ref<UserMe | null>(null)
const userLoading = ref(false)
const statsLoading = ref(false)
const stats = ref({ total: 0, favorites: 0, needsWash: 0, wardrobes: 0 })

function formatDate(ts: string) {
  if (!ts) return ''
  return new Date(ts).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
}

async function loadUser() {
  userLoading.value = true
  try {
    user.value = await api.get<UserMe>('/users/me')
  } catch { /* ignore */ } finally {
    userLoading.value = false
  }
}

async function loadStats() {
  statsLoading.value = true
  try {
    const [all, fav, wash, wards] = await Promise.all([
      listItems({ page_size: 1 }),
      listItems({ favorite: true, page_size: 1 }),
      listItems({ needs_wash: true, page_size: 1 }),
      listWardrobes(),
    ])
    stats.value = {
      total: all.total,
      favorites: fav.total,
      needsWash: wash.total,
      wardrobes: wards.length,
    }
  } catch { /* ignore */ } finally {
    statsLoading.value = false
  }
}

// ── AI 穿搭闹钟 ──────────────────────────────
const PREPARE_MINS = 5

const alarmLoading = ref(false)
const alarmSaving = ref(false)
const alarmExists = ref(false)
const alarmEnabled = ref(false)
const alarmTime = ref('08:00')
const alarmOccasion = ref('日常')
const alarmLastRunDate = ref<string | null>(null)

const triggerTime = computed(() => {
  if (!alarmTime.value) return '--:--'
  const [h, m] = alarmTime.value.split(':').map(Number)
  const total = ((h * 60 + m - PREPARE_MINS) % 1440 + 1440) % 1440
  return String(Math.floor(total / 60)).padStart(2, '0') + ':' + String(total % 60).padStart(2, '0')
})

async function loadAlarm() {
  alarmLoading.value = true
  try {
    const res = await getSchedule()
    if (res.exists) {
      alarmExists.value = true
      alarmEnabled.value = res.enabled
      alarmTime.value = res.alarm_time || '08:00'
      alarmOccasion.value = res.occasion || '日常'
      alarmLastRunDate.value = res.last_run_date
    }
  } catch { /* ignore */ } finally {
    alarmLoading.value = false
  }
}

async function saveAlarm() {
  if (!alarmTime.value) return
  alarmSaving.value = true
  try {
    await saveSchedule({
      alarm_time: alarmTime.value,
      occasion: alarmOccasion.value,
      enabled: true,
    })
    alarmExists.value = true
    alarmEnabled.value = true
  } catch (e: any) {
    alert(e?.message || '保存失败')
  } finally {
    alarmSaving.value = false
  }
}

async function toggleAlarm() {
  alarmSaving.value = true
  try {
    const newEnabled = !alarmEnabled.value
    await saveSchedule({
      alarm_time: alarmTime.value,
      occasion: alarmOccasion.value,
      enabled: newEnabled,
    })
    alarmEnabled.value = newEnabled
  } catch (e: any) {
    alert(e?.message || '操作失败')
  } finally {
    alarmSaving.value = false
  }
}

async function removeAlarm() {
  if (!confirm('确定关闭 AI 穿搭闹钟？将停止每日自动生成穿搭')) return
  alarmSaving.value = true
  try {
    await deleteSchedule()
    alarmExists.value = false
    alarmEnabled.value = false
  } catch (e: any) {
    alert(e?.message || '删除失败')
  } finally {
    alarmSaving.value = false
  }
}

onMounted(() => {
  loadUser()
  loadStats()
  loadAlarm()
})
</script>

<style scoped></style>
