import EditToggle from "../components/EditToggle";
import { useEffect, useState, useMemo } from "react";
import { collection, getDocs, query, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import TransactionModal from "../components/TransactionModal";
import DocumentModal from "../components/DocumentModal";
import CampoBusqueda from "../components/CampoBusqueda";
import { Resaltado, TextoCoincidencia, CLASE_BOTON_COINCIDENCIA, CLASE_FILA_COINCIDENCIA } from "../components/Resaltado";
import { useTerminoBusqueda, useNavegacionGuia } from "../hooks/useTerminoBusqueda";
import { useCoincidenciasSeccion } from "../hooks/useIndiceBusqueda";
import { useDesplazarACoincidencia } from "../hooks/useDesplazarACoincidencia";
import { cleanFirebaseData } from "../utils";
import CompaniaModal from "../components/CompaniaModal";
import ListaSiglasCompania from "../components/ListaSiglasCompania";
import { camposReferenciaCompania } from "../utils/referenciaCompania";
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
import DetailsModal from "../components/DetailsModal";

export default function CorpusChristi() {
  const [data, setData] = useState<any[]>([]);
  const [companias, setCompanias] = useState<any[]>([]);
  const [transaccionesMap, setTransaccionesMap] = useState<Map<number, any>>(new Map());
  const [loading, setLoading] = useState(true);
  const canEdit = useCanEdit();
  
  const { crudo, termino, fijar, quitar } = useTerminoBusqueda();
  const { parametros, irA } = useNavegacionGuia();
  const guia = useCoincidenciasSeccion('corpus_christi', termino);

  const [recordToDelete, setRecordToDelete] = useState<any>(null);
  const [brokenLinkAlert, setBrokenLinkAlert] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const [recordToEdit, setRecordToEdit] = useState<any | null>(null);

  // La unidad abierta (ciudad y año) se refleja en la URL: se lee, las dos o ninguna.
  // Se resincroniza durante el render cuando cambia la URL, sin efecto.
  const ciudadUrl = parametros.get('ciudad');
  const anioUrl = parametros.get('anio');
  const unidadUrl = ciudadUrl && anioUrl ? { ciudad: ciudadUrl, año: anioUrl } : null;
  const claveUrl = unidadUrl ? `${unidadUrl.ciudad}|${unidadUrl.año}` : null;
  const [selectedCityYear, setSelectedCityYear] = useState<{ ciudad: string, año: string } | null>(unidadUrl);
  const [claveUrlPrevia, setClaveUrlPrevia] = useState<string | null>(claveUrl);
  if (claveUrlPrevia !== claveUrl) {
    setClaveUrlPrevia(claveUrl);
    setSelectedCityYear(unidadUrl);
  }
  const [activeTransaction, setActiveTransaction] = useState<string | number | null>(null);
  const [activeDocuments, setActiveDocuments] = useState<string | number | null>(null);
  const [activeCompania, setActiveCompania] = useState<any | null>(null);
  const [recordToView, setRecordToView] = useState<any | null>(null);

  const [filterCiudad, setFilterCiudad] = useState('');
  const [filterAno, setFilterAno] = useState('');

  useEffect(() => {
    async function fetchData() {
      const qData = query(collection(db, "corpus_christi"));
      const snap = await getDocs(qData);
      const docsData = snap.docs.map(cleanFirebaseData).sort(
        (a, b) => Number(a["Indicador de registro"] || 0) - Number(b["Indicador de registro"] || 0)
      );
      setData(docsData);

      const snapComp = await getDocs(query(collection(db, "companias")));
      setCompanias(snapComp.docs.map(cleanFirebaseData));

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
      await deleteDoc(doc(db, "corpus_christi", recordToDelete.id));
      await logAction('DELETE', 'corpus_christi', recordToDelete.id, recordToDelete);
      setData(data.filter(d => d.id !== recordToDelete.id));
      setRecordToDelete(null);
    } catch (error) {
      console.error("Error deleting document: ", error);
    }
  };

  const handleSave = async (updatedRecord: any) => {
    try {
      const { id, ...dataToSave } = updatedRecord;
      await updateDoc(doc(db, "corpus_christi", id), dataToSave);
      await logAction('EDIT', 'corpus_christi', id, dataToSave);
      setData(data.map(d => d.id === id ? updatedRecord : d).sort(
        (a, b) => Number(a["Indicador de registro"] || 0) - Number(b["Indicador de registro"] || 0)
      ));
      setRecordToEdit(null);
    } catch (error) {
      console.error("Error updating document: ", error);
      alert("Error al actualizar el registro.");
    }
  };

  const uniqueCiudades = Array.from(new Set(data.map(d => d["Ciudad"]))).filter(Boolean).sort();
  const uniqueAnos = Array.from(new Set(data.map(d => d["Año"]))).filter(Boolean).sort();

  const masterGroups = useMemo(() => {
    return Array.from(new Set(data.map(d => `${d["Ciudad"]}|${d["Año"]}`))).map(group => {
      const [c, a] = group.split('|');
      return { ciudad: c, año: a };
    });
  }, [data]);

  const filteredGroups = masterGroups.filter(g => {
    if (filterCiudad && g.ciudad !== filterCiudad) return false;
    if (filterAno && g.año !== filterAno) return false;
    return true;
  });

  // Nivel 2: con término, solo los grupos (ciudad y año) que tienen coincidencia.
  const conCoincidencia = useMemo(
    () => new Set(guia.unidades.map(u => `${String(u.parametros.ciudad ?? '').trim()}|${String(u.parametros.anio ?? '').trim()}`)),
    [guia.unidades],
  );
  const gruposVisibles = termino
    ? filteredGroups.filter(g => conCoincidencia.has(`${String(g.ciudad).trim()}|${String(g.año).trim()}`))
    : filteredGroups;

  const claveDetalle = selectedCityYear ? `detail:${selectedCityYear.ciudad}|${selectedCityYear.año}` : null;
  useRestoreFocusOnViewChange(termino ? (claveDetalle ?? `search:${termino}`) : (claveDetalle ?? 'list'));
  const detailData = data.filter(d => 
    selectedCityYear
    && String(d["Ciudad"] ?? '').trim() === selectedCityYear.ciudad.trim()
    && String(d["Año"] ?? '').trim() === String(selectedCityYear.año).trim()
  );

  const { items: sortedFilteredGroups, requestSort: sortGroup, sortConfig: scGroup } = useSortableTable(gruposVisibles);
  const { items: sortedDetailData } = useSortableTable(detailData);

  const buscando = termino !== null && guia.estado === 'cargando' && guia.porId.size === 0;
  const anuncioResultados = termino && guia.estado === 'error'
    ? 'No se pudo realizar la búsqueda.'
    : buscando
    ? 'Buscando…'
    : !selectedCityYear
    ? termino
      ? `Búsqueda: ${contar(sortedFilteredGroups.length, 'registro', 'registros')} con «${crudo}»`
      : `Listado: ${contar(sortedFilteredGroups.length, 'registro', 'registros')}`
    : `Detalle de ${selectedCityYear.ciudad} ${selectedCityYear.año}: ${contar(sortedDetailData.length, 'transacción', 'transacciones')}${termino ? `, ${sortedDetailData.filter(r => guia.porId.has(String(r.id))).length} con «${crudo}»` : ''}`;

  useDesplazarACoincidencia(!loading && termino && guia.estado === 'listo' && selectedCityYear ? `${termino}|${selectedCityYear.ciudad}|${selectedCityYear.año}` : null);

  return (
    <div>
      <div className="cabecera-pagina">
        <div className="titulo-pagina">
          <h1>Corpus Christi</h1>
          <Tooltip label="Acerca de Corpus Christi" content="Muestra los registros financieros y labores encargadas para la celebración del Corpus Christi por diversas ciudades en años específicos, detallando el pago y los fondos." />
        </div>
        <div className="acciones-cabecera">
          <CampoBusqueda
            etiqueta="Buscar en esta sección"
            valorInicial={crudo}
            onBuscar={t => { setSelectedCityYear(null); fijar(t); }}
            onLimpiar={quitar}
          />
          <EditToggle />
          {canEdit && (
            <button type="button" className="boton boton-editor" onClick={() => setIsCreateOpen(true)}>Nuevo registro</button>
          )}
        </div>
      </div>

      {!loading && <output aria-live="polite" className="visually-hidden">{anuncioResultados}</output>}
      
      {selectedCityYear && (
        <button onClick={() => { setSelectedCityYear(null); irA({ ciudad: null, anio: null }); }} style={{ padding: '0.5rem 1rem', marginBottom: '1rem' }}>{termino ? 'Volver a los resultados' : 'Volver a listado inicial'}</button>
      )}

      {!loading && !selectedCityYear && !termino && <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Mostrando {sortedFilteredGroups.length} registros</p>}

      {loading ? <p>Cargando datos...</p> : !selectedCityYear ? (
        <div>
          <div className="fila-filtros">
            <select
              value={filterCiudad}
              onChange={e => setFilterCiudad(e.target.value)}
              aria-label="Filtrar por ciudad"
            >
              <option value="">Todas las ciudades</option>
              {uniqueCiudades.map(opt => <option key={String(opt)} value={String(opt)}>{String(opt)}</option>)}
            </select>
            <select
              value={filterAno}
              onChange={e => setFilterAno(e.target.value)}
              aria-label="Filtrar por año"
            >
              <option value="">Todos los años</option>
              {uniqueAnos.map(opt => <option key={String(opt)} value={String(opt)}>{String(opt)}</option>)}
            </select>
          </div>
          {termino && buscando && <p>Buscando…</p>}
          {termino && guia.estado === 'error' && <p role="alert">No se pudo realizar la búsqueda. Intente de nuevo más tarde.</p>}
          {termino && guia.estado === 'listo' && sortedFilteredGroups.length === 0 && <p>No se encontró «{crudo}» en Corpus Christi.</p>}
          {!buscando && !(termino && sortedFilteredGroups.length === 0) && (
          <div className="tabla-desplazable">
            <table className="sortable">
              <caption className="visually-hidden">Ciudades y años de Corpus Christi</caption>
              <thead>
                <tr>
                  <SortableTh label="Ciudad" sortKey="ciudad" sortConfig={scGroup} onSort={sortGroup} />
                  <SortableTh label="Año" sortKey="año" sortConfig={scGroup} onSort={sortGroup} />
                  <th scope="col"><span className="visually-hidden">Detalle</span></th>
                </tr>
              </thead>
              <tbody>
                {sortedFilteredGroups.map((g, i) => (
                  <tr key={i}>
                    <td><Resaltado texto={g.ciudad} termino={termino} /></td>
                    <td><Resaltado texto={g.año} termino={termino} anio /></td>
                    <td><button onClick={() => { setSelectedCityYear(g); irA({ ciudad: g.ciudad, anio: String(g.año) }); }}>TRATO</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </div>
      ) : (
        <div className="tabla-desplazable">
          <div style={{ marginBottom: '1rem' }}><p style={{ color: 'var(--text-muted)' }}>{sortedDetailData.length} transacciones registradas</p></div>
          <table className="sortable">
            <caption className="visually-hidden">{`Transacciones de Corpus Christi en ${selectedCityYear.ciudad}, ${selectedCityYear.año}`}</caption>
            <thead>
              <tr>
                <th scope="col">Encargo</th>
                <th scope="col">Encargado</th>
                <th scope="col">Compañías</th>
                <th scope="col">Monto a pagar</th>
                <th scope="col">Fondos</th>
                <th scope="col">Documentos</th>
                <th scope="col"><span className="visually-hidden">Transacción</span></th>
                {canEdit && <th scope="col">Admin</th>}
              </tr>
            </thead>
            <tbody>
              {sortedDetailData.map(row => {
                const isBroken = row["Transacción"] && !transaccionesMap.has(Number(row["Transacción"]));
                const referenciasCompania = camposReferenciaCompania('corpus_christi').map(campo => row[campo]);
                const coincidencia = termino ? guia.porId.get(String(row.id)) : undefined;
                
                return (
                <tr key={row.id} className={coincidencia ? CLASE_FILA_COINCIDENCIA : undefined}>
                  <td><Resaltado texto={row["Encargo"]} termino={termino} /></td>
                  <td><Resaltado texto={row["Encargado "]} termino={termino} /></td>
                  <td>
                    <ListaSiglasCompania referencias={referenciasCompania} companias={companias} onAbrir={setActiveCompania} termino={termino} />
                  </td>
                  <td><Resaltado texto={row["Monto a pagar"]} termino={termino} /></td>
                  <td><Resaltado texto={row["Fondos"]} termino={termino} /></td>
                  <td>
                    {row["Transacción"] && !isBroken && (() => {
                      const trans = transaccionesMap.get(Number(row["Transacción"]));
                      if (!trans) return null;
                      const docs = [1,2,3,4,5,6,7,8,9,10].map(i => trans[`Doc${i}`]).filter(Boolean);
                      return (
                        <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                          {docs.map((docCode, idx) => {
                            const docCoincide = coincidencia?.documentos.some(d => String(d) === String(docCode)) === true;
                            return (
                            <button key={idx} className={docCoincide ? CLASE_BOTON_COINCIDENCIA : undefined} onClick={() => setActiveDocuments(docCode)} style={{ fontSize: '0.85rem', padding: '0.1rem 0.4rem', cursor: 'pointer', background: 'var(--accent-color)', color: 'var(--on-accent)', border: 'none', borderRadius: '4px' }}>Doc. {docCode}{docCoincide && <TextoCoincidencia crudo={crudo} />}</button>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </td>
                  <td><div className="acciones-celda">
                    {row["Transacción"] && (
                      isBroken ? 
                        <button style={{ background: '#ff4d4f' }} onClick={() => setBrokenLinkAlert(`El enlace a la transacción ${row["Transacción"]} está roto.`)}>Enlace roto</button>
                      : (
                        <button className={coincidencia?.transaccion ? CLASE_BOTON_COINCIDENCIA : undefined} onClick={() => setActiveTransaction(row["Transacción"])}>Transacción{coincidencia?.transaccion && <TextoCoincidencia crudo={crudo} />}</button>
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
      {recordToView && <DetailsModal record={recordToView} onClose={() => setRecordToView(null)} />}
      
      {isCreateOpen && (
        <GenericCreateModal 
          collectionName="corpus_christi"
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
          collectionName="corpus_christi"
          record={recordToEdit}
          onClose={() => setRecordToEdit(null)}
          onSave={handleSave}
        />
      )}

      {activeCompania && <CompaniaModal compania={activeCompania} termino={termino} onClose={() => setActiveCompania(null)} />}
      
      {recordToDelete && (
        <ConfirmModal 
          title="Confirmar eliminación"
          message={`¿Estás seguro de que deseas eliminar este registro para ${recordToDelete["Encargado "]}?`}
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
