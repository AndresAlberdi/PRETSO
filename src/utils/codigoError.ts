/**
 * Código para el registro técnico: el `code` de Firebase, el `name` del error o «sin código».
 * Nunca devuelve el mensaje ni el objeto del error, que pueden contener datos personales o tokens.
 */
export function codigoError(err: unknown): string {
  if (typeof err === 'object' && err !== null) {
    const raw = err as { code?: unknown; name?: unknown };
    if (typeof raw.code === 'string' && raw.code !== '') return raw.code;
    if (typeof raw.name === 'string' && raw.name !== '') return raw.name;
  }
  return 'sin código';
}
