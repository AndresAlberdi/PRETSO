import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

export async function logAction(action: 'CREATE' | 'EDIT' | 'DELETE', collectionName: string, recordId: string, userEmail: string, details?: any) {
  try {
    await addDoc(collection(db, "logs"), {
      action,
      collection: collectionName,
      recordId,
      user: userEmail,
      timestamp: serverTimestamp(),
      details: details || null
    });
  } catch (error) {
    console.error("Error logging action:", error);
  }
}
