import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { public: true },
    },
    {
      path: '/',
      component: () => import('@/views/ShellView.vue'),
      children: [
        { path: '', redirect: { name: 'items' } },
        {
          path: 'items',
          name: 'items',
          component: () => import('@/views/ItemsView.vue'),
        },
        {
          path: 'items/:id',
          name: 'item-detail',
          component: () => import('@/views/ItemDetailView.vue'),
        },
        {
          path: 'items/new',
          name: 'item-new',
          component: () => import('@/views/ItemCreateView.vue'),
        },
        {
          path: 'fitting',
          name: 'fitting',
          component: () => import('@/views/FittingRoomView.vue'),
        },
        {
          path: 'outfits',
          name: 'outfits',
          component: () => import('@/views/OutfitsView.vue'),
        },
        {
          path: 'history',
          name: 'history',
          component: () => import('@/views/HistoryView.vue'),
        },
        {
          path: 'taxonomy',
          name: 'taxonomy',
          component: () => import('@/views/TaxonomyView.vue'),
        },
        {
          path: 'wardrobes',
          name: 'wardrobes',
          component: () => import('@/views/WardrobesView.vue'),
        },
        {
          path: 'social',
          name: 'social',
          component: () => import('@/views/SocialView.vue'),
        },
        {
          path: 'membership',
          name: 'membership',
          component: () => import('@/views/MembershipView.vue'),
        },
        {
          path: 'settings',
          name: 'settings',
          component: () => import('@/views/SettingsView.vue'),
        },
        {
          path: 'agent',
          name: 'agent',
          component: () => import('@/views/AgentView.vue'),
        },
      ],
    },
  ],
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (to.meta.public) return true
  if (!auth.isAuthenticated) return { name: 'login', query: { redirect: to.fullPath } }
  return true
})

export default router
