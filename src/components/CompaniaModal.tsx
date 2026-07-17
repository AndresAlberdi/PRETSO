import { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

export default function CompaniaModal({ sigla, onClose }: { sigla: string, onClose: () => void }) {
  const [compania, setCompania] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCompania() {
      if (!sigla) return;
      const q = query(collection(db, 'companias'), where('Sigla Compañía', '==', sigla));
      const snap = await getDocs(q);
      if (!snap.empty) {
        setCompania(snap.docs[0].data());
      }
      setLoading(false);
    }
    fetchCompania();
  }, [sigla]);

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }}>
      <div style={{
        background: 'var(--bg-color)', padding: '2rem', borderRadius: '1rem',
        maxWidth: '800px', width: '90%', maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', alignItems: 'center' }}>
          <h2>Detalle de Compañía</h2>
          <button onClick={onClose} style={{ padding: '0.5rem 1rem' }}>Cerrar</button>
        </div>
        
        {loading ? <p>Cargando compañía...</p> : !compania ? <p>No se encontró información para la compañía '{sigla}'</p> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
            <tbody>
              {Object.keys(compania).map((key) => {
                if (!compania[key] || compania[key] === '') return null;
                return (
                  <tr key={key} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '0.75rem', textAlign: 'left', width: '30%', color: 'var(--accent-color)' }}>{key}</th>
                    <td style={{ padding: '0.75rem', textAlign: 'left' }}>{compania[key]}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
