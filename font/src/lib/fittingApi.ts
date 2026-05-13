import { api, apiFetch } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'

// --- Types ---

export interface FittingPhoto {
  id: string
  user_id: string
  label?: string | null
  photo_type: 'full_body' | 'half_body'
  image_url: string | null
  created_at: string
}

export interface RecommendationResult {
  item_ids: string[]
  outfit_name: string
  reasoning: string
  style_tips: string
  prompt: string
}

export interface RecommendResponse {
  recommendation: RecommendationResult
  items: any[]
  recommendation_id: string
  context: { date: string; weather: string; occasion: string }
}

export interface FittingResult {
  id: string
  photo_id: string | null
  item_ids: string[]
  outfit_name: string | null
  occasion: string | null
  outfit_date: string | null
  reasoning: string | null
  style_tips: string | null
  recommendation: string | null
  prompt: string | null
  preprocessed_image_url: string | null
  result_image_url: string | null
  weather: any
  status: 'pending' | 'generating' | 'ready' | 'error'
  error_message: string | null
  created_at: string
}

// --- Photo CRUD ---

export async function uploadFittingPhoto(
  file: File,
  photoType: 'full_body' | 'half_body' = 'full_body',
  label?: string,
): Promise<FittingPhoto> {
  const fd = new FormData()
  fd.append('image', file)
  fd.append('photo_type', photoType)
  if (label) fd.append('label', label)
  return api.post<FittingPhoto>('/fitting/photos', fd)
}

export function listFittingPhotos(): Promise<FittingPhoto[]> {
  return api.get<FittingPhoto[]>('/fitting/photos')
}

export function deleteFittingPhoto(id: string): Promise<{ success: boolean }> {
  return api.delete<{ success: boolean }>(`/fitting/photos/${id}`)
}

// --- Recommendation ---

export function getRecommendation(params: {
  weather?: Record<string, any>
  date?: string
  occasion?: string
}): Promise<RecommendResponse> {
  return api.post<RecommendResponse>('/fitting/recommend', params)
}

// --- Generate ---

export function generateFitting(params: {
  photo_id: string
  item_ids: string[]
  prompt?: string
  weather?: Record<string, any>
  outfit_name?: string
  occasion?: string
  outfit_date?: string
  reasoning?: string
  style_tips?: string
}): Promise<{ id: string; status: string }> {
  return api.post<{ id: string; status: string }>('/fitting/generate', params)
}

export function getFittingResult(id: string): Promise<FittingResult> {
  return api.get<FittingResult>(`/fitting/results/${id}`)
}

export function listFittingResults(): Promise<FittingResult[]> {
  return api.get<FittingResult[]>('/fitting/results')
}

export function deleteFittingResult(id: string): Promise<{ success: boolean }> {
  return api.delete<{ success: boolean }>(`/fitting/results/${id}`)
}

export function debugDownloadFittingImage(url?: string): Promise<{ success: boolean; url: string; bytes?: number | null; ms?: number; message?: string; status?: number }> {
  const q = url ? `?url=${encodeURIComponent(url)}` : ''
  return api.get(`/fitting/debug/download${q}`)
}

export async function uploadFittingResultImage(resultId: string, file: Blob, filename = 'result.png'): Promise<FittingResult> {
  const fd = new FormData()
  fd.append('image', file, filename)
  return api.put<FittingResult>(`/fitting/results/${resultId}/image`, fd)
}

// --- SSE for generation status ---

export function subscribeFittingResult(
  resultId: string,
  callbacks: {
    onReady?: (data: { status: string; preprocessed_image_url?: string; result_image_url: string }) => void
    onError?: (message: string, data?: { status: string; preprocessed_image_url?: string; error?: string }) => void
  },
): () => void {
  const auth = useAuthStore()
  const token = auth.accessToken || ''
  const url = `/api/v1/fitting/results/${resultId}/events?token=${encodeURIComponent(token)}`
  const es = new EventSource(url)

  es.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)
      if (data.status === 'ready') {
        callbacks.onReady?.(data)
      } else if (data.status === 'error') {
        callbacks.onError?.(data.error || '生成失败', data)
      }
    } catch {
      callbacks.onError?.('解析数据失败')
    }
    es.close()
  }

  es.onerror = () => {
    es.close()
    callbacks.onError?.('SSE 连接断开')
  }

  return () => es.close()
}
