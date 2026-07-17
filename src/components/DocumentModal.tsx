import { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

interface DocumentModalProps {
  docCode: string | number;
  onClose: () => void;
}

export default function DocumentModal({ docCode, onClose }: DocumentModalProps) {
  const [docData, setDocData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDocumentDetails() {
      try {
        if (docCode === null || docCode === undefined) {
          setLoading(false);
          return;
        }

        const dQuery = query(collection(db, 'documentos'), where('Doc', '==', Number(docCode)));
        const dSnapshot = await getDocs(dQuery);
        
        if (dSnapshot.empty) {
          console.warn(`No se encontró el documento con código ${docCode}`);
          setLoading(false);
          return;
        }

        const data = dSnapshot.docs[0].data();
        setDocData(data);
      } catch (error) {
        console.error("Error fetching document details", error);
      } finally {
        setLoading(false);
      }
    }
    fetchDocumentDetails();
  }, [docCode]);

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--bg-card)', padding: '2rem', borderRadius: '12px', width: '90%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--border-color)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
          <h2 style={{ margin: 0, color: 'var(--primary-color)' }}>Detalle de Documento {docCode}</h2>
          <button onClick={onClose} style={{ padding: '0.4rem 1rem', background: '#e74c3c', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Cerrar</button>
        </div>

        {loading ? <p>Cargando información...</p> : !docData ? <p>No se encontró información para el documento {docCode}.</p> : (
          <div>
            <div style={{ marginBottom: '1.5rem' }}>
              <p style={{ fontSize: '1.1rem', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                {docData['Documento'] || 'No hay texto registrado.'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
