import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../../api/client'
import { useAuth } from '../../hooks/useAuth'

const SOURCE_TABLES: { value: string; label: string }[] = [
  { value: 'CM', label: 'Compañías — Caja' },
  { value: 'CS', label: 'Compañías — Salarios' },
  { value: 'CC', label: 'Corpus Christi' },
  { value: 'IdI', label: 'Identificación de indicadores' },
  { value: 'I', label: 'Indicadores' },
  { value: 'Com', label: 'Índice de compañías' },
  { value: 'B', label: 'Bibliografía' },
]

interface EtlResult {
  imported: number
  rejected: number
  skipped: number
  errors: Array<{ row: number; field: string; reason: string }>
}

export default function EtlUpload() {
  const { t } = useTranslation()
  const { getToken } = useAuth()
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)

  const [sourceTable, setSourceTable] = useState('CM')
  const [result, setResult] = useState<EtlResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [publishResult, setPublishResult] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const file = fileRef.current?.files?.[0]
    if (!file) return

    setLoading(true)
    setError(null)
    setResult(null)
    setPublishResult(null)

    try {
      const token = await getToken()
      const formData = new FormData()
      formData.append('file', file)
      formData.append('source_table', sourceTable)

      const res = await api.post<EtlResult>('/admin/etl/run', formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      })
      if (res.data) setResult(res.data)
    } catch {
      setError(t('errors.generic'))
    } finally {
      setLoading(false)
    }
  }

  // Envía todos los registros importados a revisión y los aprueba directamente
  async function publishAll() {
    setPublishing(true)
    setPublishResult(null)
    try {
      const token = await getToken()
      const headers = { Authorization: `Bearer ${token}` }

      // 1. Obtener registros en borrador
      const listRes = await api.get<{ results: Array<{ id: string; status: string }> }>(
        '/admin/records?status=borrador&page_size=100',
        { headers }
      )
      const records = listRes.data?.results ?? []
      let published = 0

      for (const rec of records) {
        try {
          // 2. Enviar a revisión
          await api.put(`/admin/records/${rec.id}/status`,
            { new_status: 'en_revision' }, { headers })
          // 3. Aprobar
          await api.put(`/admin/records/${rec.id}/status`,
            { new_status: 'publicado' }, { headers })
          published++
        } catch {
          // continuar con el siguiente
        }
      }
      setPublishResult(`${published} registros publicados correctamente.`)
    } catch {
      setPublishResult('Error al publicar los registros.')
    } finally {
      setPublishing(false)
    }
  }

  return (
    <main style={{ maxWidth: 700, margin: '2rem auto', padding: '0 1rem' }}>
      <h1>{t('admin.etl')}</h1>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <label>
          Tabla
          <select
            value={sourceTable}
            onChange={(e) => setSourceTable(e.target.value)}
            style={{ display: 'block', marginTop: '0.25rem', padding: '0.5rem' }}
          >
            {SOURCE_TABLES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </label>

        <label>
          Archivo CSV
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            required
            style={{ display: 'block', marginTop: '0.25rem' }}
          />
        </label>

        {error && <p style={{ color: 'red' }}>{error}</p>}

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button type="submit" disabled={loading} style={{ padding: '0.6rem 1.2rem' }}>
            {loading ? 'Importando…' : 'Importar'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/admin/records?status=borrador')}
            style={{ padding: '0.6rem 1.2rem' }}
          >
            Ir a revisión manual
          </button>
          <button
            type="button"
            onClick={() => navigate('/admin/records')}
            style={{ padding: '0.6rem 1.2rem' }}
          >
            Ver todos los registros
          </button>
          <button
            type="button"
            onClick={publishAll}
            disabled={publishing}
            style={{ padding: '0.6rem 1.2rem', background: '#2e7d32', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
          >
            {publishing ? 'Publicando…' : 'Aprobar y publicar todo'}
          </button>
        </div>
      </form>

      {publishResult && (
        <p style={{ marginTop: '1rem', color: publishResult.startsWith('Error') ? 'red' : 'green' }}>
          {publishResult}
        </p>
      )}

      {result && (
        <section style={{ marginTop: '2rem' }}>
          <h2>Resumen de importación</h2>
          <ul>
            <li>Importados: <strong>{result.imported}</strong></li>
            <li>Rechazados: <strong>{result.rejected}</strong></li>
            <li>Omitidos (ya existían): <strong>{result.skipped}</strong></li>
          </ul>

          {result.errors.length > 0 && (
            <>
              <h3>Errores</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={th}>Fila</th>
                    <th style={th}>Campo</th>
                    <th style={th}>Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {result.errors.map((err, i) => (
                    <tr key={i}>
                      <td style={td}>{err.row}</td>
                      <td style={td}>{err.field}</td>
                      <td style={td}>{err.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </section>
      )}
    </main>
  )
}

const th: React.CSSProperties = { textAlign: 'left', borderBottom: '2px solid #ccc', padding: '0.5rem' }
const td: React.CSSProperties = { padding: '0.5rem', borderBottom: '1px solid #eee' }
