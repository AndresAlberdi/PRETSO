import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../../api/client'
import type { RecordMaestro } from '../../api/types'
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

// Campos específicos por tabla (además de los comunes)
const EXTRA_FIELDS: Record<string, Array<{ name: string; label: string; type?: string }>> = {
  CM: [
    { name: 'concepto_caja', label: 'Concepto de caja' },
    { name: 'cargo', label: 'Cargo' },
    { name: 'monto_reales', label: 'Monto (reales)', type: 'number' },
  ],
  CS: [
    { name: 'cargo', label: 'Encargo / Rol' },
    { name: 'salario_diario', label: 'Ración diaria (reales)', type: 'number' },
    { name: 'monto_reales', label: 'Pago por representación (reales)', type: 'number' },
    { name: 'nombre_actor', label: 'Nombre del actor/actriz' },
  ],
  CC: [
    { name: 'festividad', label: 'Encargo / Festividad' },
    { name: 'monto_reales', label: 'Monto a pagar (reales)', type: 'number' },
    { name: 'numero_autos', label: 'Número de autos', type: 'number' },
  ],
  IdI: [
    { name: 'tipo_indicador', label: 'Categoría del indicador' },
    { name: 'concepto_caja', label: 'Concepto' },
    { name: 'monto_reales', label: 'Monto (reales)', type: 'number' },
  ],
  I: [
    { name: 'concepto_caja', label: 'Concepto' },
    { name: 'valor_indicador', label: 'Valor del indicador' },
    { name: 'unidad', label: 'Unidad' },
    { name: 'monto_reales', label: 'Monto (reales)', type: 'number' },
  ],
  Com: [
    { name: 'siglas', label: 'Siglas de la compañía' },
    { name: 'autor_principal', label: 'Autores' },
    { name: 'ambito', label: 'Ámbito (España / América)' },
    { name: 'valor_indicador', label: 'Temporadas teatrales' },
  ],
  B: [
    { name: 'autor_bib', label: 'Autores' },
    { name: 'titulo', label: 'Referencia bibliográfica' },
    { name: 'anio_publicacion', label: 'Año de publicación', type: 'number' },
    { name: 'editorial', label: 'Editorial' },
  ],
}

type FormState = Record<string, string>

function buildEmptyForm(table: string): FormState {
  const base: FormState = {
    transaction_id: '',
    source_table: table,
    city: '',
    year: '',
    noticia: '',
    fuente_bibliografica: '',
    documento_codigo: '',
  }
  const extra = EXTRA_FIELDS[table] ?? []
  extra.forEach((f) => { base[f.name] = '' })
  return base
}

