import { useEffect, useState, useMemo } from "react";
import { collection, getDocs, query } from "firebase/firestore";
import { db } from "../firebase";
import { cleanFirebaseData } from "../utils";
import { useAdmin } from "../context/AdminContext";
import ConfirmModal from "../components/ConfirmModal";
import BusyModal from "../components/BusyModal";
import { deleteDoc, doc, updateDoc } from "firebase/firestore";
import { contarReferenciasACompania } from "../utils/integridadCompanias";
import { logAction } from "../utils/audit";
import GenericCreateModal from "../components/GenericCreateModal";
import GenericEditModal from "../components/GenericEditModal";
import { useNavigate } from "react-router";
import { useSortableTable } from "../hooks/useSortableTable";
import SortableTh from "../components/SortableTh";
import { contar } from "../utils/anuncios";

export default function IndiceCompanias() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { isEditMode } = useAdmin();
  const [recordToDelete, setRecordToDelete] = useState<any>(null);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
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

  const checkReferentialIntegrity = async (compania: any) => {
    const collectionsToCheck = [
      { name: 'manejo_de_caja', label: 'Caja' },
      { name: 'salarios', label: 'Remuneraciones' },
      { name: 'corpus_christi', label: 'Corpus Christi' },
      { name: 'indicadores', label: 'Indicadores' }
    ];

    let totalLinks = 0;
    let messageParts = [];

    for (const coll of collectionsToCheck) {
      const count = await contarReferenciasACompania(coll.name, compania);
      if (count > 0) {
        totalLinks += count;
        messageParts.push(`${count} en ${coll.label}`);
      }
    }

    if (totalLinks > 0) {
      return `Esta compañía está vinculada a ${totalLinks} registro(s) (${messageParts.join(', ')}). No se puede borrar.`;
    }
    return null;
  };

  const MENSAJE_FALLO_VERIFICACION =
    'No se pudo verificar si la compañía tiene registros vinculados; no se borró. Intente de nuevo.';

  const MENSAJE_FALLO_NAVEGACION =
    'No se pudo comprobar los registros de la compañía. Intente de nuevo.';

  const checkRecordsAndNavigate = async (collectionName: string, path: string, item: any) => {
    setIsAnalyzing(true);
    try {
      const count = await contarReferenciasACompania(collectionName, item);
      if (count === 0) {
        setAlertMessage(`No existen registros en esta sección para la compañía seleccionada.`);
      } else {
        navigate(`${path}?compania=${item["Indicador de registro"]}`);
      }
    } catch (error) {
      console.error("Error verificando registros vinculados: ", error);
      setAlertMessage(MENSAJE_FALLO_NAVEGACION);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const attemptDelete = async (row: any) => {
    setIsAnalyzing(true);
    try {
      const [error] = await Promise.all([
        checkReferentialIntegrity(row),
        new Promise(resolve => setTimeout(resolve, 1000))
      ]);
      if (error) {
        setAlertMessage(error);
      } else {
        setRecordToDelete(row);
      }
    } catch (error) {
      console.error("Error verificando integridad referencial: ", error);
      setAlertMessage(MENSAJE_FALLO_VERIFICACION);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDelete = async () => {
    if (!recordToDelete) return;
    try {
      await deleteDoc(doc(db, "companias", recordToDelete.id));
      await logAction('DELETE', 'companias', recordToDelete.id, recordToDelete);
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
      await logAction('EDIT', 'companias', id, dataToSave);
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

  // Anuncio de la búsqueda con retraso, para no leer cada pulsación de tecla.
  // Se guarda junto a la consulta que lo originó para no mostrar un anuncio caduco.
  const [anuncio, setAnuncio] = useState({ consulta: "", total: -1, texto: "" });
  const consultaActual = searchQuery.trim();
  const totalEncontrados = sortedData.length;
  useEffect(() => {
    if (loading) return;
    if (!consultaActual) {
      // Al vaciar la búsqueda se descarta el anuncio previo para que no reaparezca al retipear.
      const limpieza = setTimeout(() => setAnuncio({ consulta: "", total: -1, texto: "" }), 0);
      return () => clearTimeout(limpieza);
    }
    const temporizador = setTimeout(() => {
      setAnuncio({
        consulta: consultaActual,
        total: totalEncontrados,
        texto: `Búsqueda: ${contar(totalEncontrados, 'compañía encontrada', 'compañías encontradas')}`,
      });
    }, 800);
    return () => clearTimeout(temporizador);
  }, [loading, consultaActual, totalEncontrados]);
  const anuncioBusqueda = consultaActual && anuncio.consulta === consultaActual && anuncio.total === totalEncontrados ? anuncio.texto : "";

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: "1rem" }}>
        <h1>Índice de Compañías</h1>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {isEditMode && (
            <button 
              onClick={() => setIsCreateOpen(true)}
              style={{ padding: '0.5rem 1rem', background: 'var(--primary-color)', color: 'var(--on-primary)', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              Nuevo Registro
            </button>
          )}
          <input 
            type="text" 
            placeholder="Buscar por nombre o autores..." 
            aria-label="Buscar por nombre o autores"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--input-border)', background: 'rgba(255,255,255,0.05)', color: 'white', minWidth: '250px' }}
          />
        </div>
      </div>
      
      {!loading && <output aria-live="polite" className="visually-hidden">{anuncioBusqueda}</output>}

      {!loading && <p style={{ color: 'var(--text-muted)' }}>Total registros: {sortedData.length}</p>}
      
      {loading ? <p>Cargando datos...</p> : (
        <div style={{ overflowX: "auto" }}>
          <table className="sortable">
            <caption className="visually-hidden">Índice de compañías</caption>
            <thead>
              <tr>
                <SortableTh label="Sigla (Compañías)" sortKey="Sigla Compañía" sortConfig={sortConfig} onSort={requestSort} />
                <SortableTh label="Autores" sortKey="Autores" sortConfig={sortConfig} onSort={requestSort} />
                <SortableTh label="Temporadas Teatrales" sortKey="Temporadas teatrales" sortConfig={sortConfig} onSort={requestSort} />
                <SortableTh label="Ámbito" sortKey="Ámbito" sortConfig={sortConfig} onSort={requestSort} />
                <th scope="col">Vínculos Rápidos</th>
                {isEditMode && <th scope="col"><span className="visually-hidden">Admin</span></th>}
              </tr>
            </thead>
            <tbody>
              {sortedData.map(item => (
                <tr key={item.id}>
                  <td style={{ fontWeight: 'bold' }}>{item["Sigla Compañía"]}</td>
                  <td>{item["Autores"]}</td>
                  <td>{item["Temporadas teatrales"]}</td>
                  <td>{item["Ámbito"]}</td>
                  <td style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button onClick={() => checkRecordsAndNavigate('manejo_de_caja', '/caja', item)} style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem' }}>Caja</button>
                    <button onClick={() => checkRecordsAndNavigate('salarios', '/salarios', item)} style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem' }}>Remuneraciones</button>
                    <button onClick={() => checkRecordsAndNavigate('corpus_christi', '/corpus', item)} style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem' }}>Corpus Christi</button>
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

      {isAnalyzing && <BusyModal />}

      {recordToDelete && (
        <ConfirmModal 
          title="Confirmar Borrado"
          message={<>¿Está seguro de que desea eliminar la compañía <strong>{recordToDelete["Sigla Compañía"]}</strong>? Esta acción no se puede deshacer.</>}
          onConfirm={handleDelete}
          onCancel={() => setRecordToDelete(null)}
          confirmText="Borrar"
        />
      )}

      {alertMessage && (
        <ConfirmModal 
          title="Aviso"
          message={alertMessage}
          onCancel={() => setAlertMessage(null)}
          isAlertOnly={true}
        />
      )}
    </div>
  );
}
