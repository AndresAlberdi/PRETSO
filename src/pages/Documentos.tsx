import { useEffect, useMemo, useState } from "react";
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
import SearchBar, { type SearchFilter } from "../components/SearchBar";
import { filtrarRegistros } from "../utils/filtrarRegistros";
import { CAMPOS_BUSQUEDA_DOCUMENTOS } from "../utils/camposBusqueda";

const SEARCH_CATEGORIES = [
  { id: 'doc', label: 'Doc ID' },
  { id: 'all', label: 'Texto libre' },
];

export default function Documentos() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { isEditMode } = useAdmin();
  const [recordToDelete, setRecordToDelete] = useState<any>(null);
  const [deleteErrorAlert, setDeleteErrorAlert] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [recordToEdit, setRecordToEdit] = useState<any | null>(null);

  const [filters, setFilters] = useState<SearchFilter[]>([]);
  const filteredData = useMemo(() => filtrarRegistros(data, filters, CAMPOS_BUSQUEDA_DOCUMENTOS), [data, filters]);

  const { items: sortedData, requestSort, sortConfig } = useSortableTable(filteredData);

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
      await logAction('DELETE', 'documentos', recordToDelete.id, recordToDelete);
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
      await logAction('EDIT', 'documentos', id, dataToSave);
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', marginBottom: "1rem" }}>
        <h1>Documentos</h1>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {isEditMode && (
            <button 
              onClick={() => setIsCreateOpen(true)}
              style={{ padding: '0.5rem 1rem', background: 'var(--primary-color)', color: 'var(--on-primary)', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              Nuevo Registro
            </button>
          )}
          <SearchBar onSearch={setFilters} categories={SEARCH_CATEGORIES} />
        </div>
      </div>
      
      {loading ? <p>Cargando datos...</p> : (
        <>
        <output aria-live="polite" style={{ display: 'block', margin: '0 0 0.5rem' }}>
          {filteredData.length === 0 && filters.length > 0
            ? 'No se encontraron registros con los filtros aplicados.'
            : `Mostrando ${filteredData.length} de ${data.length} registros`}
        </output>
        <div style={{ overflowX: "auto" }}>
          <table className="sortable">
            <thead>
              <tr>
                <SortableTh label="Doc ID" sortKey="Doc" sortConfig={sortConfig} onSort={requestSort} style={{ width: '80px', textAlign: 'center' }} />
                <th scope="col">Documento</th>
                {isEditMode && <th scope="col">Admin</th>}
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
        </>
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

      {isAnalyzing && <BusyModal />}

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
