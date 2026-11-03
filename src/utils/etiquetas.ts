/** Etiquetas visibles de los campos cuyo nombre en Firestore no se muestra tal cual. */
export const ETIQUETAS_CAMPO: Readonly<Record<string, string>> = {
  'Num': 'Nro.',
  'Sigla Compañía': 'Compañía',
  'Nombre Compañía': 'Nombre de la compañía',
  'Año': 'Año',
  'Años': 'Años',
  'Categorías': 'Categoría',
  'Beneficiario ': 'Beneficiario',
  'Encargado ': 'Encargado',
};

/** Etiqueta visible de un campo; si no hay una propia, el nombre del campo. */
export function etiquetaCampo(campo: string): string {
  return Object.hasOwn(ETIQUETAS_CAMPO, campo) ? ETIQUETAS_CAMPO[campo] : campo;
}

/** Nombre visible de cada colección de Firestore. */
export const NOMBRES_COLECCION: Readonly<Record<string, string>> = {
  documentos: 'Documentos',
  companias: 'Compañías',
  transacciones: 'Transacciones',
  manejo_de_caja: 'Manejo de caja',
  salarios: 'Remuneraciones',
  corpus_christi: 'Corpus Christi',
  indicadores: 'Indicadores',
  bibliografia: 'Bibliografía',
};

/** Nombre visible de una colección; si no hay uno propio, el identificador. */
export function nombreColeccion(coleccion: string): string {
  return Object.hasOwn(NOMBRES_COLECCION, coleccion) ? NOMBRES_COLECCION[coleccion] : coleccion;
}
