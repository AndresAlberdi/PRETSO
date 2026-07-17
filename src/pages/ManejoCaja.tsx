import { useEffect, useState } from "react";
import { collection, getDocs, query } from "firebase/firestore";
import { db } from "../firebase";
import TransactionModal from "../components/TransactionModal";
import SearchBar from "../components/SearchBar";
import { cleanFirebaseData } from "../utils";
import { useAdmin } from "../context/AdminContext";
import ConfirmModal from "../components/ConfirmModal";
import { deleteDoc, doc } from "firebase/firestore";
import { logAction } from "../utils/audit";
import GenericCreateModal from "../components/GenericCreateModal";

export default function ManejoCaja() {
  const [data, setData] = useState<any[]>([]);
  const [companias, setCompanias] = useState<any[]>([]);
  const [transaccionesSet, setTransaccionesSet] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const { isEditMode } = useAdmin();
  const [recordToDelete, setRecordToDelete] = useState<any>(null);
  const [brokenLinkAlert, setBrokenLinkAlert] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // States for Master-Detail
  const [selectedCompId, setSelectedCompId] = useState<string | null>(null);
  
  // State for Transaction Modal
  const [activeTransaction, setActiveTransaction] = useState<string | number | null>(null);

  // Search state
  const [searchCategory, setSearchCategory] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const searchCategories = [
    { id: 'Autores', label: 'Persona' },
    { id: 'Ciudad', label: 'Ciudad' },
    { id: 'Año', label: 'Año' },
    { id: 'all', label: 'Texto libre' }
  ];

  // Filters
  const [filterCompania, setFilterCompania] = useState('');
  const [filterTemporada, setFilterTemporada] = useState('');
  const [filterAmbito, setFilterAmbito] = useState('');

  useEffect(() => {
    async function fetchData() {
      const qCaja = query(collection(db, "manejo_de_caja"));
      const snapCaja = await getDocs(qCaja);
      const docsCaja = snapCaja.docs.map(cleanFirebaseData);
      setData(docsCaja);

      const qComp = query(collection(db, "companias"));
      const snapComp = await getDocs(qComp);
      const docsComp = snapComp.docs.map(cleanFirebaseData);
      setCompanias(docsComp);
      
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
      await deleteDoc(doc(db, "manejo_de_caja", recordToDelete.id));
      await logAction('DELETE', 'manejo_de_caja', recordToDelete.id, 'pretsodatabase@gmail.com', recordToDelete);
      setData(data.filter(d => d.id !== recordToDelete.id));
      setRecordToDelete(null);
    } catch (error) {
      console.error("Error deleting document: ", error);
    }
  };

  const companiasInData = companias.filter(c => data.some(d => d["Sigla Compañía"] === c["Sigla Compañía"]));

  const uniqueCompanias = Array.from(new Set(companiasInData.map(c => c["Sigla Compañía"]))).filter(Boolean).sort();
  const uniqueTemporadas = Array.from(new Set(companiasInData.map(c => c["Temporadas teatrales"]))).filter(Boolean).sort();
  const uniqueAmbitos = Array.from(new Set(companiasInData.map(c => c["Ámbito"]))).filter(Boolean).sort();

  const filteredCompanias = companiasInData.filter(c => {
    if (filterCompania && c["Sigla Compañía"] !== filterCompania) return false;
    if (filterTemporada && c["Temporadas teatrales"] !== filterTemporada) return false;
    if (filterAmbito && c["Ámbito"] !== filterAmbito) return false;
    return true;
  });

  const searchResults = data.filter(d => {
    if (!searchQuery) return false;
    const q = searchQuery.toLowerCase();
    if (searchCategory === 'all') {
      return Object.values(d).some(v => String(v).toLowerCase().includes(q));
    }
    if (searchCategory === 'Autores') {
      const comp = companias.find(c => c["Sigla Compañía"] === d["Sigla Compañía"]);
      return comp && comp["Autores"] && String(comp["Autores"]).toLowerCase().includes(q);
    }
    return d[searchCategory] && String(d[searchCategory]).toLowerCase().includes(q);
  });

  const isSearching = searchQuery.length > 0;
  const detailData = data.filter(d => d["Sigla Compañía"] === selectedCompId);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: "1rem" }}>
        <h1>Manejo de Caja</h1>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {isEditMode && (
            <button 
              onClick={() => setIsCreateOpen(true)}
              style={{ padding: '0.5rem 1rem', background: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              Nuevo Registro
            </button>
          )}
          <SearchBar onSearch={(c, q) => { setSearchCategory(c); setSearchQuery(q); setSelectedCompId(null); }} categories={searchCategories} />
        </div>
        {(selectedCompId || isSearching) && (
          <button onClick={() => { setSelectedCompId(null); setSearchQuery(''); }} style={{ padding: '0.5rem 1rem' }}>Volver</button>
        )}
      </div>
      {!loading && !selectedCompId && !isSearching && <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Mostrando {filteredCompanias.length} registros</p>}

      {loading ? <p>Cargando datos...</p> : isSearching ? (
        <div>
          <h2>Resultados de Búsqueda ({searchResults.length} registros)</h2>
          <table>
            <thead><tr><th>Compañía</th><th>Ciudad</th><th>Año</th><th></th>{isEditMode && <th>Admin</th>}</tr></thead>
            <tbody>
              {searchResults.map(row => {
                const isBroken = row["Transacción"] && !transaccionesSet.has(Number(row["Transacción"]));
                return (
                <tr key={row.id}>
                  <td>{row["Sigla Compañía"]}</td>
                  <td>{row["Ciudad"]}</td>
                  <td>{row["Año"]}</td>
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
      ) : !selectedCompId ? (
        <div>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
            <select value={filterCompania} onChange={e => setFilterCompania(e.target.value)}>
              <option value="">Todas las Compañías</option>
              {uniqueCompanias.map(opt => <option key={opt} value={opt}>{opt}</option>)}
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
          <table>
            <thead><tr><th>Compañía</th><th>Autores</th><th>Temporadas</th><th>Ámbito</th><th></th></tr></thead>
            <tbody>
              {filteredCompanias.map((c, i) => (
                <tr key={i}>
                  <td>{c["Sigla Compañía"]}</td>
                  <td>{c["Autores"]}</td>
                  <td>{c["Temporadas teatrales"]}</td>
                  <td>{c["Ámbito"]}</td>
                  <td><button onClick={() => setSelectedCompId(c["Sigla Compañía"])}>CAJA</button></td>
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
              <tr><th>Ciudad</th><th>Año</th><th>Ingresos</th><th>Egresos</th><th>Otros bienes</th><th></th>{isEditMode && <th>Admin</th>}</tr>
            </thead>
            <tbody>
              {detailData.map(row => {
                const isBroken = row["Transacción"] && !transaccionesSet.has(Number(row["Transacción"]));
                return (
                <tr key={row.id}>
                  <td>{row["Ciudad"]}</td>
                  <td>{row["Año"]}</td>
                  <td>{row["Ingresos"]}</td>
                  <td>{row["Egresos"]}</td>
                  <td>{row["Otros bienes de la compañía"]}</td>
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
          collectionName="manejo_de_caja"
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

      {recordToDelete && (
        <ConfirmModal 
          title="Confirmar Borrado"
          message={<>¿Está seguro de que desea eliminar el registro de Caja en <strong>{recordToDelete["Ciudad"]}</strong> ({recordToDelete["Año"]})? Esta acción no se puede deshacer.</>}
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
