export interface RecordMaestro {
  id: string
  transaction_id: string
  source_table: string
  status: string
  city: string
  year: number | null
  noticia: string
  fuente_bibliografica: string
  monto_reales?: number | null
  [key: string]: unknown
}

export interface PaginatedResponse<T> {
  results: T[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface SearchResponse {
  results: SearchResult[]
  total: number
  page: number
  page_size: number
  suggestions: string[]
}

export interface SearchResult {
  id: string
  transaction_id: string
  city: string
  year: number | null
  noticia_fragment: string
  score: number
}

export interface Company {
  id: string
  siglas: string
  autor_principal: string
  temporadas: string[]
  ambito: string
  transaction_ids: string[]
}

export interface Announcement {
  id: string
  title: string
  body: string
  category: string
  published_at: string
  created_by: string
  expires_at?: string
  importance?: string
}

export interface LaunchStatus {
  published_count: number
  threshold: number
  portal_active: boolean
}

export interface Transaction {
  id: string
  record_ids: string[]
  records: RecordMaestro[]
}
