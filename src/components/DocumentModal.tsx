import { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

interface DocumentModalProps {
  documentCode: string | number;
  onClose: () => void;
}

export default function DocumentModal({ documentCode, onClose }: DocumentModalProps) {
  const [document, setDocument] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDocumentDetails() {
      try {
        if (!documentCode) {
          setLoading(false);
          return;
        }

        const dQuery = query(collection(db, 'documentos'), where('Doc', '==', documentCode));
        const dSnapshot = await getDocs(dQuery);
        
        if (!dSnapshot.empty) {
          setDocument(dSnapshot.docs[0].data());
        }
      } catch (error) {
        console.error("Error fetching document details", error);
      } finally {
        setLoading(false);
      }
    }
    fetchDocumentDetails();
  }, [documentCode]);

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--bg-card)', padding: '2rem', borderRadius: '12px', width: '90%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--border-color)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
          <h2 style={{ margin: 0, color: 'var(--primary-color)' }}>Documento {documentCode}</h2>
          <button onClick={onClose} style={{ padding: '0.4rem 1rem', background: '#e74c3c', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Cerrar</button>
        </div>

        {loading ? <p>Cargando información...</p> : !document ? <p>No se encontró información para el documento {documentCode}.</p> : (
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: '8px' }}>
            <p style={{ fontSize: '1.1rem', lineHeight: '1.6', whiteSpace: 'pre-wrap', margin: 0 }}>
              {document['Documento'] || 'No hay texto registrado.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
