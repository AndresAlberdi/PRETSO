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
// Se pasan solo campos explícitos (no import.meta.env entero) y el token solo se lee en DEV: así Vite elimina la lectura
// como código muerto en cualquier build y no incrusta variables VITE_* en el paquete.
startAppCheck(app, recaptchaSiteKey, {
  MODE: import.meta.env.MODE,
  DEV: import.meta.env.DEV,
  VITE_APPCHECK_DEBUG_TOKEN: import.meta.env.DEV ? import.meta.env.VITE_APPCHECK_DEBUG_TOKEN : undefined,
});
export const db = getFirestore(app);
export const auth = getAuth(app);
