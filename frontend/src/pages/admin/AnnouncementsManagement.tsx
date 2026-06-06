import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { api } from '../../api/client'
import { useAuth } from '../../hooks/useAuth'
import type { Announcement, PaginatedResponse } from '../../api/types'

const CATEGORIES = ['articulo', 'noticia_proyecto', 'convocatoria']
const IMPORTANCES = ['normal', 'destacado', 'urgente']

export default function AnnouncementsManagement() {
  const { t } = useTranslation()
  const { getToken, user } = useAuth()

  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Creation/Edit state
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [category, setCategory] = useState('noticia_proyecto')
  const [importance, setImportance] = useState('normal')
  const [expiresAt, setExpiresAt] = useState('')
  const [creating, setCreating] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const token = await getToken()
        const res = await api.get<PaginatedResponse<Announcement>>('/announcements', {
          headers: { Authorization: `Bearer ${token}` },
          params: { page_size: 100 }
        })
        if (!cancelled && res.data?.results) {
          setAnnouncements(res.data.results)
        }
      } catch {
        if (!cancelled) setError(t('errors.generic'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [getToken, t])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    setCreating(true)
    try {
      const token = await getToken()
      const payload = {
        title,
        body,
        category,
        importance,
        published_at: new Date().toISOString(),
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
        created_by: user?.uid || '',
      }

      const res = await api.post<Announcement>('/admin/announcements', payload, {
        headers: { Authorization: `Bearer ${token}` }
      })

      setAnnouncements((prev) => [res.data, ...prev])
      setTitle('')
      setBody('')
      setCategory('noticia_proyecto')
      setImportance('normal')
      setExpiresAt('')
    } catch (err: any) {
      setFormError(err.response?.data?.error?.message || t('errors.generic'))
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('¿Está seguro de que desea eliminar este anuncio?')) return
    try {
      const token = await getToken()
      await api.delete(`/admin/announcements/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setAnnouncements((prev) => prev.filter((a) => a.id !== id))
    } catch {
      setError(t('errors.generic'))
    }
  }

  if (loading) return <main style={{ maxWidth: 1200, margin: '2rem auto', padding: '0 1.5rem' }}><p>Cargando anuncios...</p></main>

  return (
    <main style={{ maxWidth: 1200, margin: '2rem auto', padding: '0 1.5rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <Link to="/admin" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', fontWeight: 500 }}>
          ← Volver al Panel
        </Link>
      </div>

      <h1 style={{ marginBottom: '2rem' }}>Gestión de Anuncios</h1>
      {error && <p style={{ color: '#ff6b6b', background: 'rgba(255, 107, 107, 0.1)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>{error}</p>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
        {/* Formulario de creación */}
        <section style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', padding: '1.5rem' }}>
          <h2 style={{ marginTop: 0, marginBottom: '1.25rem', fontSize: '1.35rem' }}>Publicar Nuevo Anuncio</h2>
          
          {formError && <p style={{ color: '#ff6b6b', background: 'rgba(255, 107, 107, 0.1)', padding: '0.75rem', borderRadius: '6px', fontSize: '0.9rem' }}>{formError}</p>}

          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.9rem' }}>
              Título del Anuncio
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.9rem' }}>
              Contenido (Cuerpo)
              <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} required style={{ resize: 'vertical' }} />
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.9rem' }}>
                Categoría
                <select value={category} onChange={(e) => setCategory(e.target.value)}>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {t(`announcements.categories.${c}`, { defaultValue: c })}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.9rem' }}>
                Importancia
                <select value={importance} onChange={(e) => setImportance(e.target.value)}>
                  {IMPORTANCES.map((i) => (
                    <option key={i} value={i}>{i.toUpperCase()}</option>
                  ))}
                </select>
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.9rem' }}>
                Fecha de Expiración (Opcional)
                <input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button type="submit" disabled={creating} style={{ padding: '0.75rem 2rem' }}>
                {creating ? 'Publicando...' : 'Publicar Anuncio'}
              </button>
            </div>
          </form>
        </section>

        {/* Listado de anuncios */}
        <section style={{ background: 'rgba(255, 255, 255, 0.02)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.08)', padding: '1.5rem' }}>
          <h2 style={{ marginTop: 0, marginBottom: '1.25rem', fontSize: '1.35rem' }}>Anuncios Publicados ({announcements.length})</h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {announcements.map((ann) => {
              const isExpired = ann.expires_at && new Date(ann.expires_at) < new Date()
              return (
                <div key={ann.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', padding: '1rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                  <div>
                    <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.1rem' }}>
                      {ann.title}{' '}
                      <span style={{ fontSize: '0.8rem', padding: '2px 6px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', color: 'var(--text-muted)' }}>
                        {ann.importance}
                      </span>
                      {isExpired && (
                        <span style={{ fontSize: '0.8rem', padding: '2px 6px', background: 'rgba(239, 68, 68, 0.2)', borderRadius: '4px', color: '#ef4444', marginLeft: '0.5rem' }}>
                          Expirado
                        </span>
                      )}
                    </h3>
                    <small style={{ color: 'var(--text-muted)' }}>
                      Publicado: {new Date(ann.published_at).toLocaleString()}
                      {ann.expires_at && ` | Expiración: ${new Date(ann.expires_at).toLocaleString()}`}
                    </small>
                    <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.95rem', opacity: 0.9 }}>{ann.body}</p>
                  </div>
                  <button
                    onClick={() => handleDelete(ann.id)}
                    style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: 'none', padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                  >
                    Eliminar
                  </button>
                </div>
              )
            })}
          </div>
        </section>
      </div>
    </main>
  )
}
