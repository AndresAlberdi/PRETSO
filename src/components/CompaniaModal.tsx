import { useEffect, useId, useState } from 'react';
import type { CSSProperties } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import Modal from './Modal';

const overlayStyle: CSSProperties = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex',
  alignItems: 'center', justifyContent: 'center', zIndex: 1000
};
const panelStyle: CSSProperties = {
  background: 'var(--bg-color)', padding: '2rem', borderRadius: '1rem',
  maxWidth: '800px', width: '90%', maxHeight: '90vh', overflowY: 'auto',
  boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
};

interface CompaniaModalProps {
  // Referencia a consultar (número de registro o sigla). Se ignora si llega `compania`.
  sigla?: string;
  // Compañía ya resuelta: con ella no se consulta Firestore.
  compania?: any;
  onClose: () => void;
}

export default function CompaniaModal({ sigla = '', compania: companiaDada, onClose }: CompaniaModalProps) {
  const [consultada, setConsultada] = useState<any | null>(null);
  const [loadingConsulta, setLoadingConsulta] = useState(true);
  const titleId = useId();
  const compania = companiaDada ?? consultada;
  const loading = companiaDada ? false : loadingConsulta;

  useEffect(() => {
    if (companiaDada) return;
    async function fetchCompania() {
      if (!sigla) return;
      let snap = await getDocs(query(collection(db, 'companias'), where('Indicador de registro', '==', Number(sigla))));
      if (snap.empty) {
        snap = await getDocs(query(collection(db, 'companias'), where('Indicador de registro', '==', sigla)));
      }
      if (snap.empty) {
        snap = await getDocs(query(collection(db, 'companias'), where('Sigla Compañía', '==', sigla)));
      }
      if (!snap.empty) {
        setConsultada(snap.docs[0].data());
      }
      setLoadingConsulta(false);
    }
    fetchCompania();
  }, [sigla, companiaDada]);

  return (
    <Modal labelledBy={titleId} onEscape={onClose} overlayStyle={overlayStyle} panelStyle={panelStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', alignItems: 'center' }}>
        <h2 id={titleId}>Detalle de Compañía</h2>
        <button onClick={onClose} style={{ padding: '0.5rem 1rem' }}>Cerrar</button>
      </div>
      
      {loading ? <p>Cargando compañía...</p> : !compania ? <p>No se encontró información para la compañía '{sigla}'</p> : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
          <tbody>
            {Object.keys(compania).map((key) => {
              if (key === 'Indicador de registro' || key === 'id') return null;
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
    </Modal>
  );
}
