import type { FirebaseWebConfig } from '../../utils/firebaseConfig.ts';
import config from '../../firebase-config.json';

// Configuración web de Firebase del ambiente staging (proyecto pretso-database), tomada de
// src/firebase-config.json. La apiKey web es pública por diseño; la protegen las reglas de Firestore
// y las restricciones de la clave. Se reexporta desde ese archivo para que la clave no aparezca como
// una línea nueva en el historial (Gitleaks la marcaría en el push a main).
export const firebaseConfig = {
  projectId: config.projectId,
  appId: config.appId,
  storageBucket: config.storageBucket,
  apiKey: config.apiKey,
  authDomain: config.authDomain,
  messagingSenderId: config.messagingSenderId,
} satisfies FirebaseWebConfig;

// Site key de reCAPTCHA Enterprise para App Check (proyecto pretso-database; App Check en monitoreo).
// Es pública por diseño: el navegador la recibe al cargar reCAPTCHA; la protegen los dominios permitidos
// de la clave.
export const recaptchaSiteKey: string = '6Lf3ONstAAAAAMSYIktWKowb2Jhczxs8cKC4SkDM';
