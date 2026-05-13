import { api } from '@/lib/api'
import type { Item, ItemListResponse } from '@/lib/types'

export function listItems(params: {
  page?: number
  page_size?: number
  type?: string
  search?: string
  favorite?: boolean
  needs_wash?: boolean
  status?: string
  sort_by?: string
  sort_order?: 'asc' | 'desc'
} = {}) {
  const sp = new URLSearchParams()
  if (params.page) sp.set('page', String(params.page))
  if (params.page_size) sp.set('page_size', String(params.page_size))
  if (params.type) sp.set('type', params.type)
  if (params.search) sp.set('search', params.search)
  if (params.favorite !== undefined) sp.set('favorite', String(params.favorite))
  if (params.needs_wash !== undefined) sp.set('needs_wash', String(params.needs_wash))
  if (params.status) sp.set('status', params.status)
  if (params.sort_by) sp.set('sort_by', params.sort_by)
  if (params.sort_order) sp.set('sort_order', params.sort_order)

  const qs = sp.toString()
  return api.get<ItemListResponse>(`/items${qs ? `?${qs}` : ''}`)
}

export function getItem(id: string) {
  return api.get<Item>(`/items/${encodeURIComponent(id)}`)
}

export function createItem(fd: FormData) {
  return api.post<Item>('/items', fd)
}

export function patchItem(
  id: string,
  data: Partial<Pick<Item, 'name' | 'type' | 'notes' | 'brand' | 'favorite' | 'needs_wash'> & { wardrobe_id?: string | null; purchase_date?: string | null; purchase_price?: number | null }>,
) {
  return api.patch<Item>(`/items/${encodeURIComponent(id)}`, data)
}

export function deleteItem(id: string) {
  return api.delete<{ success: boolean }>(`/items/${encodeURIComponent(id)}`)
}

export function wearItem(id: string) {
  return api.post<Item>(`/items/${encodeURIComponent(id)}/wear`)
}

export function uploadItemImage(id: string, blob: Blob): Promise<Item> {
  const fd = new FormData()
  fd.append('image', blob, 'image.png')
  return api.put<Item>(`/items/${encodeURIComponent(id)}/image`, fd)
}

function isExternalImageUrl(url: string | null | undefined): boolean {
  if (!url) return false
  if (!url.startsWith('http://') && !url.startsWith('https://')) return false
  try {
    const { hostname } = new URL(url)
    return hostname !== window.location.hostname
  } catch {
    return false
  }
}

/**
 * 轮询 item 处理状态，每 4 秒查询一次直到 ready/error。
 * 返回一个 stop 函数用于手动停止。
 */
export function subscribeItemStatus(
  itemId: string,
  callbacks: {
    onReady?: (item: Item) => void
    onError?: (message: string) => void
  },
): () => void {
  let stopped = false
  let timer: ReturnType<typeof setTimeout> | null = null

  async function poll() {
    if (stopped) return
    try {
      const item = await getItem(itemId)
      if (item.status === 'ready') {
        if (isExternalImageUrl(item.image_url)) {
          try {
            const resp = await fetch(item.image_url!)
            if (resp.ok) {
              const blob = await resp.blob()
              const saved = await uploadItemImage(itemId, blob)
              callbacks.onReady?.(saved)
              return
            }
          } catch {
            // fallback: return item with external url as-is
          }
        }
        callbacks.onReady?.(item)
        return
      }
      if (item.status === 'error') {
        callbacks.onError?.('AI 处理失败')
        return
      }
    } catch (e: any) {
      callbacks.onError?.(e?.message || '查询失败')
      return
    }
    if (!stopped) timer = setTimeout(poll, 4000)
  }

  poll()

  return () => {
    stopped = true
    if (timer) clearTimeout(timer)
  }
}
