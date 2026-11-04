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

/** URL de una sección con el término y, si se pide, los parámetros de unidad. Nunca concatena sin codificar. */
export function enlaceSeccion(coleccion: string, crudo: string, parametros: Record<string, string> = {}): string {
  const ruta = RUTA_COLECCION[coleccion] ?? '/buscar';
  const params = new URLSearchParams();
  params.set('q', crudo);
  for (const [clave, valor] of Object.entries(parametros)) params.set(clave, valor);
  return `${ruta}?${params.toString()}`;
}
