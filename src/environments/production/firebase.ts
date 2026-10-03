import type { FirebaseWebConfig } from '../../utils/firebaseConfig.ts';

// Configuración web de Firebase del ambiente producción (proyecto pretso-prod), de la app web «PRETSO»
// registrada el 2026-09-30 (paso 3 del plan). La apiKey web es pública por diseño; la protegen las reglas de
// Firestore y su restricción por referente y por API (solo identitytoolkit, securetoken, firestore y
// firebaseappcheck, desde pretso-prod.web.app y pretso-prod.firebaseapp.com).
export const firebaseConfig = {
  projectId: 'pretso-prod',
  appId: '1:309066922693:web:afd5bf807e672a84c64eac',
  storageBucket: 'pretso-prod.firebasestorage.app',
  apiKey: 'AIzaSyBmZsjJ79F4BN9zQ8r8qKbzp1mstinm7Is',
  authDomain: 'pretso-prod.firebaseapp.com',
  messagingSenderId: '309066922693',
} satisfies FirebaseWebConfig;

// Site key de reCAPTCHA Enterprise para App Check (proyecto pretso-prod; App Check en monitoreo).
// Es pública por diseño: el navegador la recibe al cargar reCAPTCHA; la protegen los dominios permitidos
// de la clave (pretso-prod.web.app y pretso-prod.firebaseapp.com).
export const recaptchaSiteKey: string = '6Le7KN0tAAAAADt5NkhRFxNpqSg7P3fwrSdj1fSB';
