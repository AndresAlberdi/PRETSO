import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../../api/client'
import type { Transaction, RecordMaestro, Company, PaginatedResponse } from '../../api/types'

const MARAVEDIS_PER_REAL = 34

const TABLE_NAMES: Record<string, string> = {
  B: 'Bibliografía',
  CM: 'Compañías — Caja',
  CS: 'Compañías — Salarios',
  CC: 'Corpus Christi',
  IdI: 'Identificación de indicadores',
  I: 'Indicadores',
  Com: 'Índice de compañías',
}

export default function TransactionDetail() {
  const { id } = useParams<{ id: string }>()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [transaction, setTransaction] = useState<Transaction | null>(null)
  const [company, setCompany] = useState<Company | null>(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!id) return
    api
      .get<Transaction>(`/transactions/${id}`)
      .then((res) => {
        if (res.data) {
          setTransaction(res.data)
          // Find if there is a company associated
          const firstRecord = res.data.records?.find(r => r.compania_id)
          if (firstRecord?.compania_id) {
            api.get<PaginatedResponse<Company>>('/companies', { params: { page_size: 100 } })
              .then((cRes) => {
                const found = cRes.data?.results?.find(c => c.siglas === firstRecord.compania_id)
                if (found) {
                  setCompany(found)
                }
              })
              .catch(() => {})
          }
        }
        else setNotFound(true)
      })
      .catch((err) => {
        if (err.response?.status === 404) setNotFound(true)
      })
  }, [id])

  if (notFound) {
    return (
      <main style={{ maxWidth: 1000, margin: '2rem auto', padding: '0 1.5rem' }}>
        <p>{t('errors.not_found')}</p>
      </main>
    )
  }

  if (!transaction) return <main style={{ maxWidth: 1000, margin: '2rem auto', padding: '0 1.5rem' }}><p>…</p></main>

  const records: RecordMaestro[] = transaction.records ?? []

  // Group records by source_table
  const grouped = records.reduce<Record<string, RecordMaestro[]>>((acc, r) => {
    const key = r.source_table
    if (!acc[key]) acc[key] = []
    acc[key].push(r)
    return acc
  }, {})

  return (
    <main style={{ maxWidth: 1000, margin: '2rem auto', padding: '0 1.5rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--primary-color)',
            cursor: 'pointer',
            padding: 0,
            fontSize: '1rem',
            fontWeight: 500,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          ← Volver
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ margin: 0 }}>Transacción: {transaction.id}</h1>
      </div>

      {company && (
        <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', padding: '1.5rem', marginBottom: '2rem' }}>
          <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1.1rem', color: 'var(--primary-color)' }}>Compañía Asociada</h3>
          <p style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', fontWeight: 600 }}>
            {company.autor_principal} ({company.siglas})
          </p>
          <div style={{ display: 'flex', gap: '2rem', marginTop: '0.5rem', fontSize: '0.95rem', opacity: 0.8 }}>
            <span><strong>Ámbito:</strong> {company.ambito}</span>
            <span><strong>Temporadas:</strong> {company.temporadas.join(', ')}</span>
            <span>
              <Link to={`/companies/${company.id}`} style={{ fontWeight: 500, color: 'var(--primary-color)' }}>
                Ver perfil completo →
              </Link>
            </span>
          </div>
        </div>
      )}

      {Object.entries(grouped).map(([table, rows]) => (
        <section key={table} style={{ marginBottom: '2.5rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.08)', padding: '1.5rem' }}>
          <h2 style={{ marginTop: 0, marginBottom: '1.25rem', fontSize: '1.35rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '0.5rem', color: '#fff' }}>
            Tabla: {TABLE_NAMES[table] || table}
          </h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid rgba(255, 255, 255, 0.15)' }}>
                  <th style={th}>ID</th>
                  <th style={th}>{t('record.city')}</th>
                  <th style={th}>{t('record.year')}</th>
                  <th style={th}>Noticia Completa</th>
                  <th style={th}>{t('record.amount')}</th>
                  <th style={th}>{t('record.amount_maravedis')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const maravedis =
                    r.monto_reales != null ? r.monto_reales * MARAVEDIS_PER_REAL : null
                  return (
                    <tr key={r.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      <td style={td}>{r.id}</td>
                      <td style={td}>{r.city}</td>
                      <td style={td}>{r.year}</td>
                      <td style={{ ...td, lineHeight: 1.5 }}>{r.noticia}</td>
                      <td style={td}>{r.monto_reales ?? '—'}</td>
                      <td style={td}>{maravedis != null ? maravedis : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </main>
  )
}

const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '1rem',
  fontWeight: 600,
  opacity: 0.9,
  fontSize: '0.9rem',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--text-muted)',
  borderBottom: '2px solid rgba(255, 255, 255, 0.15)',
}

const td: React.CSSProperties = {
  padding: '1rem',
  verticalAlign: 'top',
  whiteSpace: 'normal',
  wordBreak: 'break-word',
}
