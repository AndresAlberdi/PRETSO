import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/client'
import type { PaginatedResponse, RecordMaestro } from '../../api/types'

interface Props {
  sourceTable: string
  title: string
}

export default function TableRecordsList({ sourceTable, title }: Props) {
  const [records, setRecords] = useState<RecordMaestro[]>([])
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
        const res = await api.get<PaginatedResponse<RecordMaestro>>('/search', {
          params: { page, page_size: pageSize, source_table: sourceTable },
        })
        if (!cancelled && res.data) {
          setRecords(res.data.results)
          setTotal(res.data.total)
          setTotalPages(res.data.total_pages)
        }
      } catch {
        if (!cancelled) setError('Error al cargar los registros.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [page, pageSize, sourceTable])

  return (
    <main style={{ maxWidth: 1200, margin: '2rem auto', padding: '0 1.5rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ margin: 0, fontSize: '2.25rem', fontWeight: 700 }}>{title}</h1>
        <p style={{ margin: '0.5rem 0 0 0', opacity: 0.8 }}>Listado de registros ({total} en total)</p>
      </div>

      {error && <p style={{ color: '#ff6b6b', background: 'rgba(255, 107, 107, 0.1)', padding: '1rem', borderRadius: '8px' }}>{error}</p>}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ fontSize: '1.2rem', opacity: 0.7 }}>Cargando registros...</p>
        </div>
      ) : records.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', border: '1px dashed #ccc', borderRadius: '12px' }}>
          <p style={{ fontSize: '1.2rem', opacity: 0.7 }}>No se encontraron registros en esta tabla.</p>
        </div>
      ) : (
        <>
          <div style={{ overflowX: 'auto', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid rgba(255, 255, 255, 0.15)' }}>
                  <th style={th}>Ciudad</th>
                  <th style={th}>Año</th>
                  <th style={th}>Noticia / Descripción</th>
                  <th style={th}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)', transition: 'background 0.2s' }}>
                    <td style={td}>{r.city || '—'}</td>
                    <td style={td}>{r.year || '—'}</td>
                    <td style={{ ...td, maxWidth: '400px' }}>
                      <div style={{ 
                        display: '-webkit-box', 
                        WebkitLineClamp: 3, 
                        WebkitBoxOrient: 'vertical', 
                        overflow: 'hidden',
                        textOverflow: 'ellipsis' 
                      }}>
                        {r.noticia || '—'}
                      </div>
                    </td>
                    <td style={td}>
                      <Link to={`/transactions/${r.transaction_id}`} style={{ fontWeight: 600, color: 'var(--primary-color, #ffaa00)', textDecoration: 'none' }}>
                        Ver detalle
                      </Link>
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
