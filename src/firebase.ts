import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { firebaseConfig, recaptchaSiteKey } from "@entorno/firebase";
import { assertFirebaseConfig } from "./utils/firebaseConfig";
import { startAppCheck } from "./utils/appCheck";

// La configuración depende del ambiente de build (alias @entorno en vite.config.ts).
assertFirebaseConfig(firebaseConfig, import.meta.env.MODE);

export { firebaseConfig };

const app = initializeApp(firebaseConfig);
// App Check se inicializa antes de Firestore y Auth para que todas las peticiones lleven token. En monitoreo,
// si reCAPTCHA falla, las peticiones pasan sin token.
startAppCheck(app, recaptchaSiteKey, import.meta.env);
export const db = getFirestore(app);
export const auth = getAuth(app);
