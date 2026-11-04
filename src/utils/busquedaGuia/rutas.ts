/** Ruta de cada colección buscable. */
export const RUTA_COLECCION: Readonly<Record<string, string>> = {
  manejo_de_caja: '/caja',
  salarios: '/salarios',
  corpus_christi: '/corpus',
  indicadores: '/indicadores',
  companias: '/companias',
  bibliografia: '/bibliografia',
  transacciones: '/transacciones',
  documentos: '/documentos',
};

/**
 * URL de una sección con el término y, si se pide, los parámetros de unidad.
 * Nunca concatena sin codificar; `q` se aplica al final y no lo pisan los parámetros.
 * Una colección desconocida es un error de programación y lanza.
 */
export function enlaceSeccion(coleccion: string, crudo: string, parametros: Record<string, string> = {}): string {
  const ruta = RUTA_COLECCION[coleccion];
  if (ruta === undefined) throw new Error(`Colección sin ruta de búsqueda: ${coleccion}`);
  const params = new URLSearchParams();
  for (const [clave, valor] of Object.entries(parametros)) params.set(clave, valor);
  params.set('q', crudo);
  return `${ruta}?${params.toString()}`;
}
