import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/client'
import type { PaginatedResponse, RecordMaestro } from '../../api/types'

interface Props {
  sourceTable: string
  title: string
  hideTitle?: boolean
}

export default function TableRecordsList({ sourceTable, title, hideTitle }: Props) {
  const [records, setRecords] = useState<RecordMaestro[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Pagination
  const [page, setPage] = useState(1)
  const [pageSize] = useState(15)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  // Reset pagination when sourceTable changes
  useEffect(() => {
    setPage(1)
  }, [sourceTable])

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
    <div style={{ padding: hideTitle ? 0 : '0 1.5rem', margin: hideTitle ? 0 : '2rem auto', maxWidth: 1200 }}>
      {!hideTitle && (
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ margin: 0, fontSize: '2.25rem', fontWeight: 700 }}>{title}</h1>
          <p style={{ margin: '0.5rem 0 0 0', opacity: 0.8 }}>Listado de registros ({total} en total)</p>
        </div>
      )}

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
          {['CM', 'CS', 'CC'].includes(sourceTable) ? (
            <div style={{ overflowX: 'auto', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid rgba(255, 255, 255, 0.15)' }}>
                    <th style={th}>Indicador de registro</th>
                    <th style={th}>Transacción</th>
                    <th style={th}>Ciudad</th>
                    <th style={th}>Año</th>
                    {sourceTable === 'CM' && <th style={th}>Compañía</th>}
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)', transition: 'background 0.2s' }}>
                      <td style={td}>{r.id || '—'}</td>
                      <td style={td}>
                        {r.transaction_id ? (
                          <Link to={`/transactions/${r.transaction_id}`} style={{ fontWeight: 600, color: 'var(--primary-color, #ffaa00)', textDecoration: 'none' }}>
                            {r.transaction_id}
                          </Link>
                        ) : '—'}
                      </td>
                      <td style={td}>{r.city || '—'}</td>
                      <td style={td}>{r.year || '—'}</td>
                      {sourceTable === 'CM' && <td style={td}>{r.compania_id || '—'}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {records.map((r) => {
              // Define fields based on source table just like in TransactionDetail
              let defs: Array<{ key: keyof RecordMaestro, label: string, span?: number }> = []
              if (sourceTable === 'B') {
                defs = [
                  { key: 'autor_bib', label: 'Autores', span: 4 },
                  { key: 'titulo', label: 'Referencias bibliográficas', span: 4 }
                ]
              } else if (sourceTable === 'I') {
                defs = [
                  { key: 'noticia', label: 'Indicador', span: 4 },
                  { key: 'city', label: 'Ciudad' },
                  { key: 'year', label: 'Años' },
                  { key: 'concepto_caja', label: 'Concepto' },
                  { key: 'monto_reales', label: 'Monto' },
                  { key: 'notas', label: 'Notas', span: 4 }
                ]
              } else if (sourceTable === 'IdI') {
                defs = [
                  { key: 'documento', label: 'Documento', span: 4 },
                  { key: 'noticia', label: 'Otros datos para elaborar indicadores', span: 4 },
                  { key: 'city', label: 'Ciudad' },
                  { key: 'year', label: 'Años' },
                  { key: 'tipo_indicador', label: 'Categorías' },
                  { key: 'concepto_caja', label: 'Concepto', span: 2 },
                  { key: 'monto_reales', label: 'Monto' },
                  { key: 'notas', label: 'Nota', span: 4 },
                  { key: 'compania_id', label: 'Compañía' },
                  { key: 'fuente_bibliografica', label: 'Referencias bibliográficas', span: 4 },
                  { key: 'documento_codigo', label: 'Código documentos' }
                ]
              }
              
              const validDefs = defs.filter(d => r[d.key] != null && r[d.key] !== '')

              return (
                <div key={r.id} style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', padding: '2rem' }}>
                  <div style={{ marginBottom: '1.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.5rem', color: '#ffffff' }}>Indicador de registro: {r.id}</h3>
                    {r.transaction_id && (
                      <Link to={`/transactions/${r.transaction_id}`} style={{ fontWeight: 600, color: 'var(--primary-color, #ffaa00)', textDecoration: 'none' }}>
                        Ver Transacción: {r.transaction_id}
                      </Link>
                    )}
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem' }}>
                    {validDefs.length === 0 ? (
                       <pre style={{ opacity: 0.8, gridColumn: '1 / -1', whiteSpace: 'pre-wrap', overflowX: 'auto', background: 'rgba(0,0,0,0.5)', padding: '1rem', borderRadius: '8px' }}>
                         DEBUG RAW DATA:
                         {JSON.stringify(r, null, 2)}
                       </pre>
                    ) : (
                      validDefs.map((def) => (
                        <div key={def.key} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', gridColumn: def.span ? `span ${def.span}` : 'span 1' }}>
                          <span style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted, rgba(255,255,255,0.6))', fontWeight: 600 }}>
                            {def.label}
                          </span>
                          <span style={{ fontSize: '1.1rem', wordBreak: 'break-word', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                            {String(r[def.key])}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1.5rem', marginTop: '2rem' }}>
          {(() => {
            const maxPage = Math.max(1, Number(totalPages) || 1)
            return (
              <>
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  style={btn}
                >
                  ← Anterior
                </button>
                <span style={{ fontWeight: 500 }}>Página {page} de {maxPage}</span>
                <button
                  onClick={() => setPage((p) => Math.min(maxPage, p + 1))}
                  disabled={page >= maxPage}
                  style={btn}
                >
                  Siguiente →
                </button>
              </>
            )
          })()}
        </div>
      </>
    )}
  </div>
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
