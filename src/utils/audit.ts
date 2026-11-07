import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";
import { invalidarIndice } from "./busquedaGuia/cargaIndice";
import { codigoError } from './codigoError';

export async function logAction(action: 'CREATE' | 'EDIT' | 'DELETE', collectionName: string, recordId: string, details?: Record<string, unknown>) {
  // Toda escritura deja obsoleto el índice de búsqueda en caché: se descarta para que la próxima consulta lo recargue.
  invalidarIndice();
  try {
    await addDoc(collection(db, "logs"), {
      action,
      collection: collectionName,
      recordId,
      user: auth.currentUser?.email ?? 'desconocido',
      timestamp: serverTimestamp(),
      details: details || null
    });
  } catch (error) {
    console.error('No se pudo registrar la acción de auditoría:', codigoError(error));
  }
}
