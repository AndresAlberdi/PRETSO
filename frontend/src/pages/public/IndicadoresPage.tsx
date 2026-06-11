import { useState } from 'react'
import TableRecordsList from './TableRecordsList'

export default function IndicadoresPage() {
  const [tab, setTab] = useState<'I' | 'IdI'>('I')

  return (
    <main style={{ maxWidth: 1200, margin: '2rem auto', padding: '0 1.5rem' }}>
      <h1 style={{ margin: '0 0 1.5rem 0', fontSize: '2.25rem', fontWeight: 700 }}>Indicadores</h1>
      
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>
        <button 
          onClick={() => setTab('I')}
          style={{ ...btnStyle, background: tab === 'I' ? 'var(--primary-color)' : 'transparent', color: tab === 'I' ? '#000' : 'inherit' }}
        >
          Indicadores
        </button>
        <button 
          onClick={() => setTab('IdI')}
          style={{ ...btnStyle, background: tab === 'IdI' ? 'var(--primary-color)' : 'transparent', color: tab === 'IdI' ? '#000' : 'inherit' }}
        >
          Identificación de indicadores
        </button>
      </div>

      {tab === 'I' && <TableRecordsList sourceTable="I" title="Indicadores" hideTitle />}
      {tab === 'IdI' && <TableRecordsList sourceTable="IdI" title="Identificación de indicadores" hideTitle />}
    </main>
  )
}

const btnStyle: React.CSSProperties = {
  padding: '0.6rem 1.2rem',
  borderRadius: '8px',
  border: '1px solid rgba(255, 255, 255, 0.2)',
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: '1rem',
  transition: 'all 0.2s ease',
}
