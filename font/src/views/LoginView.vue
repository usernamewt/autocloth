<template>
  <div class="min-h-screen bg-background text-foreground flex items-center justify-center px-4">
    <div class="w-full max-w-md">
      <div class="text-center mb-6">
        <h1 class="text-2xl font-bold tracking-tight">Wardrobe</h1>
        <p class="text-sm text-muted-foreground mt-1">
          输入邮箱与昵称，后端将通过 /api/v1/auth/sync 返回 JWT
        </p>
      </div>

      <div class="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
        <div class="grid gap-4">
          <div class="grid gap-2">
            <label class="text-sm font-medium">邮箱</label>
            <input
              v-model="email"
              type="email"
              class="h-10 w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="you@example.com"
            />
          </div>

          <div class="grid gap-2">
            <label class="text-sm font-medium">昵称</label>
            <input
              v-model="displayName"
              type="text"
              class="h-10 w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="你的昵称"
            />
          </div>

          <button
            class="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            :disabled="loading || !email.trim()"
            @click="login"
          >
            {{ loading ? '登录中...' : '登录' }}
          </button>

          <div v-if="error" class="text-sm text-destructive">{{ error }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

auth.loadFromStorage()

const email = ref('')
const displayName = ref('')
const loading = ref(false)
const error = ref('')

async function login() {
  loading.value = true
  error.value = ''

  try {
    const res = await api.post<{ access_token: string; user?: any }>('/auth/sync', {
      external_id: email.value.trim().toLowerCase(),
      email: email.value.trim().toLowerCase(),
      display_name: displayName.value.trim() || email.value.trim().split('@')[0],
      avatar_url: null,
    })

    auth.setSession(res.access_token, res.user ?? { email: email.value.trim() })
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    router.replace(redirect)
  } catch (e: any) {
    error.value = e?.message || '登录失败'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped></style>
