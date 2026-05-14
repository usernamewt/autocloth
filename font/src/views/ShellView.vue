<template>
  <div class="h-screen overflow-hidden bg-background text-foreground">
    <div class="flex h-full">
      <!-- Desktop sidebar -->
      <aside class="hidden lg:flex w-72 flex-col border-r bg-card flex-shrink-0">
        <div class="h-14 px-6 flex items-center border-b flex-shrink-0">
          <div class="font-semibold tracking-tight">Wardrobe</div>
        </div>
        <nav class="flex-1 p-3 space-y-1 overflow-y-auto">
          <RouterLink class="nav-item" to="/items">衣物列表</RouterLink>
          <RouterLink class="nav-item" to="/items/new">录入衣物</RouterLink>
          <RouterLink class="nav-item" to="/outfits">穿搭推荐</RouterLink>
          <RouterLink class="nav-item" to="/fitting">试衣间</RouterLink>
          <RouterLink class="nav-item" to="/history">试衣历史</RouterLink>
          <RouterLink class="nav-item" to="/social">我的收藏</RouterLink>
          <RouterLink class="nav-item" to="/wardrobes">衣橱管理</RouterLink>
          <RouterLink class="nav-item" to="/taxonomy">分类标签</RouterLink>
          <RouterLink class="nav-item" to="/membership">功能介绍</RouterLink>
          <RouterLink class="nav-item" to="/settings">设置</RouterLink>
        </nav>
        <div class="p-3 border-t flex-shrink-0">
          <button class="w-full btn-outline" @click="logout">退出</button>
        </div>
      </aside>

      <!-- Mobile drawer overlay -->
      <Transition name="fade">
        <div
          v-if="mobileMenuOpen"
          class="fixed inset-0 z-40 bg-black/50 lg:hidden"
          @click="mobileMenuOpen = false"
        />
      </Transition>

      <!-- Mobile drawer panel -->
      <Transition name="slide">
        <aside
          v-if="mobileMenuOpen"
          class="fixed inset-y-0 left-0 z-50 w-72 flex flex-col border-r bg-card lg:hidden"
        >
          <div class="h-14 px-4 flex items-center justify-between border-b flex-shrink-0">
            <div class="font-semibold tracking-tight">Wardrobe</div>
            <button class="p-1.5 rounded-md hover:bg-accent" aria-label="关闭菜单" @click="mobileMenuOpen = false">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <nav class="flex-1 p-3 space-y-1 overflow-y-auto" @click="mobileMenuOpen = false">
            <RouterLink class="nav-item" to="/items">衣物列表</RouterLink>
            <RouterLink class="nav-item" to="/items/new">录入衣物</RouterLink>
            <RouterLink class="nav-item" to="/outfits">穿搭推荐</RouterLink>
            <RouterLink class="nav-item" to="/fitting">试衣间</RouterLink>
            <RouterLink class="nav-item" to="/history">试衣历史</RouterLink>
            <RouterLink class="nav-item" to="/social">我的收藏</RouterLink>
            <RouterLink class="nav-item" to="/wardrobes">衣橱管理</RouterLink>
            <RouterLink class="nav-item" to="/taxonomy">分类标签</RouterLink>
            <RouterLink class="nav-item" to="/membership">功能介绍</RouterLink>
            <RouterLink class="nav-item" to="/settings">设置</RouterLink>
          </nav>
          <div class="p-3 border-t flex-shrink-0">
            <button class="w-full btn-outline" @click="logout">退出</button>
          </div>
        </aside>
      </Transition>

      <div class="flex-1 flex flex-col min-w-0">
        <header class="h-14 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex-shrink-0">
          <div class="h-full px-4 flex items-center gap-3">
            <!-- Hamburger (mobile only) -->
            <button
              class="p-1.5 rounded-md hover:bg-accent lg:hidden flex-shrink-0"
              aria-label="打开菜单"
              @click="mobileMenuOpen = true"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            </button>
            <div class="flex-1 text-sm text-muted-foreground hidden sm:block">Your wardrobe, simplified.</div>
            <button class="btn-outline lg:hidden ml-auto" @click="logout">退出</button>
          </div>
        </header>

        <main class="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
          <RouterView />
        </main>
      </div>
    </div>
    <AgentOverlay />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, RouterView, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import AgentOverlay from '@/components/AgentOverlay.vue'

const router = useRouter()
const auth = useAuthStore()

auth.loadFromStorage()

const mobileMenuOpen = ref(false)

function logout() {
  auth.clear()
  router.replace({ name: 'login' })
}
</script>

<style scoped>
.nav-item {
  display: flex;
  align-items: center;
  border-radius: calc(var(--radius) - 2px);
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  line-height: 1.25rem;
  color: hsl(var(--muted-foreground));
  text-decoration: none;
}

.nav-item:hover {
  background: hsl(var(--accent));
  color: hsl(var(--accent-foreground));
}

.nav-item.router-link-active {
  background: hsl(var(--accent));
  color: hsl(var(--accent-foreground));
  font-weight: 600;
}

.btn-outline {
  border: 1px solid hsl(var(--border));
  background: transparent;
  color: hsl(var(--foreground));
  border-radius: calc(var(--radius) - 2px);
  padding: 0.45rem 0.75rem;
  font-size: 0.875rem;
  line-height: 1.25rem;
}

.btn-outline:hover {
  background: hsl(var(--accent));
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-enter-active,
.slide-leave-active {
  transition: transform 0.25s ease;
}
.slide-enter-from,
.slide-leave-to {
  transform: translateX(-100%);
}
</style>
