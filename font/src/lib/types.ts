export interface ItemTags {
  colors: string[]
  primary_color?: string
  pattern?: string
  material?: string
  style: string[]
  season: string[]
  formality?: string
  fit?: string
  occasion?: string[]
  brand?: string
  condition?: string
  features?: string[]
  logprobs_confidence?: number
}

export interface ItemImage {
  id: string
  item_id: string
  image_path: string
  thumbnail_path?: string
  medium_path?: string
  position: number
  created_at: string
  image_url: string
  thumbnail_url?: string
  medium_url?: string
}

export interface Item {
  id: string
  user_id: string
  wardrobe_id?: string | null
  type: string
  subtype?: string
  name?: string
  brand?: string
  notes?: string
  purchase_date?: string
  purchase_price?: number
  favorite: boolean
  image_path: string
  thumbnail_path?: string
  medium_path?: string
  image_url?: string
  thumbnail_url?: string
  medium_url?: string
  tags: ItemTags
  colors: string[]
  primary_color?: string
  status: 'processing' | 'ready' | 'error' | 'archived'
  ai_processed: boolean
  ai_confidence?: number
  ai_description?: string
  wear_count: number
  last_worn_at?: string
  last_suggested_at?: string
  suggestion_count: number
  acceptance_count: number
  wears_since_wash: number
  last_washed_at?: string
  wash_interval?: number
  needs_wash: boolean
  effective_wash_interval: number
  additional_images: ItemImage[]
  taxonomy_type_label?: string
  taxonomy_color_labels?: string[]
  is_archived: boolean
  archived_at?: string
  archive_reason?: string
  created_at: string
  updated_at: string
}

export interface ItemListResponse {
  items: Item[]
  total: number
  page: number
  page_size: number
  has_more: boolean
}
