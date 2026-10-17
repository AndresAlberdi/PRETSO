import type { ConfigCategoria } from './filtrarRegistros';

/**
 * Categorías de búsqueda de las páginas de administración y los campos de
 * Firestore donde se busca. Los nombres deben existir en COLUMN_ORDERS
 * (xlsxExport.ts); una prueba lo vigila.
 */
const CAMPOS_DOC = Array.from({ length: 10 }, (_, i) => `Doc${i + 1}`);

export const CAMPOS_BUSQUEDA_DOCUMENTOS: Record<string, ConfigCategoria> = {
  doc: { campos: ['Doc'], modo: 'exacto' },
  all: { campos: ['Doc', 'Documento'] },
};

export const CAMPOS_BUSQUEDA_TRANSACCIONES: Record<string, ConfigCategoria> = {
  num: { campos: ['Num'], modo: 'exacto' },
  noticia: { campos: ['Noticia'] },
  fuentes: { campos: ['Fuentes para la generación del dato'] },
  doc: { campos: CAMPOS_DOC, modo: 'exacto' },
  all: { campos: ['Num', 'Noticia', 'Fuentes para la generación del dato', ...CAMPOS_DOC] },
};
