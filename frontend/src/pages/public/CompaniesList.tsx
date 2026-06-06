import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { api } from '../../api/client'
import type { Company, PaginatedResponse } from '../../api/types'

export default function CompaniesList() {
  const { t } = useTranslation()
  const [companies, setCompanies] = useState<Company[]>([])
  const [filterText, setFilterText] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Pagination
  const [page, setPage] = useState(1)
  const [pageSize] = useState(15)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await api.get<PaginatedResponse<Company>>('/companies', {
          params: { page, page_size: pageSize },
        })
        if (!cancelled && res.data) {
          setCompanies(res.data.results)
          setTotal(res.data.total)
          setTotalPages(res.data.total_pages)
        }
      } catch {
        if (!cancelled) setError(t('errors.generic'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [page, pageSize, t])

  const filteredCompanies = companies.filter((c) => {
    const q = filterText.toLowerCase()
    return (
      c.siglas.toLowerCase().includes(q) ||
      c.autor_principal.toLowerCase().includes(q)
    )
  })

  return (
    <main style={{ maxWidth: 1200, margin: '2rem auto', padding: '0 1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2.25rem', fontWeight: 700 }}>{t('nav.companies')}</h1>
          <p style={{ margin: '0.5rem 0 0 0', opacity: 0.8 }}>Listado de compañías teatrales del Siglo de Oro ({total} en total)</p>
        </div>
        
        <input
          type="text"
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          placeholder="Filtrar por siglas o autor..."
          style={{
            padding: '0.6rem 1rem',
            borderRadius: '8px',
            border: '1px solid #ccc',
            fontSize: '1rem',
            width: '280px',
            background: 'rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(4px)',
            color: 'inherit',
          }}
        />
      </div>

      {error && <p style={{ color: '#ff6b6b', background: 'rgba(255, 107, 107, 0.1)', padding: '1rem', borderRadius: '8px' }}>{error}</p>}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ fontSize: '1.2rem', opacity: 0.7 }}>Cargando compañías...</p>
        </div>
      ) : filteredCompanies.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', border: '1px dashed #ccc', borderRadius: '12px' }}>
          <p style={{ fontSize: '1.2rem', opacity: 0.7 }}>No se encontraron compañías.</p>
        </div>
      ) : (
        <>
          <div style={{ overflowX: 'auto', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid rgba(255, 255, 255, 0.15)' }}>
                  <th style={th}>{t('company.siglas')}</th>
                  <th style={th}>{t('company.authors')}</th>
                  <th style={th}>{t('company.scope')}</th>
                  <th style={th}>{t('company.seasons')}</th>
                  <th style={th}>Transacciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredCompanies.map((c) => (
                  <tr key={c.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)', transition: 'background 0.2s' }}>
                    <td style={td}>
                      <Link to={`/companies/${c.id}`} style={{ fontWeight: 600, color: 'var(--primary-color, #ffaa00)', textDecoration: 'none' }}>
                        {c.siglas}
                      </Link>
                    </td>
                    <td style={td}>{c.autor_principal || '—'}</td>
                    <td style={td}>
                      <span style={{
                        padding: '0.2rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.85rem',
                        background: c.ambito === 'España' ? 'rgba(74, 144, 226, 0.2)' : 'rgba(80, 200, 120, 0.2)',
                        color: c.ambito === 'España' ? '#4a90e2' : '#50c878'
                      }}>
                        {c.ambito}
                      </span>
                    </td>
                    <td style={td}>{c.temporadas?.join(', ') || '—'}</td>
                    <td style={td}>
                      <span style={{ fontSize: '0.9rem', opacity: 0.8 }}>
                        {c.transaction_ids?.length || 0} vinculadas
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1.5rem', marginTop: '2rem' }}>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              style={btn}
            >
              ← Anterior
            </button>
            <span style={{ fontWeight: 500 }}>Página {page} de {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              style={btn}
            >
              Siguiente →
            </button>
          </div>
        </>
      )}
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
  whiteSpace: 'normal',
  wordBreak: 'break-word',
}

const btn: React.CSSProperties = {
  padding: '0.5rem 1rem',
  borderRadius: '6px',
  border: '1px solid rgba(255, 255, 255, 0.2)',
  background: 'rgba(255, 255, 255, 0.05)',
  color: 'inherit',
  cursor: 'pointer',
  transition: 'all 0.2s',
}
