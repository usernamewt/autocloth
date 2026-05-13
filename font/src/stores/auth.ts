import { defineStore } from 'pinia'

export interface AuthState {
  accessToken: string | null
  user: { id?: string; email?: string; display_name?: string } | null
}

const STORAGE_KEY = 'wardrobe.auth'

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    accessToken: null,
    user: null,
  }),
  getters: {
    isAuthenticated: (s) => !!s.accessToken,
  },
  actions: {
    loadFromStorage() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return
        const parsed = JSON.parse(raw) as AuthState
        this.accessToken = parsed.accessToken ?? null
        this.user = parsed.user ?? null
      } catch {
        this.accessToken = null
        this.user = null
      }
    },
    persist() {
      const data: AuthState = { accessToken: this.accessToken, user: this.user }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    },
    setSession(accessToken: string, user?: AuthState['user']) {
      this.accessToken = accessToken
      this.user = user ?? this.user
      this.persist()
    },
    clear() {
      this.accessToken = null
      this.user = null
      localStorage.removeItem(STORAGE_KEY)
    },
  },
})
