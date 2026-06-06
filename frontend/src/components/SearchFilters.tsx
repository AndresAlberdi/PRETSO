import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'
import type { Company, PaginatedResponse } from '../api/types'

const CITIES = ['Badajoz', 'Ciudad de México', 'Madrid', 'Sevilla', 'Toledo', 'Valladolid']

const SOURCE_TABLES = [
  { value: 'B', label: 'Bibliografía' },
  { value: 'CM', label: 'Compañías — Caja' },
  { value: 'CS', label: 'Compañías — Salarios' },
  { value: 'CC', label: 'Corpus Christi' },
  { value: 'IdI', label: 'Identificación de indicadores' },
  { value: 'I', label: 'Indicadores' },
  { value: 'Com', label: 'Índice de compañías' },
]

const EMPTY: Filters = { city: '', year_from: '', year_to: '', source_table: '', company: '' }

export interface Filters {
  city: string
  year_from: string
  year_to: string
  source_table: string
  company: string
}

interface Props {
  filters: Filters
  onChange: (filters: Filters) => void
}

export default function SearchFilters({ filters, onChange }: Props) {
  const { t } = useTranslation()
  const [companies, setCompanies] = useState<Company[]>([])

  useEffect(() => {
    api.get<PaginatedResponse<Company>>('/companies', { params: { page_size: 100 } })
      .then((res) => {
        if (res.data?.results) {
          const sorted = [...res.data.results].sort((a, b) =>
            (a.autor_principal || '').localeCompare(b.autor_principal || '')
          )
          setCompanies(sorted)
        }
      })
      .catch(() => {})
  }, [])

  function set(key: keyof Filters, value: string) {
    onChange({ ...filters, [key]: value })
  }

  return (
    <fieldset style={{ border: '1px solid rgba(255, 255, 255, 0.1)', padding: '1.25rem', borderRadius: 8, background: 'rgba(255, 255, 255, 0.02)' }}>
      <legend style={{ padding: '0 0.5rem', color: 'var(--primary-color)' }}>{t('search.filters')}</legend>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.9rem', opacity: 0.9 }}>
          {t('search.city')}
          <select value={filters.city} onChange={(e) => set('city', e.target.value)} style={{ display: 'block', width: '100%' }}>
            <option value="">—</option>
            {CITIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.9rem', opacity: 0.9 }}>
          {t('search.year_from')}
          <input
            type="number"
            min={1525}
            max={1650}
            value={filters.year_from}
            onChange={(e) => set('year_from', e.target.value)}
            style={{ display: 'block', width: '100%' }}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.9rem', opacity: 0.9 }}>
          {t('search.year_to')}
          <input
            type="number"
            min={1525}
            max={1650}
            value={filters.year_to}
            onChange={(e) => set('year_to', e.target.value)}
            style={{ display: 'block', width: '100%' }}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.9rem', opacity: 0.9 }}>
          {t('search.source_table')}
          <select value={filters.source_table} onChange={(e) => set('source_table', e.target.value)} style={{ display: 'block', width: '100%' }}>
            <option value="">—</option>
            {SOURCE_TABLES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.9rem', opacity: 0.9 }}>
          {t('search.company')}
          <select value={filters.company} onChange={(e) => set('company', e.target.value)} style={{ display: 'block', width: '100%' }}>
            <option value="">—</option>
            {companies.map((c) => (
              <option key={c.siglas} value={c.siglas}>
                {c.autor_principal ? `${c.autor_principal} (${c.siglas})` : c.siglas}
              </option>
            ))}
          </select>
        </label>
      </div>

      <button
        type="button"
        onClick={() => onChange(EMPTY)}
        style={{ marginTop: '1rem', padding: '0.5rem 1rem', background: 'transparent', border: '1px solid rgba(255, 255, 255, 0.2)', color: 'white', fontSize: '0.85rem' }}
      >
        Limpiar filtros
      </button>
    </fieldset>
  )
}