export default function RecordEditor() {
  const { t } = useTranslation()
  const { id } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const { user, getToken } = useAuth()

  const [selectedTable, setSelectedTable] = useState('CM')
  const [tableChosen, setTableChosen] = useState(!!id) // en edición ya está elegida
  const [form, setForm] = useState<FormState>(buildEmptyForm('CM'))
  const [status, setStatus] = useState('borrador')
  const [rejectionComment, setRejectionComment] = useState('')
  const [loading, setLoading] = useState(!!id)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isReviewer = user?.role === 'revisor' || user?.role === 'administrador'

  useEffect(() => {
    if (!id) return
    let cancelled = false
    async function load() {
      try {
        const token = await getToken()
        const res = await api.get<RecordMaestro>(`/admin/records/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!cancelled && res.data) {
          const r = res.data
          const table = r.source_table ?? 'CM'
          setSelectedTable(table)
          setTableChosen(true)
          const newForm = buildEmptyForm(table)
          Object.keys(newForm).forEach((k) => {
            const val = (r as Record<string, unknown>)[k]
            if (val != null) newForm[k] = String(val)
          })
          setForm(newForm)
          setStatus(r.status ?? 'borrador')
        }
      } catch {
        if (!cancelled) setError(t('errors.generic'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [id, getToken, t])

  function handleTableSelect() {
    setForm(buildEmptyForm(selectedTable))
    setTableChosen(true)
  }

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const token = await getToken()
      const headers = { Authorization: `Bearer ${token}` }
      const payload = {
        ...form,
        year: form.year ? Number(form.year) : null,
        monto_reales: form.monto_reales ? Number(form.monto_reales) : null,
        salario_diario: form.salario_diario ? Number(form.salario_diario) : null,
        numero_autos: form.numero_autos ? Number(form.numero_autos) : null,
        anio_publicacion: form.anio_publicacion ? Number(form.anio_publicacion) : null,
      }
      if (id) {
        await api.put(`/admin/records/${id}`, payload, { headers })
      } else {
        const res = await api.post<RecordMaestro>('/admin/records', payload, { headers })
        if (res.data?.id) {
          navigate(`/admin/records/${res.data.id}`, { replace: true })
          return
        }
      }
    } catch {
      setError(t('errors.generic'))
    } finally {
      setSaving(false)
    }
  }

  async function changeStatus(newStatus: string) {
    if (!id) return
    setSaving(true)
    setError(null)
    try {
      const token = await getToken()
      await api.put(
        `/admin/records/${id}/status`,
        { new_status: newStatus, rejection_comment: rejectionComment || undefined },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setStatus(newStatus)
    } catch {
      setError(t('errors.generic'))
    } finally {
      setSaving(false)
    }
  }

  async function deleteRecord() {
    if (!id) return
    if (!window.confirm('¿Está seguro de que desea eliminar este registro de forma permanente? Esta acción no se puede deshacer.')) return
    setSaving(true)
    setError(null)
    try {
      const token = await getToken()
      await api.delete(`/admin/records/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Confirm-Delete': 'true',
        },
      })
      navigate('/admin/records')
    } catch {
      setError(t('errors.generic'))
      setSaving(false)
    }
  }

  if (loading) return <p style={{ margin: '2rem' }}>Cargando…</p>

  // Paso 1: elegir tabla
  if (!tableChosen) {
    return (
      <main style={{ maxWidth: 500, margin: '2rem auto', padding: '0 1rem' }}>
        <h1>Nuevo registro</h1>
        <label style={{ fontSize: '1rem' }}>
          Selecciona la tabla de origen:
          <select
            value={selectedTable}
            onChange={(e) => setSelectedTable(e.target.value)}
            style={{ display: 'block', width: '100%', padding: '0.5rem', marginTop: '0.5rem', fontSize: '1rem' }}
          >
            {SOURCE_TABLES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </label>
        <button
          onClick={handleTableSelect}
          style={{ marginTop: '1rem', padding: '0.6rem 1.5rem', fontSize: '1rem' }}
        >
          Continuar →
        </button>
      </main>
    )
  }

  const tableLabel = SOURCE_TABLES.find((s) => s.value === selectedTable)?.label ?? selectedTable
  const extraFields = EXTRA_FIELDS[selectedTable] ?? []

  // Paso 2: formulario con campos de la tabla elegida
  return (
    <main style={{ maxWidth: 700, margin: '2rem auto', padding: '0 1rem' }}>
      <h1>{id ? `Editar registro — ${tableLabel}` : `Nuevo registro — ${tableLabel}`}</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}

      <form
        onSubmit={(e) => { e.preventDefault(); save() }}
        style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
      >
        {/* Campos comunes */}
        {!id && (
          <label>
            Tabla
            <input value={tableLabel} disabled style={{ ...inputStyle, background: '#f0f0f0' }} />
          </label>
        )}

        <label>
          Transacción (ej: Tra-1)
          <input
            name="transaction_id"
            value={form.transaction_id}
            onChange={handleChange}
            placeholder="Tra-N"
            style={inputStyle}
          />
        </label>

        <label>
          Ciudad
          <input name="city" value={form.city} onChange={handleChange} style={inputStyle} />
        </label>

        <label>
          Año
          <input name="year" type="number" value={form.year} onChange={handleChange} style={inputStyle} />
        </label>

        <label>
          Noticia / Descripción
          <textarea
            name="noticia"
            value={form.noticia}
            onChange={handleChange}
            rows={5}
            required
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </label>

        <label>
          Fuente bibliográfica
          <input
            name="fuente_bibliografica"
            value={form.fuente_bibliografica}
            onChange={handleChange}
            required
            style={inputStyle}
          />
        </label>

        <label>
          Código documento
          <input name="documento_codigo" value={form.documento_codigo} onChange={handleChange} style={inputStyle} />
        </label>

        {/* Campos específicos de la tabla */}
        {extraFields.length > 0 && (
          <>
            <hr />
            <p style={{ fontWeight: 600, margin: 0 }}>Campos específicos de {tableLabel}</p>
            {extraFields.map((f) => (
              <label key={f.name}>
                {f.label}
                <input
                  name={f.name}
                  type={f.type ?? 'text'}
                  value={form[f.name] ?? ''}
                  onChange={handleChange}
                  style={inputStyle}
                />
              </label>
            ))}
          </>
        )}

        {/* Acciones según estado */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem', width: '100%', alignItems: 'center' }}>
          {(status === 'borrador' || status === 'en_revision') && (
            <button type="submit" disabled={saving}>
              Guardar
            </button>
          )}
          {status === 'borrador' && id && (
            <button type="button" disabled={saving} onClick={() => changeStatus('en_revision')}>
              {t('admin.actions.submit')}
            </button>
          )}
          {status === 'en_revision' && isReviewer && (
            <>
              <button type="button" disabled={saving} onClick={() => changeStatus('publicado')}
                style={{ background: '#2e7d32', color: 'white', border: 'none', borderRadius: 4, padding: '0.5rem 1rem', cursor: 'pointer' }}>
                {t('admin.actions.approve')}
              </button>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', width: '100%' }}>
                <input
                  type="text"
                  placeholder="Comentario de rechazo (mín. 10 caracteres)"
                  value={rejectionComment}
                  onChange={(e) => setRejectionComment(e.target.value)}
                  style={{ padding: '0.4rem', flex: 1 }}
                />
                <button type="button" disabled={saving || rejectionComment.length < 10}
                  onClick={() => changeStatus('borrador')}>
                  {t('admin.actions.reject')}
                </button>
              </div>
            </>
          )}
          {status === 'publicado' && (
            <p style={{ color: '#2e7d32', fontWeight: 600, margin: 0 }}>✓ Publicado</p>
          )}
          {user?.role === 'administrador' && id && (
            <button
              type="button"
              disabled={saving}
              onClick={deleteRecord}
              style={{
                background: '#d32f2f',
                color: 'white',
                border: 'none',
                borderRadius: 4,
                padding: '0.5rem 1rem',
                cursor: 'pointer',
                marginLeft: 'auto',
              }}
            >
              Eliminar Registro
            </button>
          )}
        </div>
      </form>
    </main>
  )
}

const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '0.5rem',
  marginTop: '0.25rem',
  boxSizing: 'border-box',
}
