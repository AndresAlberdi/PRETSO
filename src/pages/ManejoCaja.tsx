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
import Tooltip from "../components/Tooltip";
import DetailsModal from "../components/DetailsModal";

export default function ManejoCaja() {
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
      const qCaja = query(collection(db, "manejo_de_caja"));
      const snapCaja = await getDocs(qCaja);
      const docsCaja = snapCaja.docs.map(cleanFirebaseData).sort(
        (a, b) => Number(a["Indicador de registro"] || 0) - Number(b["Indicador de registro"] || 0)
      );
      setData(docsCaja);

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
      await deleteDoc(doc(db, "manejo_de_caja", recordToDelete.id));
      await logAction('DELETE', 'manejo_de_caja', recordToDelete.id, 'pretsodatabase@gmail.com', recordToDelete);
      setData(data.filter(d => d.id !== recordToDelete.id));
      setRecordToDelete(null);
    } catch (error) {
      console.error("Error deleting document: ", error);
    }
  };

  const handleSave = async (updatedRecord: any) => {
    try {
      const { id, ...dataToSave } = updatedRecord;
      await updateDoc(doc(db, "manejo_de_caja", id), dataToSave);
      await logAction('EDIT', 'manejo_de_caja', id, 'pretsodatabase@gmail.com', dataToSave);
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

  const companiasInData = companias.filter(c => data.some(d => String(d["Sigla Compañía"]) === String(c["Indicador de registro"])));
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
          const comp = companiasMap.get(d["Sigla Compañía"]);
          return comp && comp["Autores"] && String(comp["Autores"]).toLowerCase().includes(q);
        }
        return d[f.category] && String(d[f.category]).toLowerCase().includes(q);
      });
    });
  }, [data, filters, companiasMap]);

  const isSearching = filters.length > 0;
  const detailData = data.filter(d => String(d["Sigla Compañía"]) === selectedCompId);

  const { items: sortedFilteredCompanias, requestSort: sortComp, sortConfig: scComp } = useSortableTable(filteredCompanias);
  const { items: sortedSearchResults, requestSort: sortSearch, sortConfig: scSearch } = useSortableTable(searchResults);
  const { items: sortedDetailData, requestSort: sortDetail, sortConfig: scDetail } = useSortableTable(detailData);

  const SortIndicator = ({ column, sc }: { column: string, sc: any }) => {
    if (!sc || sc.key !== column) return null;
    return <span>{sc.direction === 'asc' ? ' ▲' : ' ▼'}</span>;
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: "1rem" }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          Manejo de Caja 
          <Tooltip content="Esta sección muestra información detallada sobre los ingresos, egresos y otros bienes monetarios gestionados por las diversas compañías durante sus temporadas teatrales. Sirve para entender los flujos de dinero y la salud financiera." />
        </h1>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {isEditMode && (
            <button 
              onClick={() => setIsCreateOpen(true)}
              style={{ padding: '0.5rem 1rem', background: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
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
                <th onClick={() => sortSearch('Sigla Compañía')} style={{ cursor: 'pointer' }}>Compañía <SortIndicator column="Sigla Compañía" sc={scSearch} /></th>
                <th onClick={() => sortSearch('Ciudad')} style={{ cursor: 'pointer' }}>Ciudad <SortIndicator column="Ciudad" sc={scSearch} /></th>
                <th onClick={() => sortSearch('Año')} style={{ cursor: 'pointer' }}>Año <SortIndicator column="Año" sc={scSearch} /></th>
                <th>Documentos</th>
                <th></th>
                {isEditMode && <th>Admin</th>}
              </tr>
            </thead>
            <tbody>
              {sortedSearchResults.map(row => {
                const comp = companiasMap.get(row["Sigla Compañía"]);
                const fullName = comp && comp["Nombre Compañía"] ? `${row["Sigla Compañía"]} - ${comp["Nombre Compañía"]}` : row["Sigla Compañía"];
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
                        <div style={{ display: 'flex', gap: '0.2rem', flexWrap: 'wrap' }}>
                          {docs.map((docCode, idx) => (
                            <button key={idx} onClick={() => setActiveDocuments(row["Transacción"])} style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem', background: 'var(--bg-body)' }}>{docCode}</button>
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
                        <button onClick={() => setActiveTransaction(row["Transacción"])}>{row["Transacción"]}</button>
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
      ) : !selectedCompId ? (
        <div>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
            <select value={filterCompania} onChange={e => setFilterCompania(e.target.value)}>
              <option value="">Todas las Compañías</option>
              {uniqueCompanias.map(opt => {
                const c = companiasMap.get(opt);
                return <option key={opt} value={opt}>{c ? c["Sigla Compañía"] : opt}</option>;
              })}
            </select>
            <select value={filterTemporada} onChange={e => setFilterTemporada(e.target.value)}>
              <option value="">Todas las Temporadas</option>
              {uniqueTemporadas.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
            <select value={filterAmbito} onChange={e => setFilterAmbito(e.target.value)}>
              <option value="">Todos los Ámbitos</option>
              {uniqueAmbitos.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>
          <table className="sortable">
            <thead>
              <tr>
                <th onClick={() => sortComp('Sigla Compañía')} style={{ cursor: 'pointer' }}>Compañía <SortIndicator column="Sigla Compañía" sc={scComp} /></th>
                <th onClick={() => sortComp('Autores')} style={{ cursor: 'pointer' }}>Autores <SortIndicator column="Autores" sc={scComp} /></th>
                <th onClick={() => sortComp('Temporadas teatrales')} style={{ cursor: 'pointer' }}>Temporadas <SortIndicator column="Temporadas teatrales" sc={scComp} /></th>
                <th onClick={() => sortComp('Ámbito')} style={{ cursor: 'pointer' }}>Ámbito <SortIndicator column="Ámbito" sc={scComp} /></th>
                <th>Acción</th>
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
                  <td><button onClick={() => setSelectedCompId(String(c["Indicador de registro"]))}>CAJA</button></td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <div style={{ marginBottom: '1rem' }}><p style={{ color: 'var(--text-muted)' }}>{sortedDetailData.length} registros para {selectedCompId}</p></div>
          <table className="sortable">
            <thead>
              <tr>
                <th onClick={() => sortDetail('Ciudad')} style={{ cursor: 'pointer' }}>Ciudad <SortIndicator column="Ciudad" sc={scDetail} /></th>
                <th onClick={() => sortDetail('Año')} style={{ cursor: 'pointer' }}>Año <SortIndicator column="Año" sc={scDetail} /></th>
                <th onClick={() => sortDetail('Ingresos')} style={{ cursor: 'pointer' }}>Ingresos <SortIndicator column="Ingresos" sc={scDetail} /></th>
                <th onClick={() => sortDetail('Egresos')} style={{ cursor: 'pointer' }}>Egresos <SortIndicator column="Egresos" sc={scDetail} /></th>
                <th onClick={() => sortDetail('Otros bienes de la compañía')} style={{ cursor: 'pointer' }}>Otros bienes <SortIndicator column="Otros bienes de la compañía" sc={scDetail} /></th>
                <th>Documentos</th>
                <th></th>
                {isEditMode && <th>Admin</th>}
              </tr>
            </thead>
            <tbody>
              {sortedDetailData.map(row => {
                const isBroken = row["Transacción"] && !transaccionesMap.has(Number(row["Transacción"]));
                return (
                <tr key={row.id}>
                  <td>{row["Ciudad"]}</td>
                  <td>{row["Año"]}</td>
                  <td>{row["Ingresos"]}</td>
                  <td>{row["Egresos"]}</td>
                  <td>{row["Otros bienes de la compañía"]}</td>
                  <td>
                    {row["Transacción"] && !isBroken && (() => {
                      const trans = transaccionesMap.get(Number(row["Transacción"]));
                      if (!trans) return null;
                      const docs = [1,2,3,4,5,6,7,8,9,10].map(i => trans[`Doc${i}`]).filter(Boolean);
                      return (
                        <div style={{ display: 'flex', gap: '0.2rem', flexWrap: 'wrap' }}>
                          {docs.map((docCode, idx) => (
                            <button key={idx} onClick={() => setActiveDocuments(row["Transacción"])} style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem', background: 'var(--bg-body)' }}>{docCode}</button>
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
                        <button onClick={() => setActiveTransaction(row["Transacción"])}>{row["Transacción"]}</button>
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
      {activeDocuments && <DocumentModal transactionCode={activeDocuments} onClose={() => setActiveDocuments(null)} />}
      {recordToView && <DetailsModal record={recordToView} onClose={() => setRecordToView(null)} />}
      
      {isCreateOpen && (
        <GenericCreateModal 
          collectionName="manejo_de_caja"
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
          collectionName="manejo_de_caja"
          record={recordToEdit}
          onClose={() => setRecordToEdit(null)}
          onSave={handleSave}
        />
      )}

      {recordToDelete && (
        <ConfirmModal 
          title="Confirmar Eliminación"
          message={`¿Estás seguro de que deseas eliminar este registro de caja de ${recordToDelete["Sigla Compañía"]} (${recordToDelete["Año"]})?`}
          onConfirm={handleDelete}
          onCancel={() => setRecordToDelete(null)}
        />
      )}

      {brokenLinkAlert && (
        <div style={{ position: 'fixed', bottom: '2rem', right: '2rem', background: '#ff4d4f', color: 'white', padding: '1rem', borderRadius: '8px', zIndex: 1000, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          <p style={{ margin: 0 }}>{brokenLinkAlert}</p>
          <button onClick={() => setBrokenLinkAlert(null)} style={{ marginTop: '0.5rem', background: 'white', color: '#ff4d4f', border: 'none', padding: '0.2rem 0.5rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Cerrar</button>
        </div>
      )}
    </div>
  );
}
