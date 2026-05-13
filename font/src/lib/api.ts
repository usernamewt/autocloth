import { useAuthStore } from '@/stores/auth'

const API_BASE_PATH = '/api/v1'

export class ApiError extends Error {
  status: number
  data: unknown

  constructor(message: string, status: number, data: unknown) {
    super(message)
    this.status = status
    this.data = data
    this.name = 'ApiError'
  }
}

export async function apiFetch<T>(endpoint: string, init: RequestInit = {}): Promise<T> {
  const auth = useAuthStore()

  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string>),
  }

  if (!(init.body instanceof FormData)) {
    if (!headers['Content-Type']) headers['Content-Type'] = 'application/json'
  }

  if (auth.accessToken) {
    headers.Authorization = `Bearer ${auth.accessToken}`
  }

  const res = await fetch(`${API_BASE_PATH}${endpoint}`, {
    ...init,
    headers,
    credentials: 'include',
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    const message =
      (typeof (data as any)?.detail === 'string' ? (data as any).detail : (data as any)?.detail?.message) ||
      (data as any)?.error?.message ||
      (data as any)?.error ||
      'An error occurred'
    throw new ApiError(message, res.status, data)
  }

  if (res.status === 204) return undefined as T
  return res.json()
}

export const api = {
  get: <T>(endpoint: string) => apiFetch<T>(endpoint, { method: 'GET' }),
  post: <T>(endpoint: string, data?: unknown) =>
    apiFetch<T>(endpoint, {
      method: 'POST',
      body: data instanceof FormData ? data : data ? JSON.stringify(data) : undefined,
    }),
  put: <T>(endpoint: string, data?: unknown) =>
    apiFetch<T>(endpoint, {
      method: 'PUT',
      body: data instanceof FormData ? data : data ? JSON.stringify(data) : undefined,
    }),
  patch: <T>(endpoint: string, data?: unknown) =>
    apiFetch<T>(endpoint, {
      method: 'PATCH',
      body: data instanceof FormData ? data : data ? JSON.stringify(data) : undefined,
    }),
  delete: <T>(endpoint: string) => apiFetch<T>(endpoint, { method: 'DELETE' }),
}
