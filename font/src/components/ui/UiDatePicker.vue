<template>
  <PopoverRoot v-model:open="popoverOpen">
    <PopoverTrigger as-child>
      <button
        type="button"
        class="w-full flex items-center justify-between rounded-md border bg-background px-3 py-2 text-sm hover:bg-accent transition-colors"
      >
        <span :class="modelValue ? 'text-foreground' : 'text-muted-foreground'">
          {{ modelValue ? formatDisplay(modelValue) : placeholder }}
        </span>
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" /></svg>
      </button>
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent
        side="bottom"
        :side-offset="4"
        align="start"
        class="z-50 w-auto rounded-lg border bg-popover p-3 shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
      >
        <!-- Month nav -->
        <div class="flex items-center justify-between mb-2">
          <button type="button" class="h-7 w-7 rounded hover:bg-accent flex items-center justify-center" @click="prevMonth">&lt;</button>
          <span class="text-sm font-medium">{{ viewYear }}年{{ viewMonth + 1 }}月</span>
          <button type="button" class="h-7 w-7 rounded hover:bg-accent flex items-center justify-center" @click="nextMonth">&gt;</button>
        </div>
        <!-- Day headers -->
        <div class="grid grid-cols-7 gap-0 mb-1">
          <div v-for="d in weekDays" :key="d" class="text-center text-xs text-muted-foreground py-1">{{ d }}</div>
        </div>
        <!-- Days grid -->
        <div class="grid grid-cols-7 gap-0">
          <button
            v-for="(day, idx) in calendarDays"
            :key="idx"
            type="button"
            class="h-8 w-8 rounded text-sm flex items-center justify-center transition-colors"
            :class="dayClass(day)"
            :disabled="!day.current"
            @click="selectDay(day)"
          >
            {{ day.date }}
          </button>
        </div>
        <!-- Today shortcut -->
        <div class="mt-2 flex justify-center">
          <button type="button" class="text-xs text-primary hover:underline" @click="selectToday">今天</button>
        </div>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { PopoverRoot, PopoverTrigger, PopoverPortal, PopoverContent } from 'radix-vue'

const props = withDefaults(defineProps<{
  modelValue: string
  placeholder?: string
}>(), {
  placeholder: '选择日期',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const popoverOpen = ref(false)
const weekDays = ['日', '一', '二', '三', '四', '五', '六']

// Parse initial date
function parseDate(s: string) {
  const d = s ? new Date(s + 'T00:00:00') : new Date()
  return { year: d.getFullYear(), month: d.getMonth(), date: d.getDate() }
}

const init = parseDate(props.modelValue)
const viewYear = ref(init.year)
const viewMonth = ref(init.month)

watch(() => props.modelValue, (v) => {
  if (v) {
    const p = parseDate(v)
    viewYear.value = p.year
    viewMonth.value = p.month
  }
})

interface CalDay { date: number; current: boolean; iso: string }

const calendarDays = computed<CalDay[]>(() => {
  const y = viewYear.value
  const m = viewMonth.value
  const firstDay = new Date(y, m, 1).getDay()
  const daysInMonth = new Date(y, m + 1, 0).getDate()
  const daysInPrevMonth = new Date(y, m, 0).getDate()
  const days: CalDay[] = []

  for (let i = firstDay - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i
    const pm = m === 0 ? 11 : m - 1
    const py = m === 0 ? y - 1 : y
    days.push({ date: d, current: false, iso: fmt(py, pm, d) })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    days.push({ date: d, current: true, iso: fmt(y, m, d) })
  }
  const remaining = 42 - days.length
  for (let d = 1; d <= remaining; d++) {
    const nm = m === 11 ? 0 : m + 1
    const ny = m === 11 ? y + 1 : y
    days.push({ date: d, current: false, iso: fmt(ny, nm, d) })
  }
  return days
})

function fmt(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function formatDisplay(v: string) {
  const [y, m, d] = v.split('-')
  return `${y}年${parseInt(m)}月${parseInt(d)}日`
}

function dayClass(day: CalDay) {
  if (!day.current) return 'text-muted-foreground/40'
  if (day.iso === props.modelValue) return 'bg-primary text-primary-foreground'
  const today = new Date()
  const todayIso = fmt(today.getFullYear(), today.getMonth(), today.getDate())
  if (day.iso === todayIso) return 'border border-primary text-primary hover:bg-accent'
  return 'hover:bg-accent'
}

function selectDay(day: CalDay) {
  if (!day.current) return
  emit('update:modelValue', day.iso)
  popoverOpen.value = false
}

function selectToday() {
  const t = new Date()
  const iso = fmt(t.getFullYear(), t.getMonth(), t.getDate())
  viewYear.value = t.getFullYear()
  viewMonth.value = t.getMonth()
  emit('update:modelValue', iso)
  popoverOpen.value = false
}

function prevMonth() {
  if (viewMonth.value === 0) { viewMonth.value = 11; viewYear.value-- }
  else viewMonth.value--
}

function nextMonth() {
  if (viewMonth.value === 11) { viewMonth.value = 0; viewYear.value++ }
  else viewMonth.value++
}
</script>
