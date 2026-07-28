import { useEffect, useState } from "react";
import { collection, getDocs, query, deleteDoc, doc } from "firebase/firestore";
import { db } from "../firebase";
import { cleanFirebaseData } from "../utils";
import { useAdmin } from "../context/AdminContext";
import ConfirmModal from "../components/ConfirmModal";
import { logAction } from "../utils/audit";
import GenericCreateModal from "../components/GenericCreateModal";
import GenericEditModal from "../components/GenericEditModal";
import { updateDoc } from "firebase/firestore";
import { useSortableTable } from "../hooks/useSortableTable";

export default function Documentos() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { isEditMode } = useAdmin();
  const [recordToDelete, setRecordToDelete] = useState<any>(null);
  const [deleteErrorAlert, setDeleteErrorAlert] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [recordToEdit, setRecordToEdit] = useState<any | null>(null);

  const { items: sortedData, requestSort, sortConfig } = useSortableTable(data);

  const SortIndicator = ({ column }: { column: string }) => {
    if (!sortConfig || sortConfig.key !== column) return null;
    return <span>{sortConfig.direction === 'asc' ? ' ▲' : ' ▼'}</span>;
  };

  useEffect(() => {
    async function fetchData() {
      const q = query(collection(db, "documentos"));
      const snap = await getDocs(q);
      const sorted = snap.docs.map(cleanFirebaseData).sort(
        (a, b) => Number(a["Doc"] || 0) - Number(b["Doc"] || 0)
      );
      setData(sorted);
      setLoading(false);
    }
    fetchData();
  }, []);

  const checkReferentialIntegrity = async (docId: string) => {
    const tQuery = query(collection(db, "transacciones"));
    const snap = await getDocs(tQuery);
    let linkedCount = 0;
    
    snap.docs.forEach(d => {
      const t = d.data();
      for (let i = 1; i <= 10; i++) {
        if (t[`Doc${i}`] === Number(docId)) {
          linkedCount++;
          break;
        }
      }
    });

    if (linkedCount > 0) {
      return `Este documento está vinculado a ${linkedCount} transacción(es). No se puede borrar.`;
    }
    return null;
  };

  const attemptDelete = async (row: any) => {
    setIsAnalyzing(true);
    const [error] = await Promise.all([
      checkReferentialIntegrity(row["Doc"]),
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
      await deleteDoc(doc(db, "documentos", recordToDelete.id));
      await logAction('DELETE', 'documentos', recordToDelete.id, 'pretsodatabase@gmail.com', recordToDelete);
      setData(data.filter(d => d.id !== recordToDelete.id));
      setRecordToDelete(null);
    } catch (error) {
      console.error("Error deleting document: ", error);
    }
  };

  const handleSave = async (updatedRecord: any) => {
    try {
      const { id, ...dataToSave } = updatedRecord;
      await updateDoc(doc(db, "documentos", id), dataToSave);
      await logAction('EDIT', 'documentos', id, 'pretsodatabase@gmail.com', dataToSave);
      setData(data.map(d => d.id === id ? updatedRecord : d).sort(
        (a, b) => Number(a["Doc"] || 0) - Number(b["Doc"] || 0)
      ));
      setRecordToEdit(null);
    } catch (error) {
      console.error("Error updating document: ", error);
      alert("Error al actualizar el documento.");
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: "1rem" }}>
        <h1>Documentos</h1>
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
                <th onClick={() => requestSort('Doc')} style={{ width: '80px', textAlign: 'center', cursor: 'pointer' }}>Doc ID <SortIndicator column="Doc" /></th>
                <th onClick={() => requestSort('Documento')} style={{ cursor: 'pointer' }}>Documento <SortIndicator column="Documento" /></th>
                {isEditMode && <th>Admin</th>}
              </tr>
            </thead>
            <tbody>
              {sortedData.map(row => (
                <tr key={row.id}>
                  <td style={{ textAlign: 'center' }}>{row["Doc"]}</td>
                  <td style={{ maxWidth: '600px' }}>{row["Documento"]}</td>
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
          collectionName="documentos"
          onClose={() => setIsCreateOpen(false)}
          onCreated={(newRecord) => {
            setData(prev => [...prev, newRecord].sort(
              (a, b) => Number(a["Doc"] || 0) - Number(b["Doc"] || 0)
            ));
          }}
        />
      )}

      {recordToEdit && (
        <GenericEditModal
          collectionName="documentos"
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
          message={`¿Está seguro de que desea eliminar el documento ${recordToDelete["Doc"]}?`}
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
    </div>
  );
}
