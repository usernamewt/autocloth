import { api } from '@/lib/api'

export interface TaxonomyGroup {
  id: string
  key_name: string
  display_name: string
  sort_order: number
  is_system: boolean
}

export interface TaxonomyTerm {
  id: string
  group_id: string
  key_name: string
  display_name: string
  parent_id?: string | null
  sort_order: number
  is_system: boolean
}

export interface TaxonomyTermTree extends TaxonomyTerm {
  children: TaxonomyTermTree[]
}

export interface TaxonomyGroupTree extends TaxonomyGroup {
  terms: TaxonomyTermTree[]
}

export interface ItemTaxonomyTerm {
  term_id: string
  group_id: string
  key_name: string
  display_name: string
  parent_id?: string | null
}

export function listTaxonomyGroups() {
  return api.get<TaxonomyGroup[]>('/taxonomy/groups')
}

export function createTaxonomyGroup(data: { key_name: string; display_name: string }) {
  return api.post<TaxonomyGroup>('/taxonomy/groups', data)
}

export function listTaxonomyTerms(groupId: string) {
  return api.get<TaxonomyTerm[]>(`/taxonomy/groups/${encodeURIComponent(groupId)}/terms`)
}

export function createTaxonomyTerm(
  groupId: string,
  data: { key_name: string; display_name: string; parent_id?: string | null },
) {
  return api.post<TaxonomyTerm>(`/taxonomy/groups/${encodeURIComponent(groupId)}/terms`, data)
}

export function seedTaxonomy() {
  return api.post<{ success: boolean; groups_created: number; terms_created: number }>('/taxonomy/seed')
}

export function getTaxonomyTree() {
  return api.get<TaxonomyGroupTree[]>('/taxonomy/tree')
}

export function getItemTaxonomy(itemId: string) {
  return api.get<ItemTaxonomyTerm[]>(`/items/${encodeURIComponent(itemId)}/taxonomy`)
}

export function setItemTaxonomy(itemId: string, termIds: string[]) {
  return api.put<{ success: boolean; item_id: string; term_ids: string[] }>(
    `/items/${encodeURIComponent(itemId)}/taxonomy`,
    { term_ids: termIds },
  )
}

export function updateItemColor(itemId: string, data: { primary_color?: string; colors?: string[] }) {
  return api.patch<unknown>(`/items/${encodeURIComponent(itemId)}/color`, data)
}

export function autoClassifyItem(itemId: string) {
  return api.post<{ success: boolean; term_ids: string[]; ai_content: string; detail?: string }>(
    `/items/${encodeURIComponent(itemId)}/ai-classify`,
  )
}
