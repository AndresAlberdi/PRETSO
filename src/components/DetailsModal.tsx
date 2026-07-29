
interface DetailsModalProps {
  record: any;
  onClose: () => void;
  title?: string;
}

export default function DetailsModal({ record, onClose, title = "Detalles del Registro" }: DetailsModalProps) {
  if (!record) return null;

  const fields = Object.entries(record).filter(([key]) => key !== 'id');

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        background: 'var(--bg-card)',
        padding: '2rem',
        borderRadius: '8px',
        width: '90%',
        maxWidth: '600px',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ margin: 0, color: 'var(--primary-color)' }}>{title}</h2>
          <button 
            onClick={onClose} 
            style={{ background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-color)' }}
          >
            &times;
          </button>
        </div>

        <div style={{ display: 'grid', gap: '1rem' }}>
          {fields.map(([key, value]) => (
            <div key={key} style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              <div style={{ fontWeight: 'bold', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{key}</div>
              <div style={{ marginTop: '0.25rem', whiteSpace: 'pre-wrap' }}>{value ? String(value) : '-'}</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: '2rem', textAlign: 'right' }}>
          <button 
            onClick={onClose}
            style={{ padding: '0.5rem 1rem', background: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
