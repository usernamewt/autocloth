import { api } from '@/lib/api'

export interface DailyOutfitSchedule {
  exists: boolean
  alarm_time: string | null
  prepare_mins: number
  occasion: string
  enabled: boolean
  last_run_date: string | null
  trigger_time: string | null
}

export interface DailyOutfitTodayStatus {
  enabled: boolean
  alarm_time: string | null
  notification_pending: boolean
  has_today_result: boolean
  today_result_id: string | null
  today_outfit_name: string | null
  today_result_status: string | null
}

export function getSchedule(): Promise<DailyOutfitSchedule> {
  return api.get<DailyOutfitSchedule>('/daily-outfit/schedule')
}

export function saveSchedule(params: {
  alarm_time: string
  prepare_mins?: number
  occasion?: string
  enabled?: boolean
}): Promise<DailyOutfitSchedule> {
  return api.post<DailyOutfitSchedule>('/daily-outfit/schedule', params)
}

export function deleteSchedule(): Promise<{ success: boolean }> {
  return api.delete<{ success: boolean }>('/daily-outfit/schedule')
}

export function getTodayStatus(): Promise<DailyOutfitTodayStatus> {
  return api.get<DailyOutfitTodayStatus>('/daily-outfit/today-status')
}

export function markSeen(): Promise<{ success: boolean }> {
  return api.post<{ success: boolean }>('/daily-outfit/mark-seen', {})
}
