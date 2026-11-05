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
import RenombrarCategoriaModal from "../components/RenombrarCategoriaModal";

export default function Indicadores() {
  const [data, setData] = useState<any[]>([]);
  const [companias, setCompanias] = useState<any[]>([]);
  const [transaccionesMap, setTransaccionesMap] = useState<Map<number, any>>(new Map());
  const [loading, setLoading] = useState(true);
  const canEdit = useCanEdit();
  
  const { crudo, termino, fijar, quitar } = useTerminoBusqueda();
  const { parametros, irA } = useNavegacionGuia();
  const guia = useCoincidenciasSeccion('indicadores', termino);

  const [recordToDelete, setRecordToDelete] = useState<any>(null);
  const [brokenLinkAlert, setBrokenLinkAlert] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const [recordToEdit, setRecordToEdit] = useState<any | null>(null);

  // La categoría abierta se refleja en la URL; se resincroniza durante el render, sin efecto.
  const categoriaUrl = parametros.get('categoria');
  const [selectedCategoria, setSelectedCategoria] = useState<string | null>(categoriaUrl);
  const [categoriaUrlPrevia, setCategoriaUrlPrevia] = useState<string | null>(categoriaUrl);
  if (categoriaUrlPrevia !== categoriaUrl) {
    setCategoriaUrlPrevia(categoriaUrl);
    setSelectedCategoria(categoriaUrl);
  }
  const [activeTransaction, setActiveTransaction] = useState<string | number | null>(null);
  const [activeDocuments, setActiveDocuments] = useState<string | number | null>(null);
  const [activeCompania, setActiveCompania] = useState<any | null>(null);

  const [filterCategoria, setFilterCategoria] = useState('');
  const [categoriaARenombrar, setCategoriaARenombrar] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      const qInd = query(collection(db, "indicadores"));
      const snapInd = await getDocs(qInd);
      const docsInd = snapInd.docs.map(cleanFirebaseData).sort(
        (a, b) => Number(a["Indicador de registro"] || 0) - Number(b["Indicador de registro"] || 0)
      );
      setData(docsInd);

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
      await deleteDoc(doc(db, "indicadores", recordToDelete.id));
      await logAction('DELETE', 'indicadores', recordToDelete.id, recordToDelete);
      setData(data.filter(d => d.id !== recordToDelete.id));
      setRecordToDelete(null);
    } catch (error) {
      console.error("Error deleting document: ", error);
    }
  };

  const handleSave = async (updatedRecord: any) => {
    try {
      const { id, ...dataToSave } = updatedRecord;
      await updateDoc(doc(db, "indicadores", id), dataToSave);
      await logAction('EDIT', 'indicadores', id, dataToSave);
      setData(data.map(d => d.id === id ? updatedRecord : d).sort(
        (a, b) => Number(a["Indicador de registro"] || 0) - Number(b["Indicador de registro"] || 0)
      ));
      setRecordToEdit(null);
    } catch (error) {
      console.error("Error updating document: ", error);
      alert("Error al actualizar el indicador.");
    }
  };

  const uniqueCategorias = Array.from(new Set(data.map(d => d["Categorías"]))).filter(Boolean).sort();

  const filteredCategorias = uniqueCategorias.filter(c => {
    if (filterCategoria && c !== filterCategoria) return false;
    return true;
  }).map(c => ({ Categoría: String(c) }));

  // Nivel 2: con término, solo las categorías que tienen coincidencia.
  const conCoincidencia = useMemo(
    () => new Set(guia.unidades.map(u => String(u.parametros.categoria ?? '').trim())),
    [guia.unidades],
  );
  const categoriasVisibles = termino
    ? filteredCategorias.filter(c => conCoincidencia.has(c.Categoría.trim()))
    : filteredCategorias;

  const claveDetalle = selectedCategoria ? `detail:${selectedCategoria}` : null;
  useRestoreFocusOnViewChange(termino ? (claveDetalle ?? `search:${termino}`) : (claveDetalle ?? 'list'));
  const detailData = data.filter(d => selectedCategoria !== null && String(d["Categorías"] ?? '').trim() === selectedCategoria.trim());

  const { items: sortedFilteredCategorias, requestSort: sortCat, sortConfig: scCat } = useSortableTable(categoriasVisibles);
  const { items: sortedDetailData, requestSort: sortDetail, sortConfig: scDetail } = useSortableTable(detailData);

  const buscando = termino !== null && guia.estado === 'cargando' && guia.porId.size === 0;
  const anuncioResultados = termino && guia.estado === 'error'
    ? 'No se pudo realizar la búsqueda.'
    : buscando
    ? 'Buscando…'
    : !selectedCategoria
    ? termino
      ? `Búsqueda: ${contar(sortedFilteredCategorias.length, 'categoría', 'categorías')} con «${crudo}»`
      : `Listado: ${contar(sortedFilteredCategorias.length, 'categoría', 'categorías')}`
    : `Detalle de ${selectedCategoria}: ${contar(sortedDetailData.length, 'transacción', 'transacciones')}${termino ? `, ${sortedDetailData.filter(r => guia.porId.has(String(r.id))).length} con «${crudo}»` : ''}`;

  useDesplazarACoincidencia(!loading && termino && guia.estado === 'listo' && selectedCategoria ? `${termino}|${selectedCategoria}` : null);

  return (
    <div>
      <div className="cabecera-pagina">
        <div className="titulo-pagina">
          <h1>Identificación de indicadores</h1>
          <Tooltip label="Acerca de Identificación de indicadores" content="Recoge transacciones y datos económicos clasificados por diversas categorías o conceptos. Provee información sobre precios y gastos habituales a lo largo de los años en distintas ciudades." />
        </div>
        <div className="acciones-cabecera">
          <CampoBusqueda
            etiqueta="Buscar en esta sección"
            valorInicial={crudo}
            onBuscar={t => { setSelectedCategoria(null); fijar(t); }}
            onLimpiar={quitar}
          />
          <EditToggle />
          {canEdit && (
            <button type="button" className="boton boton-editor" onClick={() => setIsCreateOpen(true)}>Nuevo registro</button>
          )}
        </div>
      </div>

      {!loading && <output aria-live="polite" className="visually-hidden">{anuncioResultados}</output>}
      
      {selectedCategoria && (
        <button onClick={() => { setSelectedCategoria(null); irA({ categoria: null }); }} style={{ padding: '0.5rem 1rem', marginBottom: '1rem' }}>{termino ? 'Volver a los resultados' : 'Volver a listado inicial'}</button>
      )}

      {!loading && !selectedCategoria && !termino && <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Mostrando {sortedFilteredCategorias.length} categorías</p>}

      {loading ? <p>Cargando datos...</p> : !selectedCategoria ? (
        <div>
          <div className="fila-filtros">
            <select
              value={filterCategoria}
              onChange={e => setFilterCategoria(e.target.value)}
              aria-label="Filtrar por categoría"
            >
              <option value="">Todas las categorías</option>
              {uniqueCategorias.map(opt => <option key={String(opt)} value={String(opt)}>{String(opt)}</option>)}
            </select>
          </div>
          {termino && buscando && <p>Buscando…</p>}
          {termino && guia.estado === 'error' && <p role="alert">No se pudo realizar la búsqueda. Intente de nuevo más tarde.</p>}
          {termino && guia.estado === 'listo' && sortedFilteredCategorias.length === 0 && <p>No se encontró «{crudo}» en Identificación de indicadores.</p>}
          {!buscando && !(termino && sortedFilteredCategorias.length === 0) && (
          <div className="tabla-desplazable">
            <table className="sortable">
              <caption className="visually-hidden">Categorías de indicadores</caption>
              <thead>
                <tr>
                  <SortableTh label="Categoría" sortKey="Categoría" sortConfig={scCat} onSort={sortCat} />
                  <th scope="col"><span className="visually-hidden">Detalle</span></th>
                  {canEdit && <th scope="col">Admin</th>}
                </tr>
              </thead>
              <tbody>
                {sortedFilteredCategorias.map((c) => (
                  <tr key={c.Categoría}>
                    <td><Resaltado texto={c.Categoría} termino={termino} /></td>
                    <td><button onClick={() => { setSelectedCategoria(c.Categoría); irA({ categoria: c.Categoría }); }}>LISTA</button></td>
                    {canEdit && (
                      <td><button type="button" onClick={() => setCategoriaARenombrar(c.Categoría)}>Renombrar{" "}<span className="visually-hidden">{`la categoría ${c.Categoría}`}</span></button></td>
                    )}
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
            <caption className="visually-hidden">{`Indicadores de la categoría ${selectedCategoria}`}</caption>
            <thead>
              <tr>
                <SortableTh label="Ciudad" sortKey="Ciudad" sortConfig={scDetail} onSort={sortDetail} />
                <SortableTh label="Años" sortKey="Años" sortConfig={scDetail} onSort={sortDetail} />
                <th scope="col">Concepto</th>
                <th scope="col">Monto</th>
                <th scope="col">Nota</th>
                <th scope="col">Compañía</th>
                <th scope="col">Documentos</th>
                <th scope="col"><span className="visually-hidden">Transacción</span></th>
                {canEdit && <th scope="col">Admin</th>}
              </tr>
            </thead>
            <tbody>
              {sortedDetailData.map(row => {
                const isBroken = row["Transacción"] && !transaccionesMap.has(Number(row["Transacción"]));
                const coincidencia = termino ? guia.porId.get(String(row.id)) : undefined;
                return (
                <tr key={row.id} className={coincidencia ? CLASE_FILA_COINCIDENCIA : undefined}>
                  <td><Resaltado texto={row["Ciudad"]} termino={termino} /></td>
                  <td><Resaltado texto={row["Años"]} termino={termino} anio /></td>
                  <td><Resaltado texto={row["Concepto"]} termino={termino} /></td>
                  <td><Resaltado texto={row["Monto"]} termino={termino} /></td>
                  <td><Resaltado texto={row["Nota"]} termino={termino} /></td>
                  <td>
                    <ListaSiglasCompania referencias={[row["Sigla Compañía"]]} companias={companias} onAbrir={setActiveCompania} termino={termino} />
                  </td>
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
                      : <button className={coincidencia?.transaccion ? CLASE_BOTON_COINCIDENCIA : undefined} onClick={() => setActiveTransaction(row["Transacción"])}>Transacción{coincidencia?.transaccion && <TextoCoincidencia crudo={crudo} />}</button>
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
      
      {isCreateOpen && (
        <GenericCreateModal 
          collectionName="indicadores"
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
          collectionName="indicadores"
          record={recordToEdit}
          onClose={() => setRecordToEdit(null)}
          onSave={handleSave}
        />
      )}

      {categoriaARenombrar && (
        <RenombrarCategoriaModal
          categoria={categoriaARenombrar}
          existentes={uniqueCategorias.map(String)}
          cantidad={data.filter(d => d["Categorías"] === categoriaARenombrar).length}
          onClose={() => setCategoriaARenombrar(null)}
          onParcial={(ids, nuevo) => {
            const hechos = new Set(ids);
            setData(prev => prev.map(d => hechos.has(d.id) ? { ...d, "Categorías": nuevo } : d));
          }}
          onRenombrada={(anterior, nuevo) => {
            setData(prev => prev.map(d => d["Categorías"] === anterior ? { ...d, "Categorías": nuevo } : d));
            setFilterCategoria(f => f === anterior ? nuevo : f);
            setSelectedCategoria(s => s === anterior ? nuevo : s);
            if (parametros.get('categoria') === anterior) irA({ categoria: nuevo }, { reemplazar: true });
          }}
        />
      )}

      {activeCompania && <CompaniaModal compania={activeCompania} termino={termino} onClose={() => setActiveCompania(null)} />}
      
      {recordToDelete && (
        <ConfirmModal 
          title="Confirmar eliminación"
          message={`¿Estás seguro de que deseas eliminar este registro de Indicadores para ${recordToDelete["Concepto"]} (${recordToDelete["Años"]})?`}
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
