/** Etiquetas visibles de los campos cuyo nombre en Firestore no se muestra tal cual. */
export const ETIQUETAS_CAMPO: Readonly<Record<string, string>> = {
  'Num': 'Nro.',
  'Sigla Compañía': 'Compañía',
  'Año': 'Año',
  'Años': 'Años',
  'Categorías': 'Categoría',
  'Beneficiario ': 'Beneficiario',
  'Encargado ': 'Encargado',
  'Número de representaciones  por año ': 'Número de representaciones por año'
};

/** Etiqueta visible de un campo; si no hay una propia, el nombre del campo. */
export function etiquetaCampo(campo: string): string {
  return Object.hasOwn(ETIQUETAS_CAMPO, campo) ? ETIQUETAS_CAMPO[campo] : campo;
}
