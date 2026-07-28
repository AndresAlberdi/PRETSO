import { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

interface DocumentModalProps {
  transactionCode: string | number;
  onClose: () => void;
}

export default function DocumentModal({ transactionCode, onClose }: DocumentModalProps) {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDocumentDetails() {
      try {
        if (!transactionCode) {
          setLoading(false);
          return;
        }

        const tQuery = query(collection(db, 'transacciones'), where('Num', '==', Number(transactionCode)));
        const tSnapshot = await getDocs(tQuery);
        
        if (tSnapshot.empty) {
          console.warn(`No se encontró transacción con código ${transactionCode}`);
          setLoading(false);
          return;
        }

        const tData = tSnapshot.docs[0].data();

        const docCodes = [];
        for (let i = 1; i <= 10; i++) {
          const docCol = `Doc${i}`;
          if (tData[docCol]) {
            docCodes.push(tData[docCol]);
          }
        }

        if (docCodes.length > 0) {
          const dQuery = query(collection(db, 'documentos'), where('Doc', 'in', docCodes));
          const dSnapshot = await getDocs(dQuery);
          setDocuments(dSnapshot.docs.map(d => d.data()));
        }
      } catch (error) {
        console.error("Error fetching document details", error);
      } finally {
        setLoading(false);
      }
    }
    fetchDocumentDetails();
  }, [transactionCode]);

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--bg-card)', padding: '2rem', borderRadius: '12px', width: '90%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--border-color)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
          <h2 style={{ margin: 0, color: 'var(--primary-color)' }}>Documentos de Transacción {transactionCode}</h2>
          <button onClick={onClose} style={{ padding: '0.4rem 1rem', background: '#e74c3c', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Cerrar</button>
        </div>

        {loading ? <p>Cargando información...</p> : documents.length === 0 ? <p>No hay documentos asociados a la transacción {transactionCode}.</p> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {documents.map((doc, idx) => (
              <div key={idx} style={{ background: 'rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: '8px' }}>
                <h4 style={{ margin: '0 0 1rem 0', color: 'var(--primary-color)' }}>Documento {doc['Doc']}</h4>
                <p style={{ fontSize: '1.1rem', lineHeight: '1.6', whiteSpace: 'pre-wrap', margin: 0 }}>
                  {doc['Documento'] || 'No hay texto registrado.'}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
