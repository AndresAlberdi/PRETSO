import { useEffect, useState, useMemo } from "react";
import { collection, getDocs, query, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { useLocation, useNavigate } from "react-router";
import { db } from "../firebase";
import TransactionModal from "../components/TransactionModal";
import DocumentModal from "../components/DocumentModal";
import SearchBar, { type SearchFilter } from "../components/SearchBar";
import { cleanFirebaseData } from "../utils";
import { useAdmin } from "../context/AdminContext";
import ConfirmModal from "../components/ConfirmModal";
import { logAction } from "../utils/audit";
import GenericCreateModal from "../components/GenericCreateModal";
import GenericEditModal from "../components/GenericEditModal";
import { useSortableTable } from "../hooks/useSortableTable";
import SortableTh from "../components/SortableTh";
import Tooltip from "../components/Tooltip";
import { canonizarReferencia, normalizarSigla, resolverCompania, siglaDeReferencia } from "../utils/referenciaCompania";
import DetailsModal from "../components/DetailsModal";

export default function Salarios() {
  const [data, setData] = useState<any[]>([]);
  const [companias, setCompanias] = useState<any[]>([]);
  const [transaccionesMap, setTransaccionesMap] = useState<Map<number, any>>(new Map());
  const [loading, setLoading] = useState(true);
  const { isEditMode } = useAdmin();
  
  const location = useLocation();
  const navigate = useNavigate();

  const [recordToDelete, setRecordToDelete] = useState<any>(null);
  const [brokenLinkAlert, setBrokenLinkAlert] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const [recordToEdit, setRecordToEdit] = useState<any | null>(null);

  const [selectedCompId, setSelectedCompId] = useState<string | null>(null);
  const [activeTransaction, setActiveTransaction] = useState<string | number | null>(null);
  const [activeDocuments, setActiveDocuments] = useState<string | number | null>(null);
  const [recordToView, setRecordToView] = useState<any | null>(null);

  const [filters, setFilters] = useState<SearchFilter[]>([]);

  const searchCategories = [
    { id: 'Autores', label: 'Persona' },
    { id: 'Ciudad', label: 'Ciudad' },
    { id: 'Año', label: 'Año' },
    { id: 'all', label: 'Texto libre' }
  ];

  const [filterCompania, setFilterCompania] = useState('');
  const [filterTemporada, setFilterTemporada] = useState('');
  const [filterAmbito, setFilterAmbito] = useState('');

  useEffect(() => {
    if (location.state?.reset) {
      setSelectedCompId(null);
      setFilters([]);
      navigate(location.pathname, { replace: true });
    }
  }, [location.state?.reset, location.pathname, navigate]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const compania = params.get("compania");
    if (compania) {
      setSelectedCompId(compania);
    }
  }, [location.search]);

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

  const filteredCompanias = companiasInData.filter(c => {
    if (filterCompania && String(c["Indicador de registro"]) !== filterCompania) return false;
    if (filterTemporada && c["Temporadas teatrales"] !== filterTemporada) return false;
    if (filterAmbito && c["Ámbito"] !== filterAmbito) return false;
    return true;
  });

  const searchResults = useMemo(() => {
    if (filters.length === 0) return [];
    return data.filter(d => {
      return filters.every(f => {
        const q = f.query.toLowerCase();
        if (f.category === 'all') {
          return Object.values(d).some(v => String(v).toLowerCase().includes(q));
        }
        if (f.category === 'Autores') {
          const comp = resolverCompania(d["Sigla Compañía"], companias);
          return (comp && comp["Autores"] && String(comp["Autores"]).toLowerCase().includes(q)) || 
                 (d["Beneficiario "] && String(d["Beneficiario "]).toLowerCase().includes(q));
        }
        return d[f.category] && String(d[f.category]).toLowerCase().includes(q);
      });
    });
  }, [data, filters, companias]);

  // Campo derivado solo de presentación: la sigla resuelta, para que la columna «Compañía»
  // ordene por lo que se ve y no por el número guardado. Nunca se persiste ni se exporta.
  const searchResultsOrdenables = useMemo(
    () => searchResults.map(d => ({ ...d, __sigla: normalizarSigla(siglaDeReferencia(d["Sigla Compañía"], companias)) })),
    [searchResults, companias]
  );

  const isSearching = filters.length > 0;
  const siglaSeleccionada = siglaDeReferencia(selectedCompId, companias);
  const companiaSeleccionada = resolverCompania(selectedCompId, companias);
  const detailData = companiaSeleccionada
    ? data.filter(d => resolverCompania(d["Sigla Compañía"], [companiaSeleccionada]) !== null)
    : [];

  const { items: sortedFilteredCompanias, requestSort: sortComp, sortConfig: scComp } = useSortableTable(filteredCompanias);
  const { items: sortedSearchResults, requestSort: sortSearch, sortConfig: scSearch } = useSortableTable(searchResultsOrdenables);
  const { items: sortedDetailData } = useSortableTable(detailData);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: "1rem" }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          Remuneraciones
          <Tooltip content="En esta sección se listan las remuneraciones y pagos específicos que la compañía efectuó a diversas personas (actores, músicos, tramoyistas, etc.) por su trabajo durante las diferentes temporadas." />
        </h1>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {isEditMode && (
            <button 
              onClick={() => setIsCreateOpen(true)}
              style={{ padding: '0.5rem 1rem', background: 'var(--primary-color)', color: 'var(--on-primary)', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              Nuevo Registro
            </button>
          )}
          <SearchBar onSearch={(f) => { setFilters(f); setSelectedCompId(null); }} categories={searchCategories} />
        </div>
      </div>
      
      {(selectedCompId || isSearching) && (
        <button onClick={() => { setSelectedCompId(null); setFilters([]); navigate(location.pathname, { replace: true }); }} style={{ padding: '0.5rem 1rem', marginBottom: '1rem' }}>Volver a listado inicial</button>
      )}

      {!loading && !selectedCompId && !isSearching && <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Mostrando {sortedFilteredCompanias.length} registros</p>}

      {loading ? <p>Cargando datos...</p> : isSearching ? (
        <div>
          <h2>Resultados de Búsqueda ({sortedSearchResults.length} registros)</h2>
          <table className="sortable">
            <thead>
              <tr>
                <SortableTh label="Compañía" sortKey="__sigla" sortConfig={scSearch} onSort={sortSearch} />
                <SortableTh label="Ciudad" sortKey="Ciudad" sortConfig={scSearch} onSort={sortSearch} />
                <SortableTh label="Año" sortKey="Año" sortConfig={scSearch} onSort={sortSearch} />
                <th scope="col">Documentos</th>
                <th></th>
                {isEditMode && <th scope="col">Admin</th>}
              </tr>
            </thead>
            <tbody>
              {sortedSearchResults.map(row => {
                const registro: any = { ...row };
                delete registro.__sigla;
                const comp = resolverCompania(row["Sigla Compañía"], companias);
                const sigla = comp ? comp["Sigla Compañía"] : canonizarReferencia(row["Sigla Compañía"]);
                const fullName = comp && comp["Nombre Compañía"] ? `${sigla} - ${comp["Nombre Compañía"]}` : sigla;
                const isBroken = row["Transacción"] && !transaccionesMap.has(Number(row["Transacción"]));
                return (
                <tr key={row.id}>
                  <td>{fullName}</td>
                  <td>{row["Ciudad"]}</td>
                  <td>{row["Año"]}</td>
                  <td>
                    {row["Transacción"] && !isBroken && (() => {
                      const trans = transaccionesMap.get(Number(row["Transacción"]));
                      if (!trans) return null;
                      const docs = [1,2,3,4,5,6,7,8,9,10].map(i => trans[`Doc${i}`]).filter(Boolean);
                      return (
                        <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                          {docs.map((docCode, idx) => (
                            <button key={idx} onClick={() => setActiveDocuments(docCode)} style={{ fontSize: '0.85rem', padding: '0.1rem 0.4rem', cursor: 'pointer', background: 'var(--accent-color)', color: 'var(--on-accent)', border: 'none', borderRadius: '4px' }}>Doc. {docCode}</button>
                          ))}
                        </div>
                      );
                    })()}
                  </td>
                  <td style={{ display: 'flex', gap: '0.5rem' }}>
                    {row["Transacción"] && (
                      isBroken ? 
                        <button style={{ background: '#ff4d4f' }} onClick={() => setBrokenLinkAlert(`El enlace a la transacción ${row["Transacción"]} está roto.`)}>Enlace Roto</button>
                      : (
                        <button onClick={() => setActiveTransaction(row["Transacción"])}>Transacción</button>
                      )
                    )}
                  </td>
                  {isEditMode && (
                    <td style={{ display: 'flex', gap: '0.5rem' }}>
                      <button onClick={() => setRecordToEdit(registro)} style={{ background: 'var(--primary-color)' }}>Editar</button>
                      <button onClick={() => attemptDelete(registro)} style={{ background: '#ff4d4f' }}>Borrar</button>
                    </td>
                  )}
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      ) : !selectedCompId ? (
        <div>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
            <select
              value={filterCompania}
              onChange={e => setFilterCompania(e.target.value)}
              aria-label="Filtrar por compañía"
            >
              <option value="">Todas las Compañías</option>
              {uniqueCompanias.map(opt => {
                const c = companiasMap.get(opt);
                return <option key={opt} value={opt}>{c ? c["Sigla Compañía"] : opt}</option>;
              })}
            </select>
            <select
              value={filterTemporada}
              onChange={e => setFilterTemporada(e.target.value)}
              aria-label="Filtrar por temporada"
            >
              <option value="">Todas las Temporadas</option>
              {uniqueTemporadas.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
            <select
              value={filterAmbito}
              onChange={e => setFilterAmbito(e.target.value)}
              aria-label="Filtrar por ámbito"
            >
              <option value="">Todos los Ámbitos</option>
              {uniqueAmbitos.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>
          <table className="sortable">
            <thead>
              <tr>
                <SortableTh label="Compañía" sortKey="Sigla Compañía" sortConfig={scComp} onSort={sortComp} />
                <SortableTh label="Autores" sortKey="Autores" sortConfig={scComp} onSort={sortComp} />
                <SortableTh label="Temporadas" sortKey="Temporadas teatrales" sortConfig={scComp} onSort={sortComp} />
                <SortableTh label="Ámbito" sortKey="Ámbito" sortConfig={scComp} onSort={sortComp} />
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sortedFilteredCompanias.map((c, i) => {
                const fullName = c["Nombre Compañía"] ? `${c["Sigla Compañía"]} - ${c["Nombre Compañía"]}` : c["Sigla Compañía"];
                return (
                <tr key={i}>
                  <td>{fullName}</td>
                  <td>{c["Autores"]}</td>
                  <td>{c["Temporadas teatrales"]}</td>
                  <td>{c["Ámbito"]}</td>
                  <td><button onClick={() => setSelectedCompId(String(c["Indicador de registro"]))}>TRATO</button></td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      ) : !companiaSeleccionada ? (
        <p style={{ color: 'var(--text-muted)' }}>Compañía no encontrada</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <div style={{ marginBottom: '1rem' }}><p style={{ color: 'var(--text-muted)' }}>{sortedDetailData.length} registros para {siglaSeleccionada}</p></div>
          <table className="sortable">
            <thead>
              <tr>
                <th scope="col">Ciudad</th>
                <th scope="col">Año</th>
                <th scope="col">Personas</th>
                <th scope="col">Ocupación</th>
                <th scope="col">Remuneración</th>
                <th scope="col">Documentos</th>
                <th></th>
                {isEditMode && <th scope="col">Admin</th>}
              </tr>
            </thead>
            <tbody>
              {sortedDetailData.map(row => {
                const isBroken = row["Transacción"] && !transaccionesMap.has(Number(row["Transacción"]));
                return (
                <tr key={row.id}>
                  <td>{row["Ciudad"]}</td>
                  <td>{row["Año"]}</td>
                  <td>{row["Beneficiario "]}</td>
                  <td>{row["Encargo"]}</td>
                  <td>{row["Monto a pagar"]}</td>
                  <td>
                    {row["Transacción"] && !isBroken && (() => {
                      const trans = transaccionesMap.get(Number(row["Transacción"]));
                      if (!trans) return null;
                      const docs = [1,2,3,4,5,6,7,8,9,10].map(i => trans[`Doc${i}`]).filter(Boolean);
                      return (
                        <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                          {docs.map((docCode, idx) => (
                            <button key={idx} onClick={() => setActiveDocuments(docCode)} style={{ fontSize: '0.85rem', padding: '0.1rem 0.4rem', cursor: 'pointer', background: 'var(--accent-color)', color: 'var(--on-accent)', border: 'none', borderRadius: '4px' }}>Doc. {docCode}</button>
                          ))}
                        </div>
                      );
                    })()}
                  </td>
                  <td style={{ display: 'flex', gap: '0.5rem' }}>
                    {row["Transacción"] && (
                      isBroken ? 
                        <button style={{ background: '#ff4d4f' }} onClick={() => setBrokenLinkAlert(`El enlace a la transacción ${row["Transacción"]} está roto.`)}>Enlace Roto</button>
                      : (
                        <button onClick={() => setActiveTransaction(row["Transacción"])}>Transacción</button>
                      )
                    )}
                  </td>
                  {isEditMode && (
                    <td style={{ display: 'flex', gap: '0.5rem' }}>
                      <button onClick={() => setRecordToEdit(row)} style={{ background: 'var(--primary-color)' }}>Editar</button>
                      <button onClick={() => attemptDelete(row)} style={{ background: '#ff4d4f' }}>Borrar</button>
                    </td>
                  )}
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      )}
      {activeTransaction && <TransactionModal transactionCode={activeTransaction} onClose={() => setActiveTransaction(null)} />}
      {activeDocuments && <DocumentModal documentCode={activeDocuments} onClose={() => setActiveDocuments(null)} />}
      {recordToView && <DetailsModal record={recordToView} onClose={() => setRecordToView(null)} />}
      
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
          title="Confirmar Eliminación"
          message={`¿Estás seguro de que deseas eliminar este registro de remuneración para ${recordToDelete["Beneficiario "]}?`}
          onConfirm={handleDelete}
          onCancel={() => setRecordToDelete(null)}
        />
      )}

      {brokenLinkAlert && (
        <div style={{ position: 'fixed', bottom: '2rem', right: '2rem', background: '#ff4d4f', color: 'var(--on-danger)', padding: '1rem', borderRadius: '8px', zIndex: 1000, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          <p style={{ margin: 0 }}>{brokenLinkAlert}</p>
          <button onClick={() => setBrokenLinkAlert(null)} style={{ marginTop: '0.5rem', background: 'white', color: '#ff4d4f', border: 'none', padding: '0.2rem 0.5rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Cerrar</button>
        </div>
      )}
    </div>
  );
}
