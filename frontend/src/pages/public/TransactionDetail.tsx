import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../../api/client'
import type { Transaction, RecordMaestro, Company, PaginatedResponse } from '../../api/types'

const TABLE_NAMES: Record<string, string> = {
  B: 'Bibliografía',
  CM: 'Compañías — Caja',
  CS: 'Compañías — Salarios',
  CC: 'Corpus Christi',
  IdI: 'Identificación de indicadores',
  I: 'Indicadores',
  Com: 'Índice de compañías',
}

const FIELD_DEFINITIONS: Record<string, Array<{ key: keyof RecordMaestro, label: string, span?: number }>> = {
  CM: [
    { key: 'id', label: 'Indicador de registro' },
    { key: 'transaction_id', label: 'Transacción' },
    { key: 'documento', label: 'Documento', span: 4 },
    { key: 'noticia', label: 'Noticia', span: 4 },
    { key: 'city', label: 'Ciudad' },
    { key: 'year', label: 'Año' },
    { key: 'autor_bib', label: 'Autores' },
    { key: 'compania_id', label: 'Compañía' },
    { key: 'concepto_caja', label: 'Data', span: 2 },
    { key: 'cargo', label: 'Cargo' },
    { key: 'otros_bienes', label: 'Otros bienes de la compañía', span: 2 },
    { key: 'normativa_caja', label: 'Datos sobre normativa de manejo de caja', span: 2 },
    { key: 'fuente_bibliografica', label: 'Fuentes para la generación del dato', span: 2 },
    { key: 'documento_codigo', label: 'Código documento' }
  ],
  CS: [
    { key: 'id', label: 'Indicador de registro' },
    { key: 'transaction_id', label: 'Transacción' },
    { key: 'documento', label: 'Documento', span: 2 },
    { key: 'noticia', label: 'Noticia', span: 3 },
    { key: 'city', label: 'Ciudad' },
    { key: 'cargo', label: 'Encargo' },
    { key: 'year', label: 'Año' },
    { key: 'valor_indicador', label: 'Monto a pagar' },
    { key: 'pagador', label: 'Pagador' },
    { key: 'beneficiario', label: 'Beneficiario' },
    { key: 'compania_id', label: 'Compañía' },
    { key: 'fuente_bibliografica', label: 'Fuentes para la generación del dato', span: 2 },
    { key: 'documento_codigo', label: 'Códigos documentos' },
    { key: 'salario_diario', label: 'Ración diaria' },
    { key: 'dias_racion', label: 'Días de ración en un año' },
    { key: 'monto_reales', label: 'Pago por representación' },
    { key: 'representaciones_ano', label: 'Número de representaciones por año' },
    { key: 'representaciones_estimadas', label: 'Número estimado de representaciones por año' }
  ],
  CC: [
    { key: 'id', label: 'Indicador de registro' },
    { key: 'transaction_id', label: 'Transacción' },
    { key: 'documento', label: 'Documento', span: 2 },
    { key: 'noticia', label: 'Noticia', span: 3 },
    { key: 'city', label: 'Ciudad' },
    { key: 'year', label: 'Año' },
    { key: 'festividad', label: 'Encargo' },
    { key: 'encargado', label: 'Encargado' },
    { key: 'compania_id', label: 'Compañía' },
    { key: 'monto_reales', label: 'Monto a pagar' },
    { key: 'fondos', label: 'Fondos' },
    { key: 'fuente_bibliografica', label: 'Fuentes para la generación del dato', span: 2 },
    { key: 'documento_codigo', label: 'Códigos documentos' }
  ],
  IdI: [
    { key: 'id', label: 'Indicador de registro' },
    { key: 'transaction_id', label: 'Transacción' },
    { key: 'documento', label: 'Documento', span: 2 },
    { key: 'noticia', label: 'Otros datos para elaborar indicadores', span: 3 },
    { key: 'city', label: 'Ciudad' },
    { key: 'year', label: 'Años' },
    { key: 'tipo_indicador', label: 'Categorías' },
    { key: 'concepto_caja', label: 'Concepto', span: 2 },
    { key: 'monto_reales', label: 'Monto' },
    { key: 'notas', label: 'Nota', span: 2 },
    { key: 'compania_id', label: 'Compañía' },
    { key: 'fuente_bibliografica', label: 'Referencias bibliográficas', span: 2 },
    { key: 'documento_codigo', label: 'Código documentos' }
  ],
  I: [
    { key: 'id', label: 'Indicador de registro' },
    { key: 'noticia', label: 'Indicador', span: 3 },
    { key: 'city', label: 'Ciudad' },
    { key: 'year', label: 'Años' },
    { key: 'concepto_caja', label: 'Concepto' },
    { key: 'monto_reales', label: 'Monto' },
    { key: 'notas', label: 'Notas', span: 2 }
  ],
  B: [
    { key: 'id', label: 'Indicador de registro' },
    { key: 'autor_bib', label: 'Autores' },
    { key: 'titulo', label: 'Referencias bibliográficas', span: 3 }
  ],
  Com: [
    { key: 'id', label: 'Indicador de registro' },
    { key: 'siglas', label: 'Siglas' },
    { key: 'autor_principal', label: 'Autores' },
    { key: 'ambito', label: 'España / América' },
    { key: 'valor_indicador', label: 'Temporadas teatrales' }
  ]
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {rows.map((r) => {
              const defs = FIELD_DEFINITIONS[table] || []
              // Filter to fields that actually have a value
              const validDefs = defs.filter(d => r[d.key] != null && r[d.key] !== '')

              return (
                <div key={r.id} style={{ padding: '1.5rem', background: 'rgba(0, 0, 0, 0.2)', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <h4 style={{ margin: '0 0 1rem 0', color: 'var(--primary-color)', fontSize: '1.1rem' }}>Registro: {r.id}</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                    {validDefs.map((def) => (
                      <div key={def.key} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', gridColumn: def.span ? `span ${def.span}` : 'span 1' }}>
                        <span style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 600 }}>
                          {def.label}
                        </span>
                        <span style={{ fontSize: '1rem', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                          {String(r[def.key])}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      ))}
    </main>
  )
}


