import { useEffect, useState } from "react";
import { collection, getDocs, query } from "firebase/firestore";
import { db } from "../firebase";
import TransactionModal from "../components/TransactionModal";
import SearchBar from "../components/SearchBar";
import { cleanFirebaseData } from "../utils";
import CompaniaModal from "../components/CompaniaModal";
import { useAdmin } from "../context/AdminContext";
import ConfirmModal from "../components/ConfirmModal";
import { deleteDoc, doc, updateDoc } from "firebase/firestore";
import { logAction } from "../utils/audit";
import GenericCreateModal from "../components/GenericCreateModal";
import GenericEditModal from "../components/GenericEditModal";

export default function CorpusChristi() {
  const [data, setData] = useState<any[]>([]);
  const [transaccionesSet, setTransaccionesSet] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const { isEditMode } = useAdmin();
  const [recordToDelete, setRecordToDelete] = useState<any>(null);
  const [brokenLinkAlert, setBrokenLinkAlert] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [recordToEdit, setRecordToEdit] = useState<any | null>(null);

  // Master-Detail State
  const [selectedCityYear, setSelectedCityYear] = useState<{ ciudad: string, año: string } | null>(null);
  
  // Transaction Modal State
  const [activeTransaction, setActiveTransaction] = useState<string | number | null>(null);

  // Compania Modal State
  const [activeCompania, setActiveCompania] = useState<string | null>(null);

  // Search state
  const [searchCategory, setSearchCategory] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const searchCategories = [
    { id: 'Ciudad', label: 'Ciudad' },
    { id: 'Año', label: 'Año' },
    { id: 'all', label: 'Texto libre' }
  ];

  // Filters
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

  // Create unique pairs of Ciudad+Año for the Master view
  const masterGroups = Array.from(new Set(data.map(d => `${d["Ciudad"]}|${d["Año"]}`))).map(group => {
    const [c, a] = group.split('|');
    return { ciudad: c, año: a };
  });

  const filteredGroups = masterGroups.filter(g => {
    if (filterCiudad && g.ciudad !== filterCiudad) return false;
    if (filterAno && g.año !== filterAno) return false;
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
  const detailData = data.filter(d => 
    selectedCityYear && d["Ciudad"] === selectedCityYear.ciudad && String(d["Año"]) === String(selectedCityYear.año)
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: "1rem" }}>
        <h1>Corpus Christi</h1>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {isEditMode && (
            <button 
              onClick={() => setIsCreateOpen(true)}
              style={{ padding: '0.5rem 1rem', background: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              Nuevo Registro
            </button>
          )}
          <SearchBar onSearch={(c, q) => { setSearchCategory(c); setSearchQuery(q); setSelectedCityYear(null); }} categories={searchCategories} />
        </div>
        {(selectedCityYear || isSearching) && (
          <button onClick={() => { setSelectedCityYear(null); setSearchQuery(''); }} style={{ padding: '0.5rem 1rem' }}>Volver</button>
        )}
      </div>
      {!loading && !selectedCityYear && !isSearching && <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Mostrando {filteredGroups.length} registros</p>}

      {loading ? <p>Cargando datos...</p> : isSearching ? (
        <div>
          <h2>Resultados de Búsqueda ({searchResults.length} registros)</h2>
          <table>
            <thead><tr><th>Ciudad</th><th>Año</th><th>Encargado</th><th>Monto a pagar</th><th></th>{isEditMode && <th>Admin</th>}</tr></thead>
            <tbody>
              {searchResults.map(row => {
                const isBroken = row["Transacción"] && !transaccionesSet.has(Number(row["Transacción"]));
                return (
                <tr key={row.id}>
                  <td>{row["Ciudad"]}</td>
                  <td>{row["Año"]}</td>
                  <td>{row["Encargado "]}</td>
                  <td>{row["Monto a pagar"]}</td>
                  <td>
                    {row["Transacción"] && (
                      isBroken ? 
                        <button style={{ background: '#ff4d4f' }} onClick={() => setBrokenLinkAlert(`El enlace a la transacción ${row["Transacción"]} está roto. El registro no existe en la base de datos, por favor haga la corrección.`)}>Enlace Roto</button>
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
          <table>
            <thead><tr><th>Ciudad</th><th>Año</th><th></th></tr></thead>
            <tbody>
              {filteredGroups.map((g, i) => (
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
          <div style={{ marginBottom: '1rem' }}><p style={{ color: 'var(--text-muted)' }}>{detailData.length} transacciones registradas</p></div>
          <table>
            <thead>
              <tr><th>Encargo</th><th>Encargado</th><th>Compañías</th><th>Monto a pagar</th><th>Fondos</th><th></th>{isEditMode && <th>Admin</th>}</tr>
            </thead>
            <tbody>
              {detailData.map(row => {
                const isBroken = row["Transacción"] && !transaccionesSet.has(Number(row["Transacción"]));
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
                    {row["Transacción"] && (
                      isBroken ? 
                        <button style={{ background: '#ff4d4f' }} onClick={() => setBrokenLinkAlert(`El enlace a la transacción ${row["Transacción"]} está roto. El registro no existe en la base de datos, por favor haga la corrección.`)}>Enlace Roto</button>
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
          message={<>¿Está seguro de que desea eliminar el registro de Corpus Christi para <strong>{recordToDelete["Ciudad"]}</strong> ({recordToDelete["Año"]})? Esta acción no se puede deshacer.</>}
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
