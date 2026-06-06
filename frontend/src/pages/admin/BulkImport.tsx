import { useRef, useState } from 'react'
import Papa from 'papaparse'
import { useNavigate } from 'react-router-dom'
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

interface CsvRow {
  city?: string
  year?: string
  noticia?: string
  fuente_bibliografica?: string
  [key: string]: string | undefined
}

interface RowError {
  row: number
  field: string
  reason: string
}

export default function BulkImport() {
  const { getToken } = useAuth()
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)

  const [sourceTable, setSourceTable] = useState('CM')
  const [loading, setLoading] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  
  // Validation State
  const [validationErrors, setValidationErrors] = useState<RowError[]>([])
  const [validRecords, setValidRecords] = useState<any[]>([])

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setValidationErrors([])
    setValidRecords([])
    setSuccessMsg(null)

    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data
        if (rows.length > 100) {
          setValidationErrors([{ row: 0, field: 'Archivo', reason: 'El archivo supera el límite de 100 registros por lote.' }])
          return
        }

        const errors: RowError[] = []
        const parsedRecords: any[] = []
        const transactionId = `Tra-${Date.now()}`

        rows.forEach((row, i) => {
          const rowNum = i + 2 // +2 because 1 is header, and 0-indexed

          // Validate required fields
          if (!row.city?.trim()) errors.push({ row: rowNum, field: 'city', reason: 'La ciudad es requerida.' })
          if (!row.year?.trim()) {
            errors.push({ row: rowNum, field: 'year', reason: 'El año es requerido.' })
          } else {
            const y = parseInt(row.year, 10)
            if (isNaN(y) || y < 1500 || y > 1700) {
              errors.push({ row: rowNum, field: 'year', reason: 'El año debe ser un número entre 1500 y 1700.' })
            }
          }
          if (!row.noticia?.trim()) errors.push({ row: rowNum, field: 'noticia', reason: 'La noticia es requerida.' })
          if (!row.fuente_bibliografica?.trim()) errors.push({ row: rowNum, field: 'fuente_bibliografica', reason: 'La fuente bibliográfica es requerida.' })

          if (errors.length === 0) {
            parsedRecords.push({
              transaction_id: transactionId,
              source_table: sourceTable,
              city: row.city?.trim(),
              year: parseInt(row.year!, 10),
              noticia: row.noticia?.trim(),
              fuente_bibliografica: row.fuente_bibliografica?.trim(),
              // Mapea otros campos opcionales si existen en el CSV
              documento_codigo: row.documento_codigo?.trim() || undefined,
              transcripcion: row.transcripcion?.trim() || undefined,
            })
          }
        })

        if (errors.length > 0) {
          setValidationErrors(errors)
        } else {
          setValidRecords(parsedRecords)
        }
      },
      error: (error) => {
        setValidationErrors([{ row: 0, field: 'Archivo', reason: `Error al leer CSV: ${error.message}` }])
      }
    })
  }

  async function handleImport() {
    if (validRecords.length === 0) return

    setLoading(true)
    try {
      const token = await getToken()
      const res = await api.post('/admin/bulk/records', { records: validRecords }, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setSuccessMsg(`✅ ${res.data.count} registros importados y marcados como 'en revisión'.`)
      setValidRecords([])
      if (fileRef.current) fileRef.current.value = ''
    } catch (err: any) {
      setValidationErrors([{ row: 0, field: 'Servidor', reason: err.response?.data?.error?.message || 'Error desconocido al importar.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={{ maxWidth: 800, margin: '2rem auto', padding: '0 1rem' }}>
      <h1>Importación Masiva (Bulk Import)</h1>
      <p>Sube un archivo CSV con un <strong>máximo de 100 registros</strong> a la vez. Las columnas requeridas son: <code>city</code>, <code>year</code>, <code>noticia</code>, <code>fuente_bibliografica</code>.</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1.5rem' }}>
        <label>
          <strong>Selecciona la tabla destino:</strong>
          <select
            value={sourceTable}
            onChange={(e) => {
              setSourceTable(e.target.value)
              if (fileRef.current) fileRef.current.value = ''
              setValidRecords([])
              setValidationErrors([])
            }}
            style={{ display: 'block', marginTop: '0.25rem', padding: '0.5rem', width: '100%', maxWidth: 300 }}
          >
            {SOURCE_TABLES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </label>

        <label>
          <strong>Archivo CSV:</strong>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            style={{ display: 'block', marginTop: '0.25rem' }}
          />
        </label>

        {successMsg && (
          <div style={{ padding: '1rem', backgroundColor: '#e8f5e9', color: '#2e7d32', borderRadius: '4px', fontWeight: 'bold' }}>
            {successMsg}
            <button
              onClick={() => navigate('/admin/records')}
              style={{ marginLeft: '1rem', padding: '0.4rem 0.8rem', cursor: 'pointer' }}
            >
              Ir a Revisión
            </button>
          </div>
        )}

        {validationErrors.length > 0 && (
          <div style={{ marginTop: '1rem' }}>
            <h3 style={{ color: '#d32f2f' }}>⚠️ Errores de Validación</h3>
            <p>Corrige el archivo y vuelve a subirlo. No se importará ningún registro hasta que todos los datos sean válidos.</p>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
              <thead>
                <tr>
                  <th style={th}>Fila CSV</th>
                  <th style={th}>Campo</th>
                  <th style={th}>Motivo del Error</th>
                </tr>
              </thead>
              <tbody>
                {validationErrors.map((err, i) => (
                  <tr key={i}>
                    <td style={td}>{err.row === 0 ? '-' : err.row}</td>
                    <td style={td}>{err.field}</td>
                    <td style={td}>{err.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {validRecords.length > 0 && validationErrors.length === 0 && (
          <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#fff3e0', borderRadius: '4px' }}>
            <h3>✅ Datos Válidos</h3>
            <p>El archivo contiene {validRecords.length} registros listos para ser importados.</p>
            <button
              onClick={handleImport}
              disabled={loading}
              style={{
                marginTop: '1rem',
                padding: '0.75rem 1.5rem',
                backgroundColor: '#1976d2',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontWeight: 'bold',
                fontSize: '1rem'
              }}
            >
              {loading ? 'Importando...' : `Confirmar e Importar ${validRecords.length} Registros`}
            </button>
          </div>
        )}
      </div>
    </main>
  )
}

const th: React.CSSProperties = { textAlign: 'left', borderBottom: '2px solid #ccc', padding: '0.5rem', backgroundColor: '#f5f5f5' }
const td: React.CSSProperties = { padding: '0.5rem', borderBottom: '1px solid #eee' }
