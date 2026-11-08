import EditToggle from "../components/EditToggle";
import { useEffect, useState, useMemo } from "react";
import { collection, getDocs, query } from "firebase/firestore";
import { db } from "../firebase";
import { cleanFirebaseData } from "../utils";
import { useCanEdit } from "../hooks/useCanEdit";
import CeldaAdmin from "../components/CeldaAdmin";
import ConfirmModal from "../components/ConfirmModal";
import { codigoError } from "../utils/codigoError";
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
import CampoBusqueda from "../components/CampoBusqueda";
import { Resaltado } from "../components/Resaltado";
import { useTerminoBusqueda } from "../hooks/useTerminoBusqueda";
import { useCoincidenciasSeccion } from "../hooks/useIndiceBusqueda";
import { useDesplazarACoincidencia } from "../hooks/useDesplazarACoincidencia";

export default function IndiceCompanias() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorCarga, setErrorCarga] = useState(false);
  const canEdit = useCanEdit();
  const [recordToDelete, setRecordToDelete] = useState<any>(null);
  const [errorOperacion, setErrorOperacion] = useState<string | null>(null);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [recordToEdit, setRecordToEdit] = useState<any | null>(null);

  const { crudo, termino, fijar, quitar } = useTerminoBusqueda();
  const { estado: estadoBusqueda, porId, reintentar } = useCoincidenciasSeccion("companias", termino);

  const navigate = useNavigate();

  useEffect(() => {
    async function fetchData() {
      try {
        const q = query(collection(db, "companias"));
        const snapshot = await getDocs(q);
        const sorted = snapshot.docs.map(cleanFirebaseData).sort(
          (a, b) => Number(a["Indicador de registro"] || 0) - Number(b["Indicador de registro"] || 0)
        );
        setData(sorted);
        setLoading(false);
      } catch (error) {
        console.error('No se pudieron cargar los datos:', codigoError(error));
        setErrorCarga(true);
      }
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
      console.error('No se pudo verificar los registros vinculados:', codigoError(error));
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
      console.error('No se pudo verificar la integridad referencial:', codigoError(error));
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
      console.error('No se pudo borrar la compañía:', codigoError(error));
      setRecordToDelete(null);
      setErrorOperacion('No se pudo borrar la compañía. Inténtelo de nuevo.');
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
      console.error('No se pudo actualizar la compañía:', codigoError(error));
      alert("Error al actualizar la compañía.");
    }
  };

  const filteredData = useMemo(() => {
    if (!termino) return data;
    return data.filter(d => porId.has(String(d.id)));
  }, [data, termino, porId]);

  const { items: sortedData, requestSort, sortConfig } = useSortableTable(filteredData);

  // Anuncio único y persistente: el índice termina de cargar y recién entonces se cuenta.
  const totalEncontrados = sortedData.length;
  const anuncioBusqueda = termino && estadoBusqueda === "listo"
    ? `Búsqueda: ${contar(totalEncontrados, 'compañía encontrada', 'compañías encontradas')}`
    : termino && estadoBusqueda === "error"
      ? "No se pudo completar la búsqueda. Intente de nuevo."
      : termino ? "Buscando…" : "";
  useDesplazarACoincidencia(!loading && termino && estadoBusqueda === "listo" ? termino : null);
  const buscando = Boolean(termino) && estadoBusqueda === "cargando" && porId.size === 0;
  const falloBusqueda = Boolean(termino) && estadoBusqueda === "error";

  return (
    <div>
      <div className="cabecera-pagina">
        <h1>Índice de compañías</h1>
        <div className="acciones-cabecera">
          <CampoBusqueda etiqueta="Buscar en esta sección" valorInicial={crudo} onBuscar={fijar} onLimpiar={quitar} />
          <EditToggle />
          {canEdit && (
            <button type="button" className="boton boton-editor" onClick={() => setIsCreateOpen(true)}>Nuevo registro</button>
          )}
        </div>
      </div>
      
      <output aria-live="polite" className="visually-hidden">{loading ? "" : anuncioBusqueda}</output>

      {!loading && falloBusqueda && (
        <p className="aviso-busqueda">No se pudo completar la búsqueda. <button type="button" onClick={reintentar}>Reintentar</button></p>
      )}
      {!loading && buscando && <p style={{ color: 'var(--text-muted)' }}>Buscando…</p>}
      {!loading && !buscando && !falloBusqueda && <p style={{ color: 'var(--text-muted)' }}>Total registros: {sortedData.length}</p>}
      
      {errorCarga ? <p role="alert">No se pudieron cargar los datos. Recargue la página; si el error persiste, avise al equipo técnico.</p> : loading ? <p>Cargando datos...</p> : (
        <div className="tabla-desplazable">
          <table className="sortable">
            <caption className="visually-hidden">Índice de compañías</caption>
            <thead>
              <tr>
                <SortableTh label="Sigla" sortKey="Sigla Compañía" sortConfig={sortConfig} onSort={requestSort} />
                <SortableTh label="Autores" sortKey="Autores" sortConfig={sortConfig} onSort={requestSort} />
                <SortableTh label="Temporadas teatrales" sortKey="Temporadas teatrales" sortConfig={sortConfig} onSort={requestSort} />
                <SortableTh label="Ámbito" sortKey="Ámbito" sortConfig={sortConfig} onSort={requestSort} />
                <th scope="col">Vínculos rápidos</th>
                {canEdit && <th scope="col">Admin</th>}
              </tr>
            </thead>
            <tbody>
              {sortedData.map(item => (
                <tr key={item.id}>
                  <td style={{ fontWeight: 'bold' }}><Resaltado texto={item["Sigla Compañía"]} termino={termino} /></td>
                  <td><Resaltado texto={item["Autores"]} termino={termino} /></td>
                  <td><Resaltado texto={item["Temporadas teatrales"]} termino={termino} anio /></td>
                  <td><Resaltado texto={item["Ámbito"]} termino={termino} /></td>
                  <td><div className="acciones-celda" style={{ flexWrap: 'wrap' }}>
                    <button onClick={() => checkRecordsAndNavigate('manejo_de_caja', '/caja', item)} style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem' }}>Caja</button>
                    <button onClick={() => checkRecordsAndNavigate('salarios', '/salarios', item)} style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem' }}>Remuneraciones</button>
                    <button onClick={() => checkRecordsAndNavigate('corpus_christi', '/corpus', item)} style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem' }}>Corpus Christi</button>
                  </div></td>
                  {canEdit && <CeldaAdmin onEditar={() => setRecordToEdit(item)} onBorrar={() => attemptDelete(item)} />}
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
          title="Confirmar borrado"
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
      {errorOperacion && (
        <ConfirmModal
          title="No se pudo completar la operación"
          message={errorOperacion}
          onCancel={() => setErrorOperacion(null)}
          isAlertOnly
        />
      )}
    </div>
  );
}
