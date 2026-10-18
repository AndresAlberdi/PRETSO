import { useEffect, useState, useMemo } from "react";
import { collection, getDocs, query, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { useLocation, useNavigate } from "react-router";
import { db } from "../firebase";
import TransactionModal from "../components/TransactionModal";
import DocumentModal from "../components/DocumentModal";
import SearchBar, { type SearchFilter } from "../components/SearchBar";
import { cleanFirebaseData } from "../utils";
import CompaniaModal from "../components/CompaniaModal";
import ListaSiglasCompania from "../components/ListaSiglasCompania";
import { useAdmin } from "../context/AdminContext";
import ConfirmModal from "../components/ConfirmModal";
import { logAction } from "../utils/audit";
import GenericCreateModal from "../components/GenericCreateModal";
import GenericEditModal from "../components/GenericEditModal";
import { useSortableTable } from "../hooks/useSortableTable";
import SortableTh from "../components/SortableTh";
import { contar } from "../utils/anuncios";
import Tooltip from "../components/Tooltip";

export default function Indicadores() {
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

  const [selectedCategoria, setSelectedCategoria] = useState<string | null>(null);
  const [activeTransaction, setActiveTransaction] = useState<string | number | null>(null);
  const [activeDocuments, setActiveDocuments] = useState<string | number | null>(null);
  const [activeCompania, setActiveCompania] = useState<any | null>(null);

  const [filters, setFilters] = useState<SearchFilter[]>([]);

  const searchCategories = [
    { id: 'Ciudad', label: 'Ciudad' },
    { id: 'Años', label: 'Año' },
    { id: 'all', label: 'Texto libre' }
  ];

  const [filterCategoria, setFilterCategoria] = useState('');

  useEffect(() => {
    if (location.state?.reset) {
      setSelectedCategoria(null);
      setFilters([]);
      navigate(location.pathname, { replace: true });
    }
  }, [location.state?.reset, location.pathname, navigate]);

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
  const detailData = data.filter(d => d["Categorías"] === selectedCategoria);

  const { items: sortedFilteredCategorias, requestSort: sortCat, sortConfig: scCat } = useSortableTable(filteredCategorias);
  const { items: sortedSearchResults, requestSort: sortSearch, sortConfig: scSearch } = useSortableTable(searchResults);
  const { items: sortedDetailData, requestSort: sortDetail, sortConfig: scDetail } = useSortableTable(detailData);

  const anuncioResultados = isSearching
    ? `Búsqueda: ${contar(sortedSearchResults.length, 'registro encontrado', 'registros encontrados')}`
    : !selectedCategoria
    ? `Listado: ${contar(sortedFilteredCategorias.length, 'categoría', 'categorías')}`
    : `Detalle de ${selectedCategoria}: ${contar(sortedDetailData.length, 'transacción', 'transacciones')}`;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: "1rem" }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          Identificación de Indicadores
          <Tooltip content="Recoge transacciones y datos económicos clasificados por diversas categorías o conceptos. Provee información sobre precios y gastos habituales a lo largo de los años en distintas ciudades." />
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
          <SearchBar onSearch={(f) => { setFilters(f); setSelectedCategoria(null); }} categories={searchCategories} />
        </div>
      </div>

      {!loading && <output aria-live="polite" className="visually-hidden">{anuncioResultados}</output>}
      
      {(selectedCategoria || isSearching) && (
        <button onClick={() => { setSelectedCategoria(null); setFilters([]); navigate(location.pathname, { replace: true }); }} style={{ padding: '0.5rem 1rem', marginBottom: '1rem' }}>Volver a listado inicial</button>
      )}

      {!loading && !selectedCategoria && !isSearching && <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Mostrando {sortedFilteredCategorias.length} categorías</p>}

      {loading ? <p>Cargando datos...</p> : isSearching ? (
        <div>
          <h2>Resultados de Búsqueda ({sortedSearchResults.length} registros)</h2>
          <table className="sortable">
            <thead>
              <tr>
                <SortableTh label="Ciudad" sortKey="Ciudad" sortConfig={scSearch} onSort={sortSearch} />
                <SortableTh label="Año" sortKey="Años" sortConfig={scSearch} onSort={sortSearch} />
                <SortableTh label="Concepto" sortKey="Concepto" sortConfig={scSearch} onSort={sortSearch} />
                <SortableTh label="Monto" sortKey="Monto" sortConfig={scSearch} onSort={sortSearch} />
                <th scope="col">Documentos</th>
                <th></th>
                {isEditMode && <th scope="col">Admin</th>}
              </tr>
            </thead>
            <tbody>
              {sortedSearchResults.map(row => {
                const isBroken = row["Transacción"] && !transaccionesMap.has(Number(row["Transacción"]));
                return (
                <tr key={row.id}>
                  <td>{row["Ciudad"]}</td>
                  <td>{row["Años"]}</td>
                  <td>{row["Concepto"]}</td>
                  <td>{row["Monto"]}</td>
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
                      : <button onClick={() => setActiveTransaction(row["Transacción"])}>Transacción</button>
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
      ) : !selectedCategoria ? (
        <div>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
            <select
              value={filterCategoria}
              onChange={e => setFilterCategoria(e.target.value)}
              aria-label="Filtrar por categoría"
            >
              <option value="">Todas las Categorías</option>
              {uniqueCategorias.map(opt => <option key={String(opt)} value={String(opt)}>{String(opt)}</option>)}
            </select>
          </div>
          <table className="sortable">
            <thead>
              <tr>
                <SortableTh label="Categoría" sortKey="Categoría" sortConfig={scCat} onSort={sortCat} />
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sortedFilteredCategorias.map((c, i) => (
                <tr key={i}>
                  <td>{c.Categoría}</td>
                  <td><button onClick={() => setSelectedCategoria(c.Categoría)}>LISTA</button></td>
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
                <SortableTh label="Ciudad" sortKey="Ciudad" sortConfig={scDetail} onSort={sortDetail} />
                <SortableTh label="Años" sortKey="Años" sortConfig={scDetail} onSort={sortDetail} />
                <th scope="col">Concepto</th>
                <th scope="col">Monto</th>
                <th scope="col">Nota</th>
                <th scope="col">Compañía</th>
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
                  <td>{row["Años"]}</td>
                  <td>{row["Concepto"]}</td>
                  <td>{row["Monto"]}</td>
                  <td>{row["Nota"]}</td>
                  <td>
                    <ListaSiglasCompania referencias={[row["Sigla Compañía"]]} companias={companias} onAbrir={setActiveCompania} />
                  </td>
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
                      : <button onClick={() => setActiveTransaction(row["Transacción"])}>Transacción</button>
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

      {activeCompania && <CompaniaModal compania={activeCompania} onClose={() => setActiveCompania(null)} />}
      
      {recordToDelete && (
        <ConfirmModal 
          title="Confirmar Eliminación"
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
