import EditToggle from "../components/EditToggle";
import { useEffect, useState, useMemo } from "react";
import { collection, getDocs, query, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import TransactionModal from "../components/TransactionModal";
import DocumentModal from "../components/DocumentModal";
import CampoBusqueda from "../components/CampoBusqueda";
import { Resaltado, TextoCoincidencia, CLASE_BOTON_COINCIDENCIA, CLASE_FILA_COINCIDENCIA } from "../components/Resaltado";
import { cleanFirebaseData } from "../utils";
import { useCanEdit } from "../hooks/useCanEdit";
import CeldaAdmin from "../components/CeldaAdmin";
import ConfirmModal from "../components/ConfirmModal";
import { logAction } from "../utils/audit";
import GenericCreateModal from "../components/GenericCreateModal";
import GenericEditModal from "../components/GenericEditModal";
import { useSortableTable } from "../hooks/useSortableTable";
import { useRestoreFocusOnViewChange } from "../hooks/useRestoreFocusOnViewChange";
import SortableTh from "../components/SortableTh";
import { contar } from "../utils/anuncios";
import Tooltip from "../components/Tooltip";
import { resolverCompania, siglaDeReferencia, textoVisibleCompania } from "../utils/referenciaCompania";
import DetailsModal from "../components/DetailsModal";
import { useTerminoBusqueda, useNavegacionGuia } from "../hooks/useTerminoBusqueda";
import { useCoincidenciasSeccion } from "../hooks/useIndiceBusqueda";
import { useDesplazarACoincidencia } from "../hooks/useDesplazarACoincidencia";

export default function Salarios() {
  const [data, setData] = useState<any[]>([]);
  const [companias, setCompanias] = useState<any[]>([]);
  const [transaccionesMap, setTransaccionesMap] = useState<Map<number, any>>(new Map());
  const [loading, setLoading] = useState(true);
  const canEdit = useCanEdit();
  
  const { crudo, termino, fijar, quitar } = useTerminoBusqueda();
  const { parametros, irA } = useNavegacionGuia();
  const guia = useCoincidenciasSeccion('salarios', termino);

  const [recordToDelete, setRecordToDelete] = useState<any>(null);
  const [brokenLinkAlert, setBrokenLinkAlert] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const [recordToEdit, setRecordToEdit] = useState<any | null>(null);

  const [selectedCompId, setSelectedCompId] = useState<string | null>(null);
  const [activeTransaction, setActiveTransaction] = useState<string | number | null>(null);
  const [activeDocuments, setActiveDocuments] = useState<string | number | null>(null);
  const [recordToView, setRecordToView] = useState<any | null>(null);

  const [filterCompania, setFilterCompania] = useState('');
  const [filterTemporada, setFilterTemporada] = useState('');
  const [filterAmbito, setFilterAmbito] = useState('');

  useEffect(() => {
    // Refleja la URL en la selección, también cuando el parámetro falta (botón Atrás).
    setSelectedCompId(parametros.get("compania"));
  }, [parametros]);

  useEffect(() => {
    async function fetchData() {
      const qSal = query(collection(db, "salarios"));
      const snapSal = await getDocs(qSal);
      const docsSal = snapSal.docs.map(cleanFirebaseData).sort(
        (a, b) => Number(a["Indicador de registro"] || 0) - Number(b["Indicador de registro"] || 0)
      );
      setData(docsSal);

      const qComp = query(collection(db, "companias"));
      const snapComp = await getDocs(qComp);
      const docsComp = snapComp.docs.map(cleanFirebaseData).sort(
        (a, b) => Number(a["Indicador de registro"] || 0) - Number(b["Indicador de registro"] || 0)
      );
      setCompanias(docsComp);
      
      const qTrans = query(collection(db, "transacciones"));
      const snapTrans = await getDocs(qTrans);
      const tMap = new Map<number, any>();
      snapTrans.docs.forEach(d => tMap.set(Number(d.data().Num), d.data()));
      setTransaccionesMap(tMap);
      
      setLoading(false);
    }
    fetchData();
  }, []);

  const attemptDelete = async (row: any) => {
    setRecordToDelete(row);
  };

  const handleDelete = async () => {
    if (!recordToDelete) return;
    try {
      await deleteDoc(doc(db, "salarios", recordToDelete.id));
      await logAction('DELETE', 'salarios', recordToDelete.id, recordToDelete);
      setData(data.filter(d => d.id !== recordToDelete.id));
      setRecordToDelete(null);
    } catch (error) {
      console.error("Error deleting document: ", error);
    }
  };

  const handleSave = async (updatedRecord: any) => {
    try {
      const { id, ...dataToSave } = updatedRecord;
      await updateDoc(doc(db, "salarios", id), dataToSave);
      await logAction('EDIT', 'salarios', id, dataToSave);
      setData(data.map(d => d.id === id ? updatedRecord : d).sort(
        (a, b) => Number(a["Indicador de registro"] || 0) - Number(b["Indicador de registro"] || 0)
      ));
      setRecordToEdit(null);
    } catch (error) {
      console.error("Error updating document: ", error);
      alert("Error al actualizar el registro.");
    }
  };

  const companiasMap = useMemo(() => {
    const map = new Map();
    companias.forEach(c => map.set(String(c["Indicador de registro"]), c));
    return map;
  }, [companias]);

  // Misma regla que cuenta el índice de compañías (resolverCompania): número, "7.0" o sigla heredada.
  const companiasReferenciadas = new Set<unknown>(data.map(d => resolverCompania(d["Sigla Compañía"], companias)).filter(Boolean));
  const companiasInData = companias.filter(c => companiasReferenciadas.has(c));
  const uniqueCompanias = Array.from(new Set(companiasInData.map(c => String(c["Indicador de registro"])))).filter(Boolean).sort();
  const uniqueTemporadas = Array.from(new Set(companiasInData.map(c => c["Temporadas teatrales"]))).filter(Boolean).sort();
  const uniqueAmbitos = Array.from(new Set(companiasInData.map(c => c["Ámbito"]))).filter(Boolean).sort();

  // Nivel 2: con un término válido solo se listan las compañías con coincidencia.
  const conCoincidencia = new Set<unknown>(guia.unidades.map(u => resolverCompania(u.parametros.compania, companias)).filter(Boolean));

  const filteredCompanias = companiasInData.filter(c => {
    if (termino && !conCoincidencia.has(c)) return false;
    if (filterCompania && String(c["Indicador de registro"]) !== filterCompania) return false;
    if (filterTemporada && c["Temporadas teatrales"] !== filterTemporada) return false;
    if (filterAmbito && c["Ámbito"] !== filterAmbito) return false;
    return true;
  });

  useRestoreFocusOnViewChange(
    termino
      ? (selectedCompId ? `detail:${selectedCompId}` : `search:${termino}`)
      : selectedCompId ? `detail:${selectedCompId}` : 'list'
  );
  const siglaSeleccionada = siglaDeReferencia(selectedCompId, companias);
  const companiaSeleccionada = resolverCompania(selectedCompId, companias);
  const detailData = companiaSeleccionada
    ? data.filter(d => resolverCompania(d["Sigla Compañía"], [companiaSeleccionada]) !== null)
    : [];

  const { items: sortedFilteredCompanias, requestSort: sortComp, sortConfig: scComp } = useSortableTable(filteredCompanias);
  const { items: sortedDetailData } = useSortableTable(detailData);

  const registrosConCoincidencia = termino ? sortedDetailData.filter(d => guia.porId.has(String(d.id))).length : 0;

  // Estado de la carga del índice con término: «Buscando…» solo si aún no hay resultado previo.
  const avisoCarga = termino === null ? null
    : guia.estado === 'error' ? 'No se pudo realizar la búsqueda.'
    : guia.estado === 'cargando' && guia.unidades.length === 0 ? 'Buscando…'
    : null;

  const anuncioResultados = avisoCarga && (!selectedCompId || companiaSeleccionada)
    ? avisoCarga
    : !selectedCompId
    ? (termino
      ? `Búsqueda: ${contar(sortedFilteredCompanias.length, 'compañía', 'compañías')} con «${crudo}»`
      : `Listado: ${contar(sortedFilteredCompanias.length, 'registro', 'registros')}`)
    : !companiaSeleccionada
    ? 'No se encontró la compañía seleccionada'
    : termino
    ? `Detalle de ${siglaSeleccionada}: ${contar(sortedDetailData.length, 'registro', 'registros')}, ${registrosConCoincidencia} con «${crudo}»`
    : `Detalle de ${siglaSeleccionada}: ${contar(sortedDetailData.length, 'registro', 'registros')}`;

  // Espera a los datos de la página y al índice: con el índice en caché el efecto correría antes de que existan las filas.
  useDesplazarACoincidencia(!loading && termino && guia.estado === 'listo' && selectedCompId ? `${termino}|${selectedCompId}` : null);

  // Sin coincidencias del término (no por los desplegables): se informa en lugar de mostrar la tabla vacía.
  const sinCoincidencias = termino !== null && !companiasInData.some(c => conCoincidencia.has(c));
  const mensajeBusqueda = avisoCarga ?? (sinCoincidencias ? `No se encontró «${crudo}» en Remuneraciones.` : null);

  return (
    <div>
      <div className="cabecera-pagina">
        <div className="titulo-pagina">
          <h1>Remuneraciones</h1>
          <Tooltip label="Acerca de Remuneraciones" content="En esta sección se listan las remuneraciones y pagos específicos que la compañía efectuó a diversas personas (actores, músicos, tramoyistas, etc.) por su trabajo durante las diferentes temporadas." />
        </div>
        <div className="acciones-cabecera">
          <CampoBusqueda etiqueta="Buscar en esta sección" valorInicial={crudo} onBuscar={t => { setSelectedCompId(null); fijar(t); }} onLimpiar={quitar} />
          <EditToggle />
          {canEdit && (
            <button type="button" className="boton boton-editor" onClick={() => setIsCreateOpen(true)}>Nuevo registro</button>
          )}
        </div>
      </div>

      {!loading && <output aria-live="polite" className="visually-hidden">{anuncioResultados}</output>}
      
      {selectedCompId && (
        <button onClick={() => { setSelectedCompId(null); irA({ compania: null }); }} style={{ padding: '0.5rem 1rem', marginBottom: '1rem' }}>{termino ? 'Volver a los resultados' : 'Volver a listado inicial'}</button>
      )}

      {!loading && !selectedCompId && !mensajeBusqueda && <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Mostrando {sortedFilteredCompanias.length} registros</p>}

      {loading ? <p>Cargando datos...</p> : !selectedCompId ? (
        <div>
          <div className="fila-filtros">
            <select
              value={filterCompania}
              onChange={e => setFilterCompania(e.target.value)}
              aria-label="Filtrar por compañía"
            >
              <option value="">Todas las compañías</option>
              {uniqueCompanias.map(opt => {
                const c = companiasMap.get(opt);
                return <option key={opt} value={opt}>{c ? textoVisibleCompania(c) : siglaDeReferencia(opt, companias)}</option>;
              })}
            </select>
            <select
              value={filterTemporada}
              onChange={e => setFilterTemporada(e.target.value)}
              aria-label="Filtrar por temporada"
            >
              <option value="">Todas las temporadas</option>
              {uniqueTemporadas.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
            <select
              value={filterAmbito}
              onChange={e => setFilterAmbito(e.target.value)}
              aria-label="Filtrar por ámbito"
            >
              <option value="">Todos los ámbitos</option>
              {uniqueAmbitos.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>
          {mensajeBusqueda ? (
            <>
              <p style={{ color: 'var(--text-muted)' }}>{mensajeBusqueda}</p>
              {guia.estado === 'error' && <p><button type="button" onClick={guia.reintentar}>Reintentar</button></p>}
            </>
          ) : (
          <div className="tabla-desplazable">
            <table className="sortable">
              <caption className="visually-hidden">Compañías de Remuneraciones</caption>
              <thead>
                <tr>
                  <SortableTh label="Compañía" sortKey="Sigla Compañía" sortConfig={scComp} onSort={sortComp} />
                  <SortableTh label="Autores" sortKey="Autores" sortConfig={scComp} onSort={sortComp} />
                  <SortableTh label="Temporadas" sortKey="Temporadas teatrales" sortConfig={scComp} onSort={sortComp} />
                  <SortableTh label="Ámbito" sortKey="Ámbito" sortConfig={scComp} onSort={sortComp} />
                  <th scope="col"><span className="visually-hidden">Detalle</span></th>
                </tr>
              </thead>
              <tbody>
                {sortedFilteredCompanias.map((c, i) => {
                  const fullName = c["Nombre Compañía"] ? `${c["Sigla Compañía"]} / ${c["Nombre Compañía"]}` : c["Sigla Compañía"];
                  return (
                  <tr key={i}>
                    <td><Resaltado texto={fullName} termino={termino} /></td>
                    <td><Resaltado texto={c["Autores"]} termino={termino} /></td>
                    <td><Resaltado texto={c["Temporadas teatrales"]} termino={termino} anio /></td>
                    <td><Resaltado texto={c["Ámbito"]} termino={termino} /></td>
                    <td><button onClick={() => { const id = String(c["Indicador de registro"]); setSelectedCompId(id); irA({ compania: id }); }}>TRATO</button></td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
          )}
        </div>
      ) : !companiaSeleccionada ? (
        <p style={{ color: 'var(--text-muted)' }}>Compañía no encontrada</p>
      ) : (
        <div className="tabla-desplazable">
          {termino && guia.porId.size === 0 && (guia.estado === 'cargando' || guia.estado === 'error') && (
            <p style={{ color: 'var(--text-muted)' }}>{guia.estado === 'cargando' ? 'Buscando…' : 'No se pudo realizar la búsqueda.'}</p>
          )}
          <div style={{ marginBottom: '1rem' }}><p style={{ color: 'var(--text-muted)' }}>{sortedDetailData.length} registros para {siglaSeleccionada}</p></div>
          <table className="sortable">
            <caption className="visually-hidden">{`Remuneraciones de ${siglaSeleccionada}`}</caption>
            <thead>
              <tr>
                <th scope="col">Ciudad</th>
                <th scope="col">Año</th>
                <th scope="col">Personas</th>
                <th scope="col">Ocupación</th>
                <th scope="col">Remuneración</th>
                <th scope="col">Documentos</th>
                <th scope="col"><span className="visually-hidden">Transacción</span></th>
                {canEdit && <th scope="col">Admin</th>}
              </tr>
            </thead>
            <tbody>
              {sortedDetailData.map(row => {
                const isBroken = row["Transacción"] && !transaccionesMap.has(Number(row["Transacción"]));
                const r = termino ? guia.porId.get(String(row.id)) : undefined;
                return (
                <tr key={row.id} className={r ? CLASE_FILA_COINCIDENCIA : undefined}>
                  <td><Resaltado texto={row["Ciudad"]} termino={termino} /></td>
                  <td><Resaltado texto={row["Año"]} termino={termino} anio /></td>
                  <td><Resaltado texto={row["Beneficiario "]} termino={termino} /></td>
                  <td><Resaltado texto={row["Encargo"]} termino={termino} /></td>
                  <td><Resaltado texto={row["Monto a pagar"]} termino={termino} /></td>
                  <td>
                    {row["Transacción"] && !isBroken && (() => {
                      const trans = transaccionesMap.get(Number(row["Transacción"]));
                      if (!trans) return null;
                      const docs = [1,2,3,4,5,6,7,8,9,10].map(i => trans[`Doc${i}`]).filter(Boolean);
                      return (
                        <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                          {docs.map((docCode, idx) => (
                            <button key={idx} onClick={() => setActiveDocuments(docCode)} className={r?.documentos.some(d => String(d) === String(docCode)) ? CLASE_BOTON_COINCIDENCIA : undefined} style={{ fontSize: '0.85rem', padding: '0.1rem 0.4rem', cursor: 'pointer', background: 'var(--accent-color)', color: 'var(--on-accent)', border: 'none', borderRadius: '4px' }}>Doc. {docCode}{r?.documentos.some(d => String(d) === String(docCode)) && <TextoCoincidencia crudo={crudo} />}</button>
                          ))}
                        </div>
                      );
                    })()}
                  </td>
                  <td><div className="acciones-celda">
                    {row["Transacción"] && (
                      isBroken ? 
                        <button style={{ background: '#ff4d4f' }} onClick={() => setBrokenLinkAlert(`El enlace a la transacción ${row["Transacción"]} está roto.`)}>Enlace roto</button>
                      : (
                        <button onClick={() => setActiveTransaction(row["Transacción"])} className={r?.transaccion ? CLASE_BOTON_COINCIDENCIA : undefined}>Transacción{r?.transaccion && <TextoCoincidencia crudo={crudo} />}</button>
                      )
                    )}
                  </div></td>
                  {canEdit && <CeldaAdmin onEditar={() => setRecordToEdit(row)} onBorrar={() => attemptDelete(row)} />}
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      )}
      {activeTransaction && <TransactionModal transactionCode={activeTransaction} termino={termino} onClose={() => setActiveTransaction(null)} />}
      {activeDocuments && <DocumentModal documentCode={activeDocuments} termino={termino} onClose={() => setActiveDocuments(null)} />}
      {recordToView && <DetailsModal record={recordToView} collectionName="salarios" onClose={() => setRecordToView(null)} />}
      
      {isCreateOpen && (
        <GenericCreateModal 
          collectionName="salarios"
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
          collectionName="salarios"
          record={recordToEdit}
          onClose={() => setRecordToEdit(null)}
          onSave={handleSave}
        />
      )}

      {recordToDelete && (
        <ConfirmModal 
          title="Confirmar eliminación"
          message={`¿Estás seguro de que deseas eliminar este registro de remuneración para ${recordToDelete["Beneficiario "]}?`}
          onConfirm={handleDelete}
          onCancel={() => setRecordToDelete(null)}
        />
      )}

      {brokenLinkAlert && (
        <div style={{ position: 'fixed', bottom: '2rem', right: '2rem', background: 'var(--danger-color)', color: 'var(--on-danger)', padding: '1rem', borderRadius: '8px', zIndex: 1000, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          <p role="alert" style={{ margin: 0 }}>{brokenLinkAlert}</p>
          <button onClick={() => setBrokenLinkAlert(null)} style={{ marginTop: '0.5rem', background: 'var(--on-danger)', color: 'var(--danger-color)', border: 'none', padding: '0.2rem 0.5rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Cerrar</button>
        </div>
      )}
    </div>
  );
}
