import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api/client'
import { useAuth } from '../../hooks/useAuth'

const STATUS_LABELS: Record<string, string> = {
  borrador: 'Borrador',
  en_revision: 'En revisión',
  publicado: 'Publicado',
  rechazado: 'Rechazado',
}

const STATUS_COLORS: Record<string, string> = {
  borrador: '#888',
  en_revision: '#e65100',
  publicado: '#2e7d32',
  rechazado: '#d32f2f',
}

interface RecordRow {
  id: string
  transaction_id: string
  source_table: string
  status: string
  city: string
  year: number | null
  noticia: string
}

export default function RecordsList() {
  const { getToken } = useAuth()
  const navigate = useNavigate()

  const [records, setRecords] = useState<RecordRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)

  const PAGE_SIZE = 25

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const token = await getToken()
        const params: Record<string, string | number> = { page, page_size: PAGE_SIZE }
        if (statusFilter) params.status = statusFilter

        const res = await api.get<{ results: RecordRow[]; total: number }>(
          '/admin/records',
          { headers: { Authorization: `Bearer ${token}` }, params }
        )
        if (!cancelled && res.data) {
          setRecords(res.data.results ?? [])
          setTotal(res.data.total ?? 0)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [page, statusFilter, getToken])

  const totalPages = Math.ceil(total / PAGE_SIZE) || 1

  const handleApprove = async (id: string, currentStatus: string) => {
    try {
      const token = await getToken()
      const headers = { Authorization: `Bearer ${token}` }
      if (currentStatus === 'borrador') {
        await api.put(`/admin/records/${id}/status`, { new_status: 'en_revision' }, { headers })
      }
      await api.put(`/admin/records/${id}/status`, { new_status: 'publicado' }, { headers })
      setRecords((prev) => prev.map(r => r.id === id ? { ...r, status: 'publicado' } : r))
    } catch (e) {
      alert('Error al aprobar')
    }
  }

  const handleReject = async (id: string) => {
    const reason = window.prompt("Motivo de rechazo (min 10 caracteres):")
    if (!reason || reason.length < 10) {
      if (reason !== null) alert("El motivo debe tener al menos 10 caracteres.")
      return
    }
    try {
      const token = await getToken()
      const headers = { Authorization: `Bearer ${token}` }
      await api.put(`/admin/records/${id}/status`, { new_status: 'rechazado', rejection_comment: reason }, { headers })
      setRecords((prev) => prev.map(r => r.id === id ? { ...r, status: 'rechazado' } : r))
    } catch (e) {
      alert('Error al rechazar')
    }
  }

  const handleApproveAll = async () => {
    if (!window.confirm("¿Estás seguro de que quieres aprobar todos los registros en revisión?")) return
    try {
      const token = await getToken()
      const headers = { Authorization: `Bearer ${token}` }
      const res = await api.post('/admin/bulk/approve_all', {}, { headers })
      alert(res.data.message)
      // Reload page data
      setPage(1)
      window.location.reload()
    } catch (e: any) {
      alert(e.response?.data?.error?.message || 'Error al aprobar todos los registros.')
    }
  }

  return (
    <main style={{ maxWidth: 1000, margin: '2rem auto', padding: '0 1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Registros</h1>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            onClick={handleApproveAll}
            style={{ padding: '0.5rem 1rem', background: '#2e7d32', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
          >
            Aprobar Todo (En revisión)
          </button>
          <button onClick={() => navigate('/admin/records/new')} style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}>
            + Nuevo registro
          </button>
        </div>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label>
          Filtrar por estado:{' '}
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}>
            <option value="">Todos</option>
            <option value="borrador">Borrador</option>
            <option value="en_revision">En revisión</option>
            <option value="publicado">Publicado</option>
            <option value="rechazado">Rechazado</option>
          </select>
        </label>
        <span style={{ marginLeft: '1rem', color: '#666' }}>{total} registros</span>
      </div>

      {loading ? (
        <p>Cargando…</p>
      ) : (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>ID</th>
                <th style={th}>Tabla</th>
                <th style={th}>Transacción</th>
                <th style={th}>Ciudad</th>
                <th style={th}>Año</th>
                <th style={th}>Estado</th>
                <th style={th}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td style={td}>{r.id}</td>
                  <td style={td}>{r.source_table}</td>
                  <td style={td}>{r.transaction_id}</td>
                  <td style={td}>{r.city}</td>
                  <td style={td}>{r.year}</td>
                  <td style={td}>
                    <span style={{ color: STATUS_COLORS[r.status] ?? '#333', fontWeight: 600 }}>
                      {STATUS_LABELS[r.status] ?? r.status}
                    </span>
                  </td>
                  <td style={td}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={() => navigate(`/admin/records/${r.id}`)}
                        style={{ padding: '0.25rem 0.6rem', cursor: 'pointer' }}
                      >
                        Editar
                      </button>
                      {(r.status === 'borrador' || r.status === 'en_revision') && (
                        <button
                          onClick={() => handleApprove(r.id, r.status)}
                          style={{ padding: '0.25rem 0.6rem', cursor: 'pointer', background: '#2e7d32', color: 'white', border: 'none', borderRadius: 4 }}
                        >
                          Aprobar
                        </button>
                      )}
                      {r.status === 'en_revision' && (
                        <button
                          onClick={() => handleReject(r.id)}
                          style={{ padding: '0.25rem 0.6rem', cursor: 'pointer', background: '#d32f2f', color: 'white', border: 'none', borderRadius: 4 }}
                        >
                          Rechazar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', alignItems: 'center' }}>
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
              ← Anterior
            </button>
            <span>{page} / {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
              Siguiente →
            </button>
          </div>
        </>
      )}
    </main>
  )
}

const th: React.CSSProperties = { textAlign: 'left', borderBottom: '2px solid #ccc', padding: '0.5rem', background: '#f9f9f9' }
const td: React.CSSProperties = { padding: '0.5rem', borderBottom: '1px solid #eee' }
