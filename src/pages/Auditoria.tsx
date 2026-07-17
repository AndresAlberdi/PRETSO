import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "../firebase";

export default function Auditoria() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLogs() {
      try {
        const q = query(collection(db, "logs"), orderBy("timestamp", "desc"));
        const snap = await getDocs(q);
        const logData = snap.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          // Convert timestamp to Date string safely
          date: doc.data().timestamp ? doc.data().timestamp.toDate().toLocaleString() : 'N/A'
        }));
        setLogs(logData);
      } catch (error) {
        console.error("Error fetching logs:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchLogs();
  }, []);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: "1rem" }}>
        <h1>Auditoría (Logs)</h1>
      </div>
      
      {loading ? <p>Cargando logs...</p> : logs.length === 0 ? <p>No hay registros de auditoría.</p> : (
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Acción</th>
                <th>Colección</th>
                <th>ID Registro</th>
                <th>Usuario</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(row => (
                <tr key={row.id}>
                  <td>{row.date}</td>
                  <td style={{ color: row.action === 'DELETE' ? '#ff4d4f' : 'var(--primary-color)', fontWeight: 'bold' }}>{row.action}</td>
                  <td>{row.collection}</td>
                  <td>{row.recordId}</td>
                  <td>{row.user}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
