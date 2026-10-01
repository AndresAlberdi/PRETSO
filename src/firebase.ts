import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { firebaseConfig } from "@entorno/firebase";
import { assertFirebaseConfig } from "./utils/firebaseConfig";

// La configuración depende del ambiente de build (alias @entorno en vite.config.ts).
assertFirebaseConfig(firebaseConfig, import.meta.env.MODE);

export { firebaseConfig };

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
