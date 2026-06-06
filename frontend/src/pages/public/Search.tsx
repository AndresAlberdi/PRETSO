import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { api } from '../../api/client'
import type { SearchResponse, SearchResult } from '../../api/types'
import SearchFilters, { type Filters } from '../../components/SearchFilters'
import { useAuth } from '../../hooks/useAuth'
import { useSearchHistory } from '../../hooks/useSearchHistory'

const EMPTY_FILTERS: Filters = {
  city: '',
  year_from: '',
  year_to: '',
  source_table: '',
  company: '',
}

export default function Search() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { history, addSearch, clearHistory } = useSearchHistory()
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [results, setResults] = useState<SearchResult[]>([])
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [searched, setSearched] = useState(false)
  const [loading, setLoading] = useState(false)

  async function doSearch(p = 1, queryOverride?: string, filtersOverride?: Filters) {
    setLoading(true)
    const activeQuery = queryOverride !== undefined ? queryOverride : query
    const activeFilters = filtersOverride !== undefined ? filtersOverride : filters
    try {
      const params: Record<string, string | number> = { q: activeQuery, page: p, page_size: 20 }
      if (activeFilters.city) params.city = activeFilters.city
      if (activeFilters.year_from) params.year_from = activeFilters.year_from
      if (activeFilters.year_to) params.year_to = activeFilters.year_to
      if (activeFilters.source_table) params.source_table = activeFilters.source_table
      if (activeFilters.company) params.company = activeFilters.company

      const res = await api.get<SearchResponse>('/search', { params })
      if (res.data) {
        setResults(res.data.results)
        setSuggestions(res.data.suggestions ?? [])
        setTotal(res.data.total)
        setTotalPages(Math.ceil(res.data.total / 20) || 1)
        setPage(p)
        if (user) {
          addSearch(params)
        }
      }
    } catch {
      setResults([])
    } finally {
      setLoading(false)
      setSearched(true)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    doSearch(1)
  }

  function handleReRunSearch(entryParams: any) {
    const qOverride = entryParams.q || ''
    const filtersOverride = {
      city: entryParams.city || '',
      year_from: entryParams.year_from || '',
      year_to: entryParams.year_to || '',
      source_table: entryParams.source_table || '',
      company: entryParams.company || '',
    }
    setQuery(qOverride)
    setFilters(filtersOverride)
    doSearch(1, qOverride, filtersOverride)
  }

  function handleExportCSV() {
    const params: Record<string, string | number> = {}
    if (query) params.q = query
    if (filters.city) params.city = filters.city
    if (filters.year_from) params.year_from = filters.year_from
    if (filters.year_to) params.year_to = filters.year_to
    if (filters.source_table) params.source_table = filters.source_table
    if (filters.company) params.company = filters.company

    api.get('/search/export', { params, responseType: 'blob' })
      .then((res) => {
        const url = window.URL.createObjectURL(new Blob([res.data]))
        const link = document.createElement('a')
        link.href = url
        link.setAttribute('download', 'pretso_export.csv')
        document.body.appendChild(link)
        link.click()
        link.remove()
      })
      .catch(() => {
        alert('Error al exportar CSV')
      })
  }

  function handleExportClick() {
    if (total > 100) {
      const confirmExport = window.confirm(`Su búsqueda arrojó ${total} registros. Para evitar sobrecargas, el sistema solo exportará los primeros 100 registros. ¿Desea continuar?`)
      if (!confirmExport) return
    }
    handleExportCSV()
  }

  return (
    <main style={{ maxWidth: 1200, margin: '2rem auto', padding: '0 1.5rem' }}>
      <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
        
        {/* Main Search Panel */}
        <div style={{ flex: '3 1 600px' }}>
          <h1 style={{ marginBottom: '1.5rem', fontSize: '2.25rem', fontWeight: 700 }}>{t('nav.search')}</h1>

          <form onSubmit={handleSubmit} style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('search.placeholder')}
                style={{
                  flex: 1,
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  border: '1px solid #ccc',
                  background: 'rgba(255, 255, 255, 0.05)',
                  color: 'inherit',
                  fontSize: '1rem',
                }}
              />
              <button
                type="submit"
                style={{
                  padding: '0.75rem 1.5rem',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'var(--primary-color, #ffaa00)',
                  color: '#111',
                  fontWeight: 600,
                  fontSize: '1rem',
                  cursor: 'pointer',
                }}
              >
                {t('search.button')}
              </button>
            </div>
            <SearchFilters filters={filters} onChange={setFilters} />
          </form>

          {loading && <p style={{ fontSize: '1.1rem', opacity: 0.8 }}>Buscando...</p>}

          {searched && !loading && (
            <div style={{ marginBottom: '1.5rem', fontSize: '1.1rem', fontWeight: 500, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                Registros encontrados: <strong style={{ color: 'var(--primary-color)' }}>{total}</strong>
              </div>
              {results.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                  <button
                    onClick={handleExportClick}
                    style={{
                      padding: '0.5rem 1rem',
                      borderRadius: '8px',
                      border: '1px solid var(--primary-color, #ffaa00)',
                      background: 'transparent',
                      color: 'var(--primary-color, #ffaa00)',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    Exportar CSV (Máx 100)
                  </button>
                  {total > 100 && <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>Solo se incluirán los primeros 100.</span>}
                </div>
              )}
            </div>
          )}

          {searched && !loading && results.length === 0 && (
            <div style={{ padding: '2rem', border: '1px dashed #ccc', borderRadius: '12px', textAlign: 'center' }}>
              <p style={{ fontSize: '1.1rem', margin: 0 }}>{t('search.no_results')}</p>
              {suggestions.length > 0 && (
                <div style={{ marginTop: '1.5rem', textAlign: 'left' }}>
                  <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>{t('search.suggestions')}</p>
                  <ul style={{ paddingLeft: '1.5rem', margin: 0 }}>
                    {suggestions.map((s, i) => (
                      <li key={i} style={{ color: 'var(--primary-color, #ffaa00)', cursor: 'pointer', textDecoration: 'underline', marginBottom: '0.3rem' }} onClick={() => { setQuery(s); doSearch(1, s); }}>
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {results.length > 0 && (
            <>
              <div style={{ overflowX: 'auto', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.1)', marginBottom: '1.5rem' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid rgba(255, 255, 255, 0.15)' }}>
                      <th style={th}>ID</th>
                      <th style={th}>{t('record.transaction')}</th>
                      <th style={th}>{t('record.city')}</th>
                      <th style={th}>{t('record.year')}</th>
                      <th style={th}>Noticia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r) => (
                      <tr key={r.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                        <td style={td}>{r.id}</td>
                        <td style={td}>
                          <Link to={`/transactions/${r.transaction_id}`} style={{ color: 'var(--primary-color, #ffaa00)', textDecoration: 'none', fontWeight: 500 }}>
                            {r.transaction_id}
                          </Link>
                        </td>
                        <td style={td}>{r.city}</td>
                        <td style={td}>{r.year}</td>
                        <td style={{ ...td, fontSize: '0.95rem', opacity: 0.9 }}>{r.noticia_fragment}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1.5rem', marginTop: '1.5rem' }}>
                <button
                  onClick={() => doSearch(page - 1)}
                  disabled={page === 1}
                  style={paginationBtn}
                >
                  ← Anterior
                </button>
                <span>Página {page} de {totalPages}</span>
                <button
                  onClick={() => doSearch(page + 1)}
                  disabled={page === totalPages}
                  style={paginationBtn}
                >
                  Siguiente →
                </button>
              </div>
            </>
          )}
        </div>

        {/* Sidebar History Panel */}
        <div style={{ flex: '1 1 250px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '12px', padding: '1.5rem', border: '1px solid rgba(255, 255, 255, 0.08)', alignSelf: 'flex-start' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600 }}>Historial</h3>
            {history.length > 0 && (
              <button
                onClick={clearHistory}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#ff6b6b',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  padding: 0,
                }}
              >
                Limpiar
              </button>
            )}
          </div>
          {history.length === 0 ? (
            <p style={{ fontSize: '0.9rem', opacity: 0.6, margin: 0 }}>No hay búsquedas recientes.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {history.map((h, i) => {
                const p = h.params as any
                const filterDesc = [
                  p.city ? `Ciudad: ${p.city}` : '',
                  p.year_from ? `>= ${p.year_from}` : '',
                  p.year_to ? `<= ${p.year_to}` : '',
                  p.source_table ? `Tabla: ${p.source_table}` : '',
                  p.company ? `Comp: ${p.company}` : '',
                ].filter(Boolean).join(', ')

                return (
                  <li key={i} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '0.75rem' }}>
                    <button
                      onClick={() => handleReRunSearch(p)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'inherit',
                        textAlign: 'left',
                        cursor: 'pointer',
                        padding: 0,
                        width: '100%',
                        display: 'block',
                      }}
                    >
                      <strong style={{ color: 'var(--primary-color, #ffaa00)', fontSize: '0.95rem', display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {p.q || '(Sin texto)'}
                      </strong>
                      {filterDesc && (
                        <div style={{ fontSize: '0.8rem', opacity: 0.7, marginTop: '0.2rem', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {filterDesc}
                        </div>
                      )}
                      <div style={{ fontSize: '0.7rem', opacity: 0.5, marginTop: '0.2rem' }}>
                        {new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

      </div>
    </main>
  )
}

const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '1rem',
  fontWeight: 600,
  opacity: 0.9,
}

const td: React.CSSProperties = {
  padding: '1rem',
  verticalAlign: 'middle',
}

const paginationBtn: React.CSSProperties = {
  padding: '0.5rem 1rem',
  borderRadius: '6px',
  border: '1px solid rgba(255, 255, 255, 0.2)',
  background: 'rgba(255, 255, 255, 0.05)',
  color: 'inherit',
  cursor: 'pointer',
  transition: 'all 0.2s',
}

