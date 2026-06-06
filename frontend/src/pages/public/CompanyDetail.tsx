import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../../api/client'
import type { Company } from '../../api/types'

export default function CompanyDetail() {
  const { id } = useParams<{ id: string }>()
  const { t } = useTranslation()
  const [company, setCompany] = useState<Company | null>(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!id) return
    api
      .get<Company>(`/companies/${id}`)
      .then((res) => {
        if (res.data) setCompany(res.data)
        else setNotFound(true)
      })
      .catch((err) => {
        if (err.response?.status === 404) setNotFound(true)
      })
  }, [id])

  if (notFound) {
    return (
      <main style={{ maxWidth: 800, margin: '2rem auto', padding: '0 1rem' }}>
        <p>{t('errors.not_found')}</p>
      </main>
    )
  }

  if (!company) return <main style={{ maxWidth: 800, margin: '2rem auto', padding: '0 1rem' }}><p>…</p></main>

  return (
    <main style={{ maxWidth: 800, margin: '2rem auto', padding: '0 1rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <Link to="/companies" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', fontWeight: 500 }}>
          ← Volver a Compañías
        </Link>
      </div>

      <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', padding: '2rem', marginBottom: '2rem' }}>
        <h1 style={{ marginTop: 0, marginBottom: '0.5rem' }}>{company.autor_principal || company.siglas}</h1>
        <p style={{ fontSize: '1.2rem', opacity: 0.8, color: 'var(--primary-color)', marginTop: 0, marginBottom: '1.5rem' }}>
          Siglas: {company.siglas}
        </p>

        <dl style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: '1rem 0.5rem', margin: 0 }}>
          <dt style={{ fontWeight: 600, opacity: 0.7 }}>{t('company.authors')}:</dt>
          <dd style={{ margin: 0 }}>{company.autor_principal || '—'}</dd>

          <dt style={{ fontWeight: 600, opacity: 0.7 }}>{t('company.seasons')}:</dt>
          <dd style={{ margin: 0 }}>{company.temporadas.join(', ') || '—'}</dd>

          <dt style={{ fontWeight: 600, opacity: 0.7 }}>{t('company.scope')}:</dt>
          <dd style={{ margin: 0 }}>{company.ambito || '—'}</dd>
        </dl>
      </div>

      <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', padding: '2rem' }}>
        <h2 style={{ marginTop: 0 }}>{t('company.transactions')}</h2>
        {company.transaction_ids.length === 0 ? (
          <p style={{ margin: 0, opacity: 0.7 }}>No hay transacciones vinculadas.</p>
        ) : (
          <ul style={{ paddingLeft: '1.5rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {company.transaction_ids.map((tid) => (
              <li key={tid}>
                <Link to={`/transactions/${tid}`} style={{ fontWeight: 500 }}>
                  {tid}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}
