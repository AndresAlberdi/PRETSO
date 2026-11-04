
import EditToggle from "../components/EditToggle";
import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, query, deleteDoc, doc } from "firebase/firestore";
import { db } from "../firebase";
import { cleanFirebaseData } from "../utils";
import { useCanEdit } from "../hooks/useCanEdit";
import CeldaAdmin from "../components/CeldaAdmin";
import ConfirmModal from "../components/ConfirmModal";
import BusyModal from "../components/BusyModal";
import { logAction } from "../utils/audit";
import GenericCreateModal from "../components/GenericCreateModal";
import GenericEditModal from "../components/GenericEditModal";
import { updateDoc } from "firebase/firestore";
import { useSortableTable } from "../hooks/useSortableTable";
import SortableTh from "../components/SortableTh";
import CampoBusqueda from "../components/CampoBusqueda";
import { Resaltado } from "../components/Resaltado";
import { useTerminoBusqueda } from "../hooks/useTerminoBusqueda";
import { useCoincidenciasSeccion } from "../hooks/useIndiceBusqueda";
import { useDesplazarACoincidencia } from "../hooks/useDesplazarACoincidencia";

export default function Bibliografia() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const canEdit = useCanEdit();
  const [recordToDelete, setRecordToDelete] = useState<any>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [recordToEdit, setRecordToEdit] = useState<any | null>(null);

  const { crudo, termino, fijar, quitar } = useTerminoBusqueda();
  const { estado: estadoBusqueda, porId, reintentar } = useCoincidenciasSeccion("bibliografia", termino);
  const filteredData = useMemo(() => {
    if (!termino) return data;
    return data.filter(d => porId.has(String(d.id)));
  }, [data, termino, porId]);
  useDesplazarACoincidencia(!loading && termino && estadoBusqueda === "listo" ? termino : null);

  const { items: sortedData, requestSort, sortConfig } = useSortableTable(filteredData);

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
          <CampoBusqueda etiqueta="Buscar en esta sección" valorInicial={crudo} onBuscar={fijar} onLimpiar={quitar} />
          <EditToggle />
          {canEdit && (
            <button type="button" className="boton boton-editor" onClick={() => setIsCreateOpen(true)}>Nuevo registro</button>
          )}
        </div>
      </div>
      
      {/* Un solo anuncio persistente: no se desmonta al cargar ni al buscar. */}
      <output aria-live="polite" style={{ display: 'block', margin: '0 0 0.5rem' }}>
        {loading ? '' : termino && estadoBusqueda === 'cargando' && porId.size === 0
          ? 'Buscando…'
          : termino && estadoBusqueda === 'error'
            ? 'No se pudo completar la búsqueda. Intente de nuevo.'
            : filteredData.length === 0 && termino
              ? 'No se encontraron registros con los filtros aplicados.'
              : `Mostrando ${filteredData.length} de ${data.length} registros`}
      </output>
      {!loading && termino && estadoBusqueda === 'error' && (
        <p><button type="button" onClick={reintentar}>Reintentar</button></p>
      )}
      {loading ? <p>Cargando datos...</p> : (
        <>
        <div className="tabla-desplazable">
          <table className="sortable">
            <caption className="visually-hidden">Bibliografía</caption>
            <thead>
              <tr>
                <SortableTh label="Autores" sortKey="Autores" sortConfig={sortConfig} onSort={requestSort} />
                <SortableTh label="Referencias bibliográficas" sortKey="Referencias bibliográficas" sortConfig={sortConfig} onSort={requestSort} />
                {canEdit && <th scope="col">Admin</th>}
              </tr>
            </thead>
            <tbody>
              {sortedData.map(item => (
                <tr key={item.id}>
                  <td><Resaltado texto={item["Autores"]} termino={termino} /></td>
                  <td><Resaltado texto={item["Referencias bibliográficas"]} termino={termino} /></td>
                  {canEdit && <CeldaAdmin onEditar={() => setRecordToEdit(item)} onBorrar={() => attemptDelete(item)} />}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
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
          title="Confirmar borrado"
          message={<>¿Está seguro de que desea eliminar la referencia bibliográfica de <strong>{recordToDelete["Autores"]}</strong>? Esta acción no se puede deshacer.</>}
          onConfirm={handleDelete}
          onCancel={() => setRecordToDelete(null)}
          confirmText="Borrar"
        />
      )}
    </div>
  );
}
