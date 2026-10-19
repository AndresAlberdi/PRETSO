const CONFIG_NOT_FOUND = 'auth/configuration-not-found';

const CREDENTIAL_CODES = [
  'auth/invalid-credential',
  'auth/user-not-found',
  'auth/wrong-password',
  'auth/invalid-email',
  'auth/user-disabled',
];

const GENERIC = 'No se pudo iniciar sesión. Inténtelo de nuevo.';

/**
 * Código para el registro técnico: el `code` de Firebase, el `name` del error o «sin código».
 * Nunca devuelve el mensaje, el correo ni la contraseña.
 */
export function loginErrorCode(err: unknown): string {
  if (typeof err === 'object' && err !== null) {
    const raw = err as { code?: unknown; name?: unknown };
    if (typeof raw.code === 'string' && raw.code !== '') return raw.code;
    if (typeof raw.name === 'string' && raw.name !== '') return raw.name;
  }
  return 'sin código';
}

/**
 * Traduce un error de inicio de sesión de Firebase a un mensaje genérico en español.
 * Los fallos de credenciales (incluida la cuenta deshabilitada) comparten el mismo texto
 * para no revelar si una cuenta existe. Nunca muestra códigos ni textos crudos: el detalle técnico
 * va solo al registro.
 */
export function loginErrorMessage(err: unknown): string {
  let code = '';
  let message = '';
  if (typeof err === 'object' && err !== null) {
    const raw = err as { code?: unknown; message?: unknown };
    if (typeof raw.code === 'string') code = raw.code;
    if (typeof raw.message === 'string') message = raw.message;
  }

  if (code === CONFIG_NOT_FOUND || message.includes(CONFIG_NOT_FOUND)) {
    return 'Autenticación por Correo/Contraseña no está habilitada en Firebase Console. Por favor, habilítela.';
  }
  if (CREDENTIAL_CODES.includes(code)) return 'Correo o contraseña incorrectos. Si el problema persiste, comuníquese con la administración del proyecto.';
  if (code === 'auth/too-many-requests') {
    return 'Demasiados intentos. Espere unos minutos e inténtelo de nuevo.';
  }
  if (code === 'auth/network-request-failed') {
    return 'No se pudo conectar. Revise su conexión e inténtelo de nuevo.';
  }
  return GENERIC;
}
