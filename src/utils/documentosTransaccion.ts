/**
 * Documentos enlazados a una transacción (Doc1..Doc10): lugar único para los
 * nombres de campo, la clave de comparación y la lista de ids con valor.
 * Lo usan la búsqueda guiada, la búsqueda por categorías y el dataset.
 */

/** Campos Doc1..Doc10 de una transacción, en orden. */
export const CAMPOS_DOC: readonly string[] = Array.from({ length: 10 }, (_, i) => `Doc${i + 1}`);

/** Clave de comparación estricta: distingue tipo y valor (`12` y `'12'` son distintos). */
export function claveEstricta(v: unknown): string {
  return `${typeof v}:${String(v)}`;
}

/** Doc1..Doc10 en orden, sin repetidos; salta lo que no es texto ni número, `''` y `0`. */
export function idsDocumentos(tx: Record<string, unknown>): Array<string | number> {
  const ids: Array<string | number> = [];
  const vistos = new Set<string>();
  for (const campo of CAMPOS_DOC) {
    const id = tx[campo];
    if ((typeof id !== 'string' && typeof id !== 'number') || id === '' || id === 0) continue;
    const clave = claveEstricta(id);
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    ids.push(id);
  }
  return ids;
}
