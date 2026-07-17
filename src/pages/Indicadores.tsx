import { useEffect, useState } from "react";
import { collection, getDocs, query } from "firebase/firestore";
import { db } from "../firebase";
import TransactionModal from "../components/TransactionModal";
import SearchBar from "../components/SearchBar";
import { cleanFirebaseData } from "../utils";
import CompaniaModal from "../components/CompaniaModal";
import { useAdmin } from "../context/AdminContext";
import ConfirmModal from "../components/ConfirmModal";
import { deleteDoc, doc } from "firebase/firestore";
import { logAction } from "../utils/audit";
import GenericCreateModal from "../components/GenericCreateModal";

export default function Indicadores() {
  const [data, setData] = useState<any[]>([]);
  const [transaccionesSet, setTransaccionesSet] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const { isEditMode } = useAdmin();
  const [recordToDelete, setRecordToDelete] = useState<any>(null);
  const [brokenLinkAlert, setBrokenLinkAlert] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Master-Detail State
  const [selectedCategoria, setSelectedCategoria] = useState<string | null>(null);
  
  // Transaction Modal State
  const [activeTransaction, setActiveTransaction] = useState<string | number | null>(null);

  // Compania Modal State
  const [activeCompania, setActiveCompania] = useState<string | null>(null);

  // Search state
  const [searchCategory, setSearchCategory] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const searchCategories = [
    { id: 'Ciudad', label: 'Ciudad' },
    { id: 'Años', label: 'Año' },
    { id: 'all', label: 'Texto libre' }
  ];

  // Filters
  const [filterCategoria, setFilterCategoria] = useState('');

  useEffect(() => {
    async function fetchData() {
      const qInd = query(collection(db, "indicadores"));
      const snapInd = await getDocs(qInd);
      const docsInd = snapInd.docs.map(cleanFirebaseData);
      setData(docsInd);

      const qTrans = query(collection(db, "transacciones"));
      const snapTrans = await getDocs(qTrans);
      const tSet = new Set<number>();
      snapTrans.docs.forEach(d => tSet.add(Number(d.data().Num)));
      setTransaccionesSet(tSet);

      setLoading(false);
    }
    fetchData();
  }, []);

  const attemptDelete = async (row: any) => {
    setIsAnalyzing(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsAnalyzing(false);
    setRecordToDelete(row);
  };

  const handleDelete = async () => {
    if (!recordToDelete) return;
    try {
      await deleteDoc(doc(db, "indicadores", recordToDelete.id));
      await logAction('DELETE', 'indicadores', recordToDelete.id, 'pretsodatabase@gmail.com', recordToDelete);
      setData(data.filter(d => d.id !== recordToDelete.id));
      setRecordToDelete(null);
    } catch (error) {
      console.error("Error deleting document: ", error);
    }
  };

  const uniqueCategorias = Array.from(new Set(data.map(d => d["Categorías"]))).filter(Boolean).sort();

  const filteredCategorias = uniqueCategorias.filter(c => {
    if (filterCategoria && c !== filterCategoria) return false;
    return true;
  });

  const searchResults = data.filter(d => {
    if (!searchQuery) return false;
    const q = searchQuery.toLowerCase();
    if (searchCategory === 'all') {
      return Object.values(d).some(v => String(v).toLowerCase().includes(q));
    }
    return d[searchCategory] && String(d[searchCategory]).toLowerCase().includes(q);
  });

  const isSearching = searchQuery.length > 0;
  const detailData = data.filter(d => d["Categorías"] === selectedCategoria);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: "1rem" }}>
        <h1>Identificación de Indicadores</h1>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {isEditMode && (
            <button 
              onClick={() => setIsCreateOpen(true)}
              style={{ padding: '0.5rem 1rem', background: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              Nuevo Registro
            </button>
          )}
          <SearchBar onSearch={(c, q) => { setSearchCategory(c); setSearchQuery(q); setSelectedCategoria(null); }} categories={searchCategories} />
        </div>
        {(selectedCategoria || isSearching) && (
          <button onClick={() => { setSelectedCategoria(null); setSearchQuery(''); }} style={{ padding: '0.5rem 1rem' }}>Volver</button>
        )}
      </div>
      {!loading && !selectedCategoria && !isSearching && <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Mostrando {filteredCategorias.length} categorías</p>}

      {loading ? <p>Cargando datos...</p> : isSearching ? (
        <div>
          <h2>Resultados de Búsqueda ({searchResults.length} registros)</h2>
          <table>
            <thead><tr><th>Ciudad</th><th>Año</th><th>Concepto</th><th>Monto</th><th></th>{isEditMode && <th>Admin</th>}</tr></thead>
            <tbody>
              {searchResults.map(row => {
                const isBroken = row["Transacción"] && !transaccionesSet.has(Number(row["Transacción"]));
                return (
                <tr key={row.id}>
                  <td>{row["Ciudad"]}</td>
                  <td>{row["Años"]}</td>
                  <td>{row["Concepto"]}</td>
                  <td>{row["Monto"]}</td>
                  <td>
                    {row["Transacción"] && (
                      isBroken ? 
                        <button style={{ background: '#ff4d4f' }} onClick={() => setBrokenLinkAlert(`El enlace a la transacción ${row["Transacción"]} está roto. El registro no existe en la base de datos, por favor haga la corrección.`)}>Enlace Roto</button>
                      : <button onClick={() => setActiveTransaction(row["Transacción"])}>Transacción</button>
                    )}
                  </td>
                  {isEditMode && (
                    <td style={{ display: 'flex', gap: '0.5rem' }}>
                      <button onClick={() => alert("Edición en desarrollo")} style={{ background: 'var(--primary-color)' }}>Editar</button>
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
            <select value={filterCategoria} onChange={e => setFilterCategoria(e.target.value)}>
              <option value="">Todas las Categorías</option>
              {uniqueCategorias.map(opt => <option key={String(opt)} value={String(opt)}>{String(opt)}</option>)}
            </select>
          </div>
          <table>
            <thead><tr><th>Categoría</th><th></th></tr></thead>
            <tbody>
              {filteredCategorias.map((c, i) => (
                <tr key={i}>
                  <td>{String(c)}</td>
                  <td><button onClick={() => setSelectedCategoria(String(c))}>LISTA</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <div style={{ marginBottom: '1rem' }}><p style={{ color: 'var(--text-muted)' }}>{detailData.length} transacciones registradas</p></div>
          <table>
            <thead>
              <tr><th>Ciudad</th><th>Años</th><th>Concepto</th><th>Monto</th><th>Nota</th><th>Compañía</th><th></th>{isEditMode && <th>Admin</th>}</tr>
            </thead>
            <tbody>
              {detailData.map(row => {
                const isBroken = row["Transacción"] && !transaccionesSet.has(Number(row["Transacción"]));
                return (
                <tr key={row.id}>
                  <td>{row["Ciudad"]}</td>
                  <td>{row["Años"]}</td>
                  <td>{row["Concepto"]}</td>
                  <td>{row["Monto"]}</td>
                  <td>{row["Nota"]}</td>
                  <td>
                    {row["Sigla Compañía"] && (
                      <button onClick={() => setActiveCompania(row["Sigla Compañía"])} style={{ padding: '0.2rem 0.5rem', background: 'var(--accent-color)', color: 'white', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '0.9rem' }}>{row["Sigla Compañía"]}</button>
                    )}
                  </td>
                  <td>
                    {row["Transacción"] && (
                      isBroken ? 
                        <button style={{ background: '#ff4d4f' }} onClick={() => setBrokenLinkAlert(`El enlace a la transacción ${row["Transacción"]} está roto. El registro no existe en la base de datos, por favor haga la corrección.`)}>Enlace Roto</button>
                      : <button onClick={() => setActiveTransaction(row["Transacción"])}>Transacción</button>
                    )}
                  </td>
                  {isEditMode && (
                    <td style={{ display: 'flex', gap: '0.5rem' }}>
                      <button onClick={() => alert("Edición en desarrollo")} style={{ background: 'var(--primary-color)' }}>Editar</button>
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
      
      {isCreateOpen && (
        <GenericCreateModal 
          collectionName="indicadores"
          onClose={() => setIsCreateOpen(false)}
          onCreated={(newRecord) => {
            setData(prev => [newRecord, ...prev]);
          }}
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

      {activeCompania && <CompaniaModal sigla={activeCompania} onClose={() => setActiveCompania(null)} />}
      {recordToDelete && (
        <ConfirmModal 
          title="Confirmar Borrado"
          message={<>¿Está seguro de que desea eliminar el registro de Indicadores para <strong>{recordToDelete["Concepto"]}</strong> ({recordToDelete["Años"]})? Esta acción no se puede deshacer.</>}
          onConfirm={handleDelete}
          onCancel={() => setRecordToDelete(null)}
          confirmText="Borrar"
        />
      )}
      {brokenLinkAlert && (
        <ConfirmModal 
          title="Enlace Roto Encontrado"
          message={brokenLinkAlert}
          onCancel={() => setBrokenLinkAlert(null)}
          isAlertOnly={true}
        />
      )}
    </div>
  );
}
