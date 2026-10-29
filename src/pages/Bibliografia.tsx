
import EditToggle from "../components/EditToggle";
import { useEffect, useState } from "react";
import { collection, getDocs, query, deleteDoc, doc } from "firebase/firestore";
import { db } from "../firebase";
import { cleanFirebaseData } from "../utils";
import { useAdmin } from "../context/AdminContext";
import ConfirmModal from "../components/ConfirmModal";
import BusyModal from "../components/BusyModal";
import { logAction } from "../utils/audit";
import GenericCreateModal from "../components/GenericCreateModal";
import GenericEditModal from "../components/GenericEditModal";
import { updateDoc } from "firebase/firestore";
import { useSortableTable } from "../hooks/useSortableTable";
import SortableTh from "../components/SortableTh";

export default function Bibliografia() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { isEditMode } = useAdmin();
  const [recordToDelete, setRecordToDelete] = useState<any>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [recordToEdit, setRecordToEdit] = useState<any | null>(null);

  const { items: sortedData, requestSort, sortConfig } = useSortableTable(data);

  useEffect(() => {
    async function fetchData() {
      const q = query(collection(db, "bibliografia"));
      const snapshot = await getDocs(q);
      const sorted = snapshot.docs.map(cleanFirebaseData).sort(
        (a, b) => String(a["Autores"] || '').localeCompare(String(b["Autores"] || ''))
      );
      setData(sorted);
      setLoading(false);
    }
    fetchData();
  }, []);

  const attemptDelete = async (row: any) => {
    setIsAnalyzing(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsAnalyzing(false);
    setRecordToDelete(row);
  };

  const handleDelete = async () => {
    if (!recordToDelete) return;
    try {
      await deleteDoc(doc(db, "bibliografia", recordToDelete.id));
      await logAction('DELETE', 'bibliografia', recordToDelete.id, recordToDelete);
      setData(data.filter(d => d.id !== recordToDelete.id));
      setRecordToDelete(null);
    } catch (error) {
      console.error("Error deleting bibliography record: ", error);
    }
  };

  const handleSave = async (updatedRecord: any) => {
    try {
      const { id, ...dataToSave } = updatedRecord;
      await updateDoc(doc(db, "bibliografia", id), dataToSave);
      await logAction('EDIT', 'bibliografia', id, dataToSave);
      setData(data.map(d => d.id === id ? updatedRecord : d).sort(
        (a, b) => String(a["Autores"] || '').localeCompare(String(b["Autores"] || ''))
      ));
      setRecordToEdit(null);
    } catch (error) {
      console.error("Error updating document: ", error);
      alert("Error al actualizar la referencia bibliográfica.");
    }
  };

  return (
    <div>
      <div className="cabecera-pagina">
        <h1>Bibliografía</h1>
        <div className="acciones-cabecera">
          <EditToggle />
          {isEditMode && (
            <button 
              onClick={() => setIsCreateOpen(true)}
              style={{ padding: '0.5rem 1rem', background: 'var(--primary-color)', color: 'var(--on-primary)', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              Nuevo Registro
            </button>
          )}
        </div>
      </div>
      
      {!loading && <p style={{ color: 'var(--text-muted)' }}>Total registros: {data.length}</p>}
      {loading ? <p>Cargando datos...</p> : (
        <div className="tabla-desplazable">
          <table className="sortable">
            <caption className="visually-hidden">Bibliografía</caption>
            <thead>
              <tr>
                <SortableTh label="Autores" sortKey="Autores" sortConfig={sortConfig} onSort={requestSort} />
                <SortableTh label="Referencias bibliográficas" sortKey="Referencias bibliográficas" sortConfig={sortConfig} onSort={requestSort} />
                {isEditMode && <th scope="col">Admin</th>}
              </tr>
            </thead>
            <tbody>
              {sortedData.map(item => (
                <tr key={item.id}>
                  <td>{item["Autores"]}</td>
                  <td>{item["Referencias bibliográficas"]}</td>
                  {isEditMode && (
                    <td><div className="acciones-celda">
                      <button onClick={() => setRecordToEdit(item)} style={{ background: 'var(--primary-color)' }}>Editar</button>
                      <button onClick={() => attemptDelete(item)} style={{ background: '#ff4d4f' }}>Borrar</button>
                    </div></td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isCreateOpen && (
        <GenericCreateModal 
          collectionName="bibliografia"
          onClose={() => setIsCreateOpen(false)}
          onCreated={(newRecord) => {
            setData(prev => [...prev, newRecord].sort(
              (a, b) => String(a["Autores"] || '').localeCompare(String(b["Autores"] || ''))
            ));
          }}
        />
      )}

      {recordToEdit && (
        <GenericEditModal
          collectionName="bibliografia"
          record={recordToEdit}
          onClose={() => setRecordToEdit(null)}
          onSave={handleSave}
        />
      )}

      {isAnalyzing && <BusyModal />}

      {recordToDelete && (
        <ConfirmModal 
          title="Confirmar Borrado"
          message={<>¿Está seguro de que desea eliminar la referencia bibliográfica de <strong>{recordToDelete["Autores"]}</strong>? Esta acción no se puede deshacer.</>}
          onConfirm={handleDelete}
          onCancel={() => setRecordToDelete(null)}
          confirmText="Borrar"
        />
      )}
    </div>
  );
}
