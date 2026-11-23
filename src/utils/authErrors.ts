import { codigoError } from './codigoError';

/**
 * Código para el registro técnico: el `code` de Firebase, el `name` del error o «sin código».
 * Nunca devuelve el mensaje, el correo ni la contraseña.
 */
export function loginErrorCode(err: unknown): string {
  return codigoError(err);
}

const GOOGLE_GENERIC = 'No se pudo iniciar sesión con Google. Inténtelo de nuevo.';

/**
 * Traduce un error del inicio de sesión con Google (popup) a un texto en español.
 * Nunca devuelve el mensaje crudo, los códigos ni los datos del error (`customData`).
 */
export function googleLoginErrorMessage(err: unknown): string {
  switch (loginErrorCode(err)) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
    case 'auth/user-cancelled':
      return 'Se cerró la ventana de Google antes de terminar. Inténtelo de nuevo.';
    case 'auth/popup-blocked':
      return 'El navegador bloqueó la ventana de Google. Permita las ventanas emergentes para este sitio e inténtelo de nuevo.';
    case 'auth/account-exists-with-different-credential':
      return 'Su cuenta usa otro método de acceso. Comuníquese con la administración del proyecto.';
    case 'auth/network-request-failed':
      return 'No se pudo conectar. Revise su conexión e inténtelo de nuevo.';
    case 'auth/user-disabled':
      return 'Su cuenta está deshabilitada. Comuníquese con la administración del proyecto.';
    case 'auth/admin-restricted-operation':
    case 'auth/operation-not-allowed':
      return 'Esta cuenta de Google no está autorizada en PRETSO. Solicite el acceso a la administración del proyecto.';
    case 'auth/too-many-requests':
      return 'Demasiados intentos. Espere unos minutos e inténtelo de nuevo.';
    case 'auth/web-storage-unsupported':
      return 'Su navegador bloquea el almacenamiento que requiere el inicio de sesión con Google. Habilítelo o use otro navegador.';
    default:
      return GOOGLE_GENERIC;
  }
}

export const ADMIN_GOOGLE_ONLY_MESSAGE =
  'Las cuentas de administración solo pueden entrar con «Continuar con Google». Se cerró la sesión; vuelva a entrar con Google.';
