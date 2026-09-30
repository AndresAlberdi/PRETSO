import { googleClientId } from '@entorno/google';

// Cliente OAuth web de Google Drive; depende del ambiente de build (src/environments/<ambiente>/google.ts).
// Un Client ID es un identificador público (Google lo muestra en cada inicio de sesión), no un secreto.
export const DEFAULT_GOOGLE_CLIENT_ID = googleClientId;

export const GOOGLE_CLIENT_ID_STORAGE_KEY = 'google_client_id';

// Un valor guardado en este navegador reemplaza al fijo; vacío significa «usar el fijo».
export function resolveGoogleClientId(saved: string | null | undefined): string {
  const trimmed = saved?.trim();
  return trimmed ? trimmed : DEFAULT_GOOGLE_CLIENT_ID;
}
