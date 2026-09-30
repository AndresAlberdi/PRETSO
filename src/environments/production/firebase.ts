import type { FirebaseWebConfig } from '../../utils/firebaseConfig.ts';

// Configuración web de Firebase del ambiente producción (proyecto pretso-prod).
// apiKey y appId se completan en el paso 3 del plan (registro de la app web en pretso-prod); storageBucket
// también, aunque la aplicación no lo usa. Mientras apiKey o appId falten, la aplicación se niega a
// iniciar y el build de producción de un tag falla (ver assertPublishable).
export const firebaseConfig = {
  projectId: 'pretso-prod',
  authDomain: 'pretso-prod.firebaseapp.com',
  messagingSenderId: '309066922693',
  storageBucket: '',
  apiKey: '',
  appId: '',
} satisfies FirebaseWebConfig;
