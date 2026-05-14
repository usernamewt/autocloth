<template>
  <Teleport to="body">
    <Transition name="agent-fade">
      <div
        v-if="isOpen"
        class="fixed inset-0 z-[9999] flex items-center justify-center p-4"
        @click.self="close"
      >
        <div class="absolute inset-0 bg-black/70 backdrop-blur-md" @click="close" />

        <div class="relative w-full max-w-xl bg-[#111113] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
          <!-- Header -->
          <div class="flex items-center gap-3 px-5 py-4 border-b border-white/[0.07]">
            <div class="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center flex-shrink-0">
              <svg class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
            </div>
            <div>
              <div class="text-white text-sm font-semibold leading-none">智能衣橱助手</div>
              <div class="text-white/30 text-xs mt-0.5">双击 Enter 唤醒 · ESC 关闭</div>
            </div>
            <button
              @click="close"
              class="ml-auto p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/80 transition-colors"
            >
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Quick actions -->
          <div class="px-5 pt-4 flex flex-wrap gap-2">
            <button
              v-for="action in quickActions"
              :key="action.label"
              @click="executeQuickAction(action)"
              :disabled="loading"
              class="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.06] hover:bg-white/[0.12] text-white/60 hover:text-white/90 border border-white/[0.08] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {{ action.label }}
            </button>
          </div>

          <!-- Input area -->
          <div class="px-5 pt-4 pb-5">
            <div class="flex gap-3 items-end">
              <textarea
                ref="inputRef"
                v-model="inputText"
                @keydown="handleInputKeydown"
                placeholder="告诉我你想做什么..."
                rows="2"
                class="flex-1 bg-white/[0.05] border border-white/[0.09] rounded-xl px-4 py-3 text-white placeholder-white/25 text-sm resize-none focus:outline-none focus:border-violet-500/60 focus:bg-white/[0.07] transition-all"
              />
              <button
                @click="submit"
                :disabled="loading || !inputText.trim()"
                class="p-3 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white disabled:opacity-30 hover:opacity-90 active:scale-95 transition-all flex-shrink-0 shadow-lg shadow-violet-500/20"
              >
                <svg v-if="!loading" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 2L11 13M22 2L15 22 11 13 2 9l20-7z" />
                </svg>
                <svg v-else class="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 12a9 9 0 11-6.219-8.56" stroke-linecap="round" />
                </svg>
              </button>
            </div>

            <!-- Response message -->
            <Transition name="slide-up">
              <div
                v-if="responseMessage"
                :class="[
                  'mt-3 px-4 py-2.5 rounded-xl text-sm flex items-start gap-2',
                  responseType === 'error'
                    ? 'bg-red-500/10 text-red-300 border border-red-500/20'
                    : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                ]"
              >
                <svg v-if="responseType === 'error'" class="w-4 h-4 mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
                </svg>
                <svg v-else class="w-4 h-4 mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20 6L9 17l-5-5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                {{ responseMessage }}
              </div>
            </Transition>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, nextTick, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useAgentStore } from '@/stores/agent'

const router = useRouter()
const auth = useAuthStore() // needed for Bearer token in fetch
const agentStore = useAgentStore()

const isOpen = ref(false)
const inputText = ref('')
const loading = ref(false)
const responseMessage = ref('')
const responseType = ref<'success' | 'error'>('success')
const inputRef = ref<HTMLTextAreaElement | null>(null)

const quickActions = [
  { label: '📦 一键录入', text: '我想录入一件新衣物' },
  { label: '✨ 一键推荐', text: '给我推荐今天的穿搭' },
  { label: '👗 一键合成', text: '我想虚拟试衣合成' },
  { label: '🚪 退出登录', text: '我要退出登录' },
  { label: '🔑 去登录', text: '跳转到登录页面' },
]

let lastEnterTime = 0

function handleGlobalKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && isOpen.value) {
    close()
    return
  }

  if (e.key !== 'Enter') return

  const activeEl = document.activeElement as HTMLElement | null
  const isInInput =
    activeEl &&
    (activeEl.tagName === 'INPUT' ||
      activeEl.tagName === 'TEXTAREA' ||
      activeEl.contentEditable === 'true')

  if (isInInput && !isOpen.value) return

  if (isOpen.value) return

  const now = Date.now()
  if (now - lastEnterTime < 500) {
    lastEnterTime = 0
    open()
  } else {
    lastEnterTime = now
  }
}

function handleInputKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    submit()
  }
  if (e.key === 'Escape') close()
}

function open() {
  isOpen.value = true
  responseMessage.value = ''
  inputText.value = ''
  nextTick(() => inputRef.value?.focus())
}

function close() {
  isOpen.value = false
  inputText.value = ''
  responseMessage.value = ''
  loading.value = false
}

async function submit() {
  const text = inputText.value.trim()
  if (!text || loading.value) return

  loading.value = true
  responseMessage.value = ''

  const controller = new AbortController()
  const hardTimeout = setTimeout(() => controller.abort(), 600000)
  const hintTimeout = setTimeout(() => {
    if (loading.value) {
      responseMessage.value = 'AI 正在生成页面，请稍候...'
      responseType.value = 'success'
    }
  }, 5000)

  try {
    const res = await fetch('/api/v1/agent/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth.accessToken}`,
      },
      body: JSON.stringify({ message: text }),
      signal: controller.signal,
    })
    const data = await res.json()
    await handleResponse(data)
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      responseMessage.value = '请求超时，请重试'
    } else {
      responseMessage.value = '网络错误，请重试'
    }
    responseType.value = 'error'
  } finally {
    clearTimeout(hardTimeout)
    clearTimeout(hintTimeout)
    loading.value = false
  }
}

async function executeQuickAction(action: { label: string; text: string }) {
  inputText.value = action.text
  await submit()
}

async function handleResponse(data: {
  type: string
  template?: string
  title?: string
  message?: string
}) {
  if (data.type === 'page') {
    agentStore.setPage(data.template || '', data.title, data.message)
    responseMessage.value = data.message || '已生成页面'
    responseType.value = 'success'
    setTimeout(() => {
      close()
      router.push('/agent')
    }, 600)
  } else {
    responseMessage.value = data.message || '我目前还没有这样的能力哦'
    responseType.value = 'error'
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
})
</script>

<style scoped>
.agent-fade-enter-active,
.agent-fade-leave-active {
  transition: opacity 0.2s ease;
}
.agent-fade-enter-from,
.agent-fade-leave-to {
  opacity: 0;
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.2s ease;
}
.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(6px);
}
</style>
