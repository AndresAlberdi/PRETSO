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
  autor_bib?: string | null
  autores?: string | null
  titulo?: string | null
  concepto_caja?: string | null
  compania_id?: string | null
  tipo_indicador?: string | null
  notas?: string | null
  documento?: string | null
  documento_codigo?: string | null
  otros_bienes?: string | null
  normativa_caja?: string | null
  pagador?: string | null
  beneficiario?: string | null
  dias_racion?: string | null
  representaciones_ano?: string | null
  representaciones_estimadas?: string | null
  encargado?: string | null
  fondos?: string | null
  cargo?: string | null
  valor_indicador?: string | null
  salario_diario?: number | null
  festividad?: string | null
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
