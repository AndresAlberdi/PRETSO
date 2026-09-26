// Cliente OAuth web del proyecto pretso-database, usado por la copia a Google Drive.
// Un Client ID es un identificador público (Google lo muestra en cada inicio de sesión), no un secreto.
export const DEFAULT_GOOGLE_CLIENT_ID =
  '48942361199-2gsj7os8nip8m49gtc9t9pdp1s9n0j4d.apps.googleusercontent.com';

export const GOOGLE_CLIENT_ID_STORAGE_KEY = 'google_client_id';

// Un valor guardado en este navegador reemplaza al fijo; vacío significa «usar el fijo».
export function resolveGoogleClientId(saved: string | null | undefined): string {
  const trimmed = saved?.trim();
  return trimmed ? trimmed : DEFAULT_GOOGLE_CLIENT_ID;
}
