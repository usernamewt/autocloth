import { api } from '@/lib/api'

export interface Wardrobe {
  id: string
  name: string
  season: 'spring' | 'summer' | 'autumn' | 'winter' | 'all_season'
  is_default: boolean
  sort_order: number
}

export function listWardrobes() {
  return api.get<Wardrobe[]>('/wardrobes')
}

export function createWardrobe(data: { name: string; season?: Wardrobe['season']; is_default?: boolean }) {
  return api.post<Wardrobe>('/wardrobes', data)
}

export function patchWardrobe(id: string, data: { name?: string; season?: Wardrobe['season']; is_default?: boolean }) {
  return api.patch<Wardrobe>(`/wardrobes/${encodeURIComponent(id)}`, data)
}

export function deleteWardrobe(id: string) {
  return api.delete<{ success: boolean }>(`/wardrobes/${encodeURIComponent(id)}`)
}
