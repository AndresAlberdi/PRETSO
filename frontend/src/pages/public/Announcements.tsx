import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../../api/client'
import type { Announcement, PaginatedResponse } from '../../api/types'

export default function Announcements() {
  const { t } = useTranslation()
  const [items, setItems] = useState<Announcement[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api
      .get<PaginatedResponse<Announcement>>('/announcements', { params: { page, page_size: 10 } })
      .then((res) => {
        if (res.data) {
          setItems(res.data.results)
          setTotalPages(res.data.total_pages)
        }
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [page])

  return (
    <main style={{ maxWidth: 800, margin: '2rem auto', padding: '0 1.5rem' }}>
      <h1 style={{ marginBottom: '2rem' }}>{t('announcements.title')}</h1>

      {loading && <p style={{ opacity: 0.7 }}>Cargando anuncios...</p>}

      {!loading && items.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem', border: '1px dashed rgba(255, 255, 255, 0.2)', borderRadius: '12px' }}>
          <p style={{ opacity: 0.7 }}>No hay anuncios disponibles en este momento.</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {items.map((ann) => {
          const isUrgent = ann.importance === 'urgente'
          const isFeatured = ann.importance === 'destacado'
          
          let borderStyle = '1px solid rgba(255, 255, 255, 0.08)'
          let backgroundStyle = 'rgba(255, 255, 255, 0.02)'
          if (isUrgent) {
            borderStyle = '1px solid rgba(239, 68, 68, 0.4)'
            backgroundStyle = 'rgba(239, 68, 68, 0.05)'
          } else if (isFeatured) {
            borderStyle = '1px solid rgba(241, 176, 76, 0.4)'
            backgroundStyle = 'rgba(241, 176, 76, 0.05)'
          }

          return (
            <article key={ann.id} style={{ border: borderStyle, background: backgroundStyle, borderRadius: '12px', padding: '1.5rem', transition: 'transform 0.2s' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <h2 style={{ margin: 0, fontSize: '1.25rem', fontFamily: 'var(--font-serif)', color: '#fff' }}>{ann.title}</h2>
                  
                  <span style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '4px',
                    padding: '2px 8px',
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)'
                  }}>
                    {t(`announcements.categories.${ann.category}`, { defaultValue: ann.category })}
                  </span>

                  {isUrgent && (
                    <span style={{ background: '#ef4444', color: '#fff', borderRadius: '4px', padding: '2px 8px', fontSize: '0.75rem', fontWeight: 600 }}>
                      Urgente
                    </span>
                  )}
                  {isFeatured && (
                    <span style={{ background: '#f1b04c', color: '#0b0f19', borderRadius: '4px', padding: '2px 8px', fontSize: '0.75rem', fontWeight: 600 }}>
                      Destacado
                    </span>
                  )}
                </div>
                
                <small style={{ color: 'var(--text-muted)' }}>
                  {new Date(ann.published_at).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}
                </small>
              </div>
              
              <p style={{ marginTop: 0, marginBottom: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{ann.body}</p>
            </article>
          )
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1.5rem', marginTop: '2rem' }}>
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '6px',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            background: 'rgba(255, 255, 255, 0.05)',
            color: 'inherit',
            cursor: 'pointer'
          }}
        >
          ← Anterior
        </button>
        <span style={{ fontWeight: 500 }}>Página {page} de {totalPages}</span>
        <button
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page === totalPages}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '6px',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            background: 'rgba(255, 255, 255, 0.05)',
            color: 'inherit',
            cursor: 'pointer'
          }}
        >
          Siguiente →
        </button>
      </div>
    </main>
  )
}
