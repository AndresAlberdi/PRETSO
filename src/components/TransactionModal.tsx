import { useEffect, useId, useState } from 'react';
import type { CSSProperties } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import Modal from './Modal';

const overlayStyle: CSSProperties = { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' };
const panelStyle: CSSProperties = { background: 'var(--bg-card)', padding: '2rem', borderRadius: '12px', width: '90%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--border-color)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' };

interface TransactionModalProps {
  transactionCode: string | number;
  onClose: () => void;
}

export default function TransactionModal({ transactionCode, onClose }: TransactionModalProps) {
  const [transaction, setTransaction] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const titleId = useId();

  useEffect(() => {
    async function fetchTransactionDetails() {
      try {
        if (!transactionCode) {
          setLoading(false);
          return;
        }

        // 1. Obtener la transacción
        const tQuery = query(collection(db, 'transacciones'), where('Num', '==', Number(transactionCode)));
        const tSnapshot = await getDocs(tQuery);
        
        if (tSnapshot.empty) {
          console.warn(`No se encontró transacción con código ${transactionCode}`);
          setLoading(false);
          return;
        }

        const tData = tSnapshot.docs[0].data();
        setTransaction(tData);

        // 2. Obtener los documentos asociados
        // Asumiendo que la transacción tiene columnas de Doc1 a Doc10 (Documento 1, Documento 2, etc.)
        // O que la colección documentos tiene una columna "Código" que podemos buscar
        const docCodes = [];
        for (let i = 1; i <= 10; i++) {
          const docCol = `Doc${i}`;
          if (tData[docCol]) {
            docCodes.push(tData[docCol]);
          }
        }

        if (docCodes.length > 0) {
          // Firebase in queries are limited to 10 items, which is perfect since we max have 10 documents
          const dQuery = query(collection(db, 'documentos'), where('Doc', 'in', docCodes));
          const dSnapshot = await getDocs(dQuery);
          setDocuments(dSnapshot.docs.map(d => d.data()));
        }
      } catch (error) {
        console.error("Error fetching transaction", error);
      } finally {
        setLoading(false);
      }
    }
    fetchTransactionDetails();
  }, [transactionCode]);

  return (
    <Modal labelledBy={titleId} onEscape={onClose} overlayStyle={overlayStyle} panelStyle={panelStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
        <h2 id={titleId} style={{ margin: 0, color: 'var(--primary-color)' }}>Detalle de Transacción {transactionCode}</h2>
        <button onClick={onClose} style={{ padding: '0.4rem 1rem', background: '#e74c3c', color: 'var(--on-danger)', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Cerrar</button>
      </div>

      <div role="status">{loading ? <p>Cargando información...</p> : !transaction ? <p>No se encontró información para la transacción {transactionCode}.</p> : null}</div>
      {!loading && transaction && (
        <div>
          <div style={{ marginBottom: '2rem' }}>
            <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Información General</h3>
            <p><strong>Noticia:</strong> {transaction['Noticia'] || 'N/A'}</p>
            <p><strong>Fuentes para la generación:</strong> {transaction['Fuentes para la generación del dato'] || 'N/A'}</p>
          </div>

          <div>
            <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Documentos Asociados</h3>
            {documents.length === 0 ? <p>No hay documentos asociados.</p> : (
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
                <caption className="visually-hidden">Documentos asociados</caption>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '2px solid var(--border-color)' }}>Código</th>
                    <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '2px solid var(--border-color)' }}>Descripción</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.5rem' }}>{doc['Doc']}</td>
                      <td style={{ padding: '0.5rem' }}>{doc['Documento']}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
