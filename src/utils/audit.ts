import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";

export async function logAction(action: 'CREATE' | 'EDIT' | 'DELETE', collectionName: string, recordId: string, details?: Record<string, unknown>) {
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
    console.error("Error logging action:", error);
  }
}
