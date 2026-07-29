import { useEffect, useState, useMemo } from "react";
import { collection, getDocs, query, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { useLocation, useNavigate } from "react-router";
import { db } from "../firebase";
import TransactionModal from "../components/TransactionModal";
import DocumentModal from "../components/DocumentModal";
import SearchBar, { type SearchFilter } from "../components/SearchBar";
import { cleanFirebaseData } from "../utils";
import CompaniaModal from "../components/CompaniaModal";
import { useAdmin } from "../context/AdminContext";
import ConfirmModal from "../components/ConfirmModal";
import { logAction } from "../utils/audit";
import GenericCreateModal from "../components/GenericCreateModal";
import GenericEditModal from "../components/GenericEditModal";
import { useSortableTable } from "../hooks/useSortableTable";
import Tooltip from "../components/Tooltip";
import DetailsModal from "../components/DetailsModal";

export default function CorpusChristi() {
  const [data, setData] = useState<any[]>([]);
  const [transaccionesMap, setTransaccionesMap] = useState<Map<number, any>>(new Map());
  const [loading, setLoading] = useState(true);
  const { isEditMode } = useAdmin();
  
  const location = useLocation();
  const navigate = useNavigate();

  const [recordToDelete, setRecordToDelete] = useState<any>(null);
  const [brokenLinkAlert, setBrokenLinkAlert] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const [recordToEdit, setRecordToEdit] = useState<any | null>(null);

  const [selectedCityYear, setSelectedCityYear] = useState<{ ciudad: string, año: string } | null>(null);
  const [activeTransaction, setActiveTransaction] = useState<string | number | null>(null);
  const [activeDocuments, setActiveDocuments] = useState<string | number | null>(null);
  const [activeCompania, setActiveCompania] = useState<string | null>(null);
  const [recordToView, setRecordToView] = useState<any | null>(null);

  const [filters, setFilters] = useState<SearchFilter[]>([]);

  const searchCategories = [
    { id: 'Ciudad', label: 'Ciudad' },
    { id: 'Año', label: 'Año' },
    { id: 'all', label: 'Texto libre' }
  ];

  const [filterCiudad, setFilterCiudad] = useState('');
  const [filterAno, setFilterAno] = useState('');

  useEffect(() => {
    if (location.state?.reset) {
      setSelectedCityYear(null);
      setFilters([]);
      navigate(location.pathname, { replace: true });
    }
  }, [location.state?.reset, location.pathname, navigate]);

  useEffect(() => {
    async function fetchData() {
      const qData = query(collection(db, "corpus_christi"));
      const snap = await getDocs(qData);
      const docsData = snap.docs.map(cleanFirebaseData).sort(
        (a, b) => Number(a["Indicador de registro"] || 0) - Number(b["Indicador de registro"] || 0)
      );
      setData(docsData);

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
      await logAction('DELETE', 'corpus_christi', recordToDelete.id, 'pretsodatabase@gmail.com', recordToDelete);
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
      await logAction('EDIT', 'corpus_christi', id, 'pretsodatabase@gmail.com', dataToSave);
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

  const searchResults = useMemo(() => {
    if (filters.length === 0) return [];
    return data.filter(d => {
      return filters.every(f => {
        const q = f.query.toLowerCase();
        if (f.category === 'all') {
          return Object.values(d).some(v => String(v).toLowerCase().includes(q));
        }
        return d[f.category] && String(d[f.category]).toLowerCase().includes(q);
      });
    });
  }, [data, filters]);

  const isSearching = filters.length > 0;
  const detailData = data.filter(d => 
    selectedCityYear && d["Ciudad"] === selectedCityYear.ciudad && String(d["Año"]) === String(selectedCityYear.año)
  );

  const { items: sortedFilteredGroups, requestSort: sortGroup, sortConfig: scGroup } = useSortableTable(filteredGroups);
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
          Corpus Christi
          <Tooltip content="Muestra los registros financieros y labores encargadas para la celebración del Corpus Christi por diversas ciudades en años específicos, detallando el pago y los fondos." />
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
          <SearchBar onSearch={(f) => { setFilters(f); setSelectedCityYear(null); }} categories={searchCategories} />
        </div>
      </div>
      
      {(selectedCityYear || isSearching) && (
        <button onClick={() => { setSelectedCityYear(null); setFilters([]); navigate(location.pathname, { replace: true }); }} style={{ padding: '0.5rem 1rem', marginBottom: '1rem' }}>Volver a listado inicial</button>
      )}

      {!loading && !selectedCityYear && !isSearching && <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Mostrando {sortedFilteredGroups.length} registros</p>}

      {loading ? <p>Cargando datos...</p> : isSearching ? (
        <div>
          <h2>Resultados de Búsqueda ({sortedSearchResults.length} registros)</h2>
          <table className="sortable">
            <thead>
              <tr>
                <th onClick={() => sortSearch('Ciudad')} style={{ cursor: 'pointer' }}>Ciudad <SortIndicator column="Ciudad" sc={scSearch} /></th>
                <th onClick={() => sortSearch('Año')} style={{ cursor: 'pointer' }}>Año <SortIndicator column="Año" sc={scSearch} /></th>
                <th onClick={() => sortSearch('Encargado ')} style={{ cursor: 'pointer' }}>Encargado <SortIndicator column="Encargado " sc={scSearch} /></th>
                <th onClick={() => sortSearch('Monto a pagar')} style={{ cursor: 'pointer' }}>Monto a pagar <SortIndicator column="Monto a pagar" sc={scSearch} /></th>
                <th>Documentos</th>
                <th></th>
                {isEditMode && <th>Admin</th>}
              </tr>
            </thead>
            <tbody>
              {sortedSearchResults.map(row => {
                const isBroken = row["Transacción"] && !transaccionesMap.has(Number(row["Transacción"]));
                return (
                <tr key={row.id}>
                  <td>{row["Ciudad"]}</td>
                  <td>{row["Año"]}</td>
                  <td>{row["Encargado "]}</td>
                  <td>{row["Monto a pagar"]}</td>
                  <td>
                    {row["Transacción"] && !isBroken && (() => {
                      const trans = transaccionesMap.get(Number(row["Transacción"]));
                      if (!trans) return null;
                      const docs = [1,2,3,4,5,6,7,8,9,10].map(i => trans[`Doc${i}`]).filter(Boolean);
                      return (
                        <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                          {docs.map((docCode, idx) => (
                            <span key={idx} style={{ fontSize: '0.85rem', padding: '0.1rem 0' }}>Doc. {docCode}</span>
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
      ) : !selectedCityYear ? (
        <div>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
            <select value={filterCiudad} onChange={e => setFilterCiudad(e.target.value)}>
              <option value="">Todas las Ciudades</option>
              {uniqueCiudades.map(opt => <option key={String(opt)} value={String(opt)}>{String(opt)}</option>)}
            </select>
            <select value={filterAno} onChange={e => setFilterAno(e.target.value)}>
              <option value="">Todos los Años</option>
              {uniqueAnos.map(opt => <option key={String(opt)} value={String(opt)}>{String(opt)}</option>)}
            </select>
          </div>
          <table className="sortable">
            <thead>
              <tr>
                <th onClick={() => sortGroup('ciudad')} style={{ cursor: 'pointer' }}>Ciudad <SortIndicator column="ciudad" sc={scGroup} /></th>
                <th onClick={() => sortGroup('año')} style={{ cursor: 'pointer' }}>Año <SortIndicator column="año" sc={scGroup} /></th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sortedFilteredGroups.map((g, i) => (
                <tr key={i}>
                  <td>{g.ciudad}</td>
                  <td>{g.año}</td>
                  <td><button onClick={() => setSelectedCityYear(g)}>TRATO</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <div style={{ marginBottom: '1rem' }}><p style={{ color: 'var(--text-muted)' }}>{sortedDetailData.length} transacciones registradas</p></div>
          <table className="sortable">
            <thead>
              <tr>
                <th onClick={() => sortDetail('Encargo')} style={{ cursor: 'pointer' }}>Encargo <SortIndicator column="Encargo" sc={scDetail} /></th>
                <th onClick={() => sortDetail('Encargado ')} style={{ cursor: 'pointer' }}>Encargado <SortIndicator column="Encargado " sc={scDetail} /></th>
                <th>Compañías</th>
                <th onClick={() => sortDetail('Monto a pagar')} style={{ cursor: 'pointer' }}>Monto a pagar <SortIndicator column="Monto a pagar" sc={scDetail} /></th>
                <th onClick={() => sortDetail('Fondos')} style={{ cursor: 'pointer' }}>Fondos <SortIndicator column="Fondos" sc={scDetail} /></th>
                <th>Documentos</th>
                <th></th>
                {isEditMode && <th>Admin</th>}
              </tr>
            </thead>
            <tbody>
              {sortedDetailData.map(row => {
                const isBroken = row["Transacción"] && !transaccionesMap.has(Number(row["Transacción"]));
                const companiasList = [];
                if (row["Compañía"]) companiasList.push(row["Compañía"]);
                for (let i = 2; i <= 10; i++) {
                  if (row[`Compañía${i}`] || row[`Cmp${i}`]) {
                    companiasList.push(row[`Compañía${i}`] || row[`Cmp${i}`]);
                  }
                }
                
                return (
                <tr key={row.id}>
                  <td>{row["Encargo"]}</td>
                  <td>{row["Encargado "]}</td>
                  <td>
                    {companiasList.map((c, idx) => (
                      <div key={idx} style={{ marginBottom: '4px' }}>
                        <button onClick={() => setActiveCompania(c)} style={{ padding: '0.2rem 0.5rem', background: 'var(--accent-color)', color: 'white', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '0.9rem' }}>{c}</button>
                      </div>
                    ))}
                  </td>
                  <td>{row["Monto a pagar"]}</td>
                  <td>{row["Fondos"]}</td>
                  <td>
                    {row["Transacción"] && !isBroken && (() => {
                      const trans = transaccionesMap.get(Number(row["Transacción"]));
                      if (!trans) return null;
                      const docs = [1,2,3,4,5,6,7,8,9,10].map(i => trans[`Doc${i}`]).filter(Boolean);
                      return (
                        <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                          {docs.map((docCode, idx) => (
                            <span key={idx} style={{ fontSize: '0.85rem', padding: '0.1rem 0' }}>Doc. {docCode}</span>
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

      {activeCompania && <CompaniaModal sigla={activeCompania} onClose={() => setActiveCompania(null)} />}
      
      {recordToDelete && (
        <ConfirmModal 
          title="Confirmar Eliminación"
          message={`¿Estás seguro de que deseas eliminar este registro para ${recordToDelete["Encargado "]}?`}
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
