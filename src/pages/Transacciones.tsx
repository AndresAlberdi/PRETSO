import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, query, deleteDoc, doc, where } from "firebase/firestore";
import { db } from "../firebase";
import { cleanFirebaseData } from "../utils";
import { useCanLoad } from "../hooks/useCanEdit";
import CeldaAdmin from "../components/CeldaAdmin";
import ConfirmModal from "../components/ConfirmModal";
import BusyModal from "../components/BusyModal";
import { logAction } from "../utils/audit";
import GenericCreateModal from "../components/GenericCreateModal";
import GenericEditModal from "../components/GenericEditModal";
import DocumentModal from "../components/DocumentModal";
import { updateDoc } from "firebase/firestore";
import { useSortableTable } from "../hooks/useSortableTable";
import SortableTh from "../components/SortableTh";
import SearchBar, { type SearchFilter } from "../components/SearchBar";
import { filtrarRegistros } from "../utils/filtrarRegistros";
import { CAMPOS_BUSQUEDA_TRANSACCIONES } from "../utils/camposBusqueda";

const SEARCH_CATEGORIES = [
  { id: 'num', label: 'Nro.' },
  { id: 'noticia', label: 'Noticia' },
  { id: 'fuentes', label: 'Fuentes' },
  { id: 'doc', label: 'Documento vinculado' },
  { id: 'all', label: 'Texto libre' },
];

export default function Transacciones() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const canLoad = useCanLoad();
  const [recordToDelete, setRecordToDelete] = useState<any>(null);
  const [deleteErrorAlert, setDeleteErrorAlert] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [recordToEdit, setRecordToEdit] = useState<any | null>(null);
  const [activeDoc, setActiveDoc] = useState<string | number | null>(null);

  const [filters, setFilters] = useState<SearchFilter[]>([]);
  const filteredData = useMemo(() => filtrarRegistros(data, filters, CAMPOS_BUSQUEDA_TRANSACCIONES), [data, filters]);

  const { items: sortedData, requestSort, sortConfig } = useSortableTable(filteredData);

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
      { name: 'salarios', label: 'Remuneraciones' },
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
      await logAction('DELETE', 'transacciones', recordToDelete.id, recordToDelete);
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
      await logAction('EDIT', 'transacciones', id, dataToSave);
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
    const docs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => row[`Doc${i}`]).filter(Boolean);
    if (docs.length === 0) return 'Ninguno';
    return (
      <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
        {docs.map((docCode, idx) => (
          <button
            key={idx}
            onClick={() => setActiveDoc(docCode)}
            style={{
              padding: '0.1rem 0.5rem',
              background: 'var(--accent-color)',
              color: 'var(--on-accent)',
              borderRadius: '4px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.85rem'
            }}
          >
            Doc. {docCode}
          </button>
        ))}
      </div>
    );
  };

  return (
    <div>
      <div className="cabecera-pagina" style={{ flexWrap: 'wrap' }}>
        <div>
          <h1>Transacciones</h1>
          {canLoad && <p className="etiqueta-editor">Solo editores</p>}
        </div>
        <div className="acciones-cabecera">
          <SearchBar onSearch={setFilters} categories={SEARCH_CATEGORIES} />
          {canLoad && (
            <button type="button" className="boton boton-editor" onClick={() => setIsCreateOpen(true)}>Nuevo registro</button>
          )}
        </div>
      </div>
      
      {loading ? <p>Cargando datos...</p> : (
        <>
        <output aria-live="polite" style={{ display: 'block', margin: '0 0 0.5rem' }}>
          {filteredData.length === 0 && filters.length > 0
            ? 'No se encontraron registros con los filtros aplicados.'
            : `Mostrando ${filteredData.length} de ${data.length} registros`}
        </output>
        <div className="tabla-desplazable">
          <table className="sortable">
            <caption className="visually-hidden">Transacciones</caption>
            <thead>
              <tr>
                <SortableTh label="Nro." sortKey="Num" sortConfig={sortConfig} onSort={requestSort} style={{ width: '50px' }} />
                <th scope="col">Noticia</th>
                <th scope="col">Fuentes</th>
                <th scope="col">Documentos</th>
                {canLoad && <th scope="col">Admin</th>}
              </tr>
            </thead>
            <tbody>
              {sortedData.map(row => (
                <tr key={row.id}>
                  <td>{row["Num"]}</td>
                  <td style={{ maxWidth: '400px' }}>{row["Noticia"]}</td>
                  <td style={{ maxWidth: '200px' }}>{row["Fuentes para la generación del dato"]}</td>
                  <td>{renderDocsForTransaction(row)}</td>
                  {canLoad && <CeldaAdmin onEditar={() => setRecordToEdit(row)} onBorrar={() => attemptDelete(row)} />}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
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

      {isAnalyzing && <BusyModal />}

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
