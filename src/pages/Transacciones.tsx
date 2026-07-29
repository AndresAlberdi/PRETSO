import { useEffect, useState } from "react";
import { collection, getDocs, query, deleteDoc, doc, where } from "firebase/firestore";
import { db } from "../firebase";
import { cleanFirebaseData } from "../utils";
import { useAdmin } from "../context/AdminContext";
import ConfirmModal from "../components/ConfirmModal";
import { logAction } from "../utils/audit";
import GenericCreateModal from "../components/GenericCreateModal";
import GenericEditModal from "../components/GenericEditModal";
import DocumentModal from "../components/DocumentModal";
import { updateDoc } from "firebase/firestore";
import { useSortableTable } from "../hooks/useSortableTable";

export default function Transacciones() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { isEditMode } = useAdmin();
  const [recordToDelete, setRecordToDelete] = useState<any>(null);
  const [deleteErrorAlert, setDeleteErrorAlert] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [recordToEdit, setRecordToEdit] = useState<any | null>(null);
  const [activeDoc, setActiveDoc] = useState<string | number | null>(null);

  const { items: sortedData, requestSort, sortConfig } = useSortableTable(data);

  const SortIndicator = ({ column }: { column: string }) => {
    if (!sortConfig || sortConfig.key !== column) return null;
    return <span>{sortConfig.direction === 'asc' ? ' ▲' : ' ▼'}</span>;
  };

  useEffect(() => {
    async function fetchData() {
      const q = query(collection(db, "transacciones"));
      const snap = await getDocs(q);
      const sorted = snap.docs.map(cleanFirebaseData).sort(
        (a, b) => Number(a["Num"] || 0) - Number(b["Num"] || 0)
      );
      setData(sorted);
      setLoading(false);
    }
    fetchData();
  }, []);

  const checkReferentialIntegrity = async (transactionNum: number) => {
    const collectionsToCheck = [
      { name: 'manejo_de_caja', label: 'Caja' },
      { name: 'salarios', label: 'Salarios' },
      { name: 'corpus_christi', label: 'Corpus Christi' },
      { name: 'indicadores', label: 'Indicadores' }
    ];

    for (const coll of collectionsToCheck) {
      const q = query(collection(db, coll.name), where("Transacción", "==", transactionNum));
      const snap = await getDocs(q);
      if (!snap.empty) {
        return `Esta transacción está vinculada a ${snap.size} registro(s) en ${coll.label}. No se puede borrar.`;
      }
    }
    return null;
  };

  const attemptDelete = async (row: any) => {
    setIsAnalyzing(true);
    const [error] = await Promise.all([
      checkReferentialIntegrity(Number(row["Num"])),
      new Promise(resolve => setTimeout(resolve, 1000))
    ]);
    setIsAnalyzing(false);
    if (error) {
      setDeleteErrorAlert(error);
    } else {
      setRecordToDelete(row);
    }
  };

  const handleDelete = async () => {
    if (!recordToDelete) return;
    try {
      await deleteDoc(doc(db, "transacciones", recordToDelete.id));
      await logAction('DELETE', 'transacciones', recordToDelete.id, 'pretsodatabase@gmail.com', recordToDelete);
      setData(data.filter(d => d.id !== recordToDelete.id));
      setRecordToDelete(null);
    } catch (error) {
      console.error("Error deleting document: ", error);
    }
  };

  const handleSave = async (updatedRecord: any) => {
    try {
      const { id, ...dataToSave } = updatedRecord;
      await updateDoc(doc(db, "transacciones", id), dataToSave);
      await logAction('EDIT', 'transacciones', id, 'pretsodatabase@gmail.com', dataToSave);
      setData(data.map(d => d.id === id ? updatedRecord : d).sort(
        (a, b) => Number(a["Num"] || 0) - Number(b["Num"] || 0)
      ));
      setRecordToEdit(null);
    } catch (error) {
      console.error("Error updating transaction: ", error);
      alert("Error al actualizar la transacción.");
    }
  };

  const getDocsForTransaction = (row: any) => {
    const docCodes = [];
    for (let i = 1; i <= 10; i++) {
      const val = row[`Doc${i}`];
      if (val) {
        docCodes.push(`Doc ${val}`);
      }
    }
    return docCodes.length > 0 ? docCodes.join(', ') : 'Ninguno';
  };

  const renderDocsForTransaction = (row: any) => {
    const hasDocs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].some(i => row[`Doc${i}`]);
    if (!hasDocs) return 'Ninguno';
    return (
      <button
        onClick={() => setActiveDoc(row["Num"])}
        style={{
          padding: '0.2rem 0.5rem',
          background: 'var(--accent-color)',
          color: 'white',
          borderRadius: '4px',
          border: 'none',
          cursor: 'pointer',
          fontSize: '0.9rem'
        }}
      >
        Ver Documentos
      </button>
    );
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: "1rem" }}>
        <h1>Transacciones</h1>
        {isEditMode && (
          <button 
            onClick={() => setIsCreateOpen(true)}
            style={{ padding: '0.5rem 1rem', background: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            Nuevo Registro
          </button>
        )}
      </div>
      
      {loading ? <p>Cargando datos...</p> : (
        <div style={{ overflowX: "auto" }}>
          <table className="sortable">
            <thead>
              <tr>
                <th onClick={() => requestSort('Num')} style={{ cursor: 'pointer', width: '50px' }}>Num <SortIndicator column="Num" /></th>
                <th onClick={() => requestSort('Noticia')} style={{ cursor: 'pointer' }}>Noticia <SortIndicator column="Noticia" /></th>
                <th onClick={() => requestSort('Fuentes para la generación del dato')} style={{ cursor: 'pointer' }}>Fuentes <SortIndicator column="Fuentes para la generación del dato" /></th>
                <th>Documentos</th>
                {isEditMode && <th>Admin</th>}
              </tr>
            </thead>
            <tbody>
              {sortedData.map(row => (
                <tr key={row.id}>
                  <td>{row["Num"]}</td>
                  <td style={{ maxWidth: '400px' }}>{row["Noticia"]}</td>
                  <td style={{ maxWidth: '200px' }}>{row["Fuentes para la generación del dato"]}</td>
                  <td>{renderDocsForTransaction(row)}</td>
                  {isEditMode && (
                    <td style={{ display: 'flex', gap: '0.5rem' }}>
                      <button onClick={() => setRecordToEdit(row)} style={{ background: 'var(--primary-color)' }}>Editar</button>
                      <button onClick={() => attemptDelete(row)} style={{ background: '#ff4d4f' }}>Borrar</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isCreateOpen && (
        <GenericCreateModal 
          collectionName="transacciones"
          onClose={() => setIsCreateOpen(false)}
          onCreated={(newRecord) => {
            setData(prev => [...prev, newRecord].sort(
              (a, b) => Number(a["Num"] || 0) - Number(b["Num"] || 0)
            ));
          }}
        />
      )}

      {recordToEdit && (
        <GenericEditModal
          collectionName="transacciones"
          record={recordToEdit}
          onClose={() => setRecordToEdit(null)}
          onSave={handleSave}
        />
      )}

      {isAnalyzing && (
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
            maxWidth: '400px',
            width: '90%',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            textAlign: 'center'
          }}>
            <h2 style={{ marginTop: 0, color: 'var(--primary-color)' }}>Por favor espere</h2>
            <div style={{ margin: '1.5rem 0', fontWeight: 'bold' }}>Analizando registros...</div>
          </div>
        </div>
      )}

      {recordToDelete && (
        <ConfirmModal 
          title="Confirmar Borrado"
          message={`¿Está seguro de que desea eliminar la transacción asociada a los documentos: ${getDocsForTransaction(recordToDelete)}?`}
          onConfirm={handleDelete}
          onCancel={() => setRecordToDelete(null)}
          confirmText="Borrar"
        />
      )}

      {deleteErrorAlert && (
        <ConfirmModal 
          title="Error de Integridad"
          message={deleteErrorAlert}
          onCancel={() => setDeleteErrorAlert(null)}
          isAlertOnly={true}
        />
      )}
      {activeDoc && (
        <DocumentModal 
          documentCode={activeDoc} 
          onClose={() => setActiveDoc(null)} 
        />
      )}
    </div>
  );
}
