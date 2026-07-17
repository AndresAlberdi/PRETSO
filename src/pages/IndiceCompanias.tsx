
import { useEffect, useState } from "react";
import { collection, getDocs, query } from "firebase/firestore";
import { db } from "../firebase";
import { cleanFirebaseData } from "../utils";
import { useAdmin } from "../context/AdminContext";
import ConfirmModal from "../components/ConfirmModal";
import { deleteDoc, doc, where } from "firebase/firestore";
import { logAction } from "../utils/audit";
import GenericCreateModal from "../components/GenericCreateModal";

export default function IndiceCompanias() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { isEditMode } = useAdmin();
  const [recordToDelete, setRecordToDelete] = useState<any>(null);
  const [deleteErrorAlert, setDeleteErrorAlert] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    async function fetchData() {
      const q = query(collection(db, "companias"));
      const snapshot = await getDocs(q);
      setData(snapshot.docs.map(cleanFirebaseData));
      setLoading(false);
    }
    fetchData();
  }, []);

  const checkReferentialIntegrity = async (sigla: string) => {
    const collectionsToCheck = [
      { name: 'manejo_de_caja', label: 'Caja' },
      { name: 'salarios', label: 'Salarios' },
      { name: 'corpus_christi', label: 'Corpus Christi' },
      { name: 'indicadores', label: 'Indicadores' }
    ];

    let totalLinks = 0;
    let messageParts = [];

    for (const coll of collectionsToCheck) {
      const q = query(collection(db, coll.name), where("Sigla Compañía", "==", sigla));
      const snap = await getDocs(q);
      if (!snap.empty) {
        totalLinks += snap.size;
        messageParts.push(`${snap.size} en ${coll.label}`);
      }
    }

    if (totalLinks > 0) {
      return `Esta compañía está vinculada a ${totalLinks} registro(s) (${messageParts.join(', ')}). No se puede borrar.`;
    }
    return null;
  };

  const attemptDelete = async (row: any) => {
    setIsAnalyzing(true);
    const [error] = await Promise.all([
      checkReferentialIntegrity(row["Sigla Compañía"]),
      new Promise(resolve => setTimeout(resolve, 1000))
    ]);
    setIsAnalyzing(false);
    if (error) {
      setDeleteErrorAlert(error);
    } else {
      setRecordToDelete(row);
    }
  };

  const handleDelete = async () => {
    if (!recordToDelete) return;
    try {
      await deleteDoc(doc(db, "companias", recordToDelete.id));
      await logAction('DELETE', 'companias', recordToDelete.id, 'pretsodatabase@gmail.com', recordToDelete);
      setData(data.filter(d => d.id !== recordToDelete.id));
      setRecordToDelete(null);
    } catch (error) {
      console.error("Error deleting document: ", error);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: "1rem" }}>
        <h1>Índice de Compañías</h1>
        {isEditMode && (
          <button 
            onClick={() => setIsCreateOpen(true)}
            style={{ padding: '0.5rem 1rem', background: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            Nuevo Registro
          </button>
        )}
      </div>
      {!loading && <p style={{ color: 'var(--text-muted)' }}>Total registros: {data.length}</p>}
      {loading ? <p>Cargando datos...</p> : (
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr><th>Sigla (Compañías)</th><th>Autores</th><th>Temporadas Teatrales</th><th>Ámbito</th>{isEditMode && <th>Admin</th>}</tr>
            </thead>
            <tbody>
              {data.map(item => (
                <tr key={item.id}>
                  <td>{item["Sigla Compañía"]}</td>
                  <td>{item["Autores"]}</td>
                  <td>{item["Temporadas teatrales"]}</td>
                  <td>{item["Ámbito"]}</td>
                  {isEditMode && (
                    <td style={{ display: 'flex', gap: '0.5rem' }}>
                      <button onClick={() => alert("Edición en desarrollo")} style={{ background: 'var(--primary-color)' }}>Editar</button>
                      <button onClick={() => attemptDelete(item)} style={{ background: '#ff4d4f' }}>Borrar</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isCreateOpen && (
        <GenericCreateModal 
          collectionName="companias"
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
          message={<>¿Está seguro de que desea eliminar la compañía <strong>{recordToDelete["Sigla Compañía"]}</strong>? Esta acción no se puede deshacer.</>}
          onConfirm={handleDelete}
          onCancel={() => setRecordToDelete(null)}
          confirmText="Borrar"
        />
      )}

      {deleteErrorAlert && (
        <ConfirmModal 
          title="Error de Integridad"
          message={deleteErrorAlert}
          onCancel={() => setDeleteErrorAlert(null)}
          isAlertOnly={true}
        />
      )}
    </div>
  );
}
