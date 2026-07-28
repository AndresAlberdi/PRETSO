import { useEffect, useState, useMemo } from "react";
import { collection, getDocs, query } from "firebase/firestore";
import { db } from "../firebase";
import { cleanFirebaseData } from "../utils";
import { useAdmin } from "../context/AdminContext";
import ConfirmModal from "../components/ConfirmModal";
import { deleteDoc, doc, where, updateDoc } from "firebase/firestore";
import { logAction } from "../utils/audit";
import GenericCreateModal from "../components/GenericCreateModal";
import GenericEditModal from "../components/GenericEditModal";
import { useNavigate } from "react-router";
import { useSortableTable } from "../hooks/useSortableTable";
import Tooltip from "../components/Tooltip";

export default function IndiceCompanias() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { isEditMode } = useAdmin();
  const [recordToDelete, setRecordToDelete] = useState<any>(null);
  const [deleteErrorAlert, setDeleteErrorAlert] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [recordToEdit, setRecordToEdit] = useState<any | null>(null);

  const [searchQuery, setSearchQuery] = useState("");

  const navigate = useNavigate();

  useEffect(() => {
    async function fetchData() {
      const q = query(collection(db, "companias"));
      const snapshot = await getDocs(q);
      const sorted = snapshot.docs.map(cleanFirebaseData).sort(
        (a, b) => Number(a["Indicador de registro"] || 0) - Number(b["Indicador de registro"] || 0)
      );
      setData(sorted);
      setLoading(false);
    }
    fetchData();
  }, []);

  const checkReferentialIntegrity = async (sigla: string) => {
    const collectionsToCheck = [
      { name: 'manejo_de_caja', label: 'Caja' },
      { name: 'salarios', label: 'Salarios' },
      { name: 'corpus_christi', label: 'Corpus Christi' },
      { name: 'indicadores', label: 'Indicadores' }
    ];

    let totalLinks = 0;
    let messageParts = [];

    for (const coll of collectionsToCheck) {
      const q = query(collection(db, coll.name), where("Sigla Compañía", "==", sigla));
      const snap = await getDocs(q);
      if (!snap.empty) {
        totalLinks += snap.size;
        messageParts.push(`${snap.size} en ${coll.label}`);
      }
    }

    if (totalLinks > 0) {
      return `Esta compañía está vinculada a ${totalLinks} registro(s) (${messageParts.join(', ')}). No se puede borrar.`;
    }
    return null;
  };

  const attemptDelete = async (row: any) => {
    setIsAnalyzing(true);
    const [error] = await Promise.all([
      checkReferentialIntegrity(row["Sigla Compañía"]),
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
      await deleteDoc(doc(db, "companias", recordToDelete.id));
      await logAction('DELETE', 'companias', recordToDelete.id, 'pretsodatabase@gmail.com', recordToDelete);
      setData(data.filter(d => d.id !== recordToDelete.id));
      setRecordToDelete(null);
    } catch (error) {
      console.error("Error deleting document: ", error);
    }
  };

  const handleSave = async (updatedRecord: any) => {
    try {
      const { id, ...dataToSave } = updatedRecord;
      await updateDoc(doc(db, "companias", id), dataToSave);
      await logAction('EDIT', 'companias', id, 'pretsodatabase@gmail.com', dataToSave);
      setData(data.map(d => d.id === id ? updatedRecord : d).sort(
        (a, b) => Number(a["Indicador de registro"] || 0) - Number(b["Indicador de registro"] || 0)
      ));
      setRecordToEdit(null);
    } catch (error) {
      console.error("Error updating document: ", error);
      alert("Error al actualizar la compañía.");
    }
  };

  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return data;
    const q = searchQuery.toLowerCase();
    return data.filter(d => 
      (d["Sigla Compañía"] && String(d["Sigla Compañía"]).toLowerCase().includes(q)) ||
      (d["Nombre Compañía"] && String(d["Nombre Compañía"]).toLowerCase().includes(q)) ||
      (d["Autores"] && String(d["Autores"]).toLowerCase().includes(q))
    );
  }, [data, searchQuery]);

  const { items: sortedData, requestSort, sortConfig } = useSortableTable(filteredData);

  const SortIndicator = ({ column }: { column: string }) => {
    if (!sortConfig || sortConfig.key !== column) return null;
    return <span>{sortConfig.direction === 'asc' ? ' ▲' : ' ▼'}</span>;
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: "1rem" }}>
        <h1>Índice de Compañías</h1>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {isEditMode && (
            <button 
              onClick={() => setIsCreateOpen(true)}
              style={{ padding: '0.5rem 1rem', background: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              Nuevo Registro
            </button>
          )}
          <input 
            type="text" 
            placeholder="Buscar por nombre o autores..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.05)', color: 'white', minWidth: '250px' }}
          />
        </div>
      </div>
      
      {!loading && <p style={{ color: 'var(--text-muted)' }}>Total registros: {sortedData.length}</p>}
      
      {loading ? <p>Cargando datos...</p> : (
        <div style={{ overflowX: "auto" }}>
          <table className="sortable">
            <thead>
              <tr>
                <th onClick={() => requestSort('Sigla Compañía')} style={{ cursor: 'pointer' }}>Sigla (Compañías) <Tooltip content="Sigla única de la compañía" /><SortIndicator column="Sigla Compañía" /></th>
                <th onClick={() => requestSort('Nombre Compañía')} style={{ cursor: 'pointer' }}>Nombre <Tooltip content="Nombre completo de la compañía" /><SortIndicator column="Nombre Compañía" /></th>
                <th onClick={() => requestSort('Autores')} style={{ cursor: 'pointer' }}>Autores <Tooltip content="Personas asociadas" /><SortIndicator column="Autores" /></th>
                <th onClick={() => requestSort('Temporadas teatrales')} style={{ cursor: 'pointer' }}>Temporadas Teatrales <SortIndicator column="Temporadas teatrales" /></th>
                <th onClick={() => requestSort('Ámbito')} style={{ cursor: 'pointer' }}>Ámbito <SortIndicator column="Ámbito" /></th>
                <th>Vínculos Rápidos</th>
                {isEditMode && <th>Admin</th>}
              </tr>
            </thead>
            <tbody>
              {sortedData.map(item => (
                <tr key={item.id}>
                  <td style={{ fontWeight: 'bold' }}>{item["Sigla Compañía"]}</td>
                  <td>{item["Nombre Compañía"]}</td>
                  <td>{item["Autores"]}</td>
                  <td>{item["Temporadas teatrales"]}</td>
                  <td>{item["Ámbito"]}</td>
                  <td style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button onClick={() => navigate(`/?compania=${item["Sigla Compañía"]}`)} style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem' }}>Caja</button>
                    <button onClick={() => navigate(`/salarios?compania=${item["Sigla Compañía"]}`)} style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem' }}>Salarios</button>
                    <button onClick={() => navigate(`/corpus?compania=${item["Sigla Compañía"]}`)} style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem' }}>Corpus Christi</button>
                  </td>
                  {isEditMode && (
                    <td style={{ display: 'flex', gap: '0.5rem' }}>
                      <button onClick={() => setRecordToEdit(item)} style={{ background: 'var(--primary-color)' }}>Editar</button>
                      <button onClick={() => attemptDelete(item)} style={{ background: '#ff4d4f' }}>Borrar</button>
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
          collectionName="companias"
          onClose={() => setIsCreateOpen(false)}
          onCreated={(newRecord) => {
            setData(prev => [...prev, newRecord].sort(
              (a, b) => Number(a["Indicador de registro"] || 0) - Number(b["Indicador de registro"] || 0)
            ));
          }}
        />
      )}

      {recordToEdit && (
        <GenericEditModal
          collectionName="companias"
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
          message={<>¿Está seguro de que desea eliminar la compañía <strong>{recordToDelete["Sigla Compañía"]}</strong>? Esta acción no se puede deshacer.</>}
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
