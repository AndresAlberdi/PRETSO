// Referencia a una compañía en los registros de Manejo de Caja, Remuneraciones,
// Indicadores y Corpus Christi: la llave interna es el NÚMERO de registro
// («Indicador de registro» de la colección `companias`); la sigla solo se muestra.

export interface CompaniaRef {
  [campo: string]: any;
}

const NUMERICO = /^-?\d+(\.\d+)?$/;

/**
 * Canoniza una referencia. Regla (alineada con `canon` de
 * scripts/diagnostico_referencias_companias.py): null/undefined/vacío/'None'/'nan'/'NaN' → '';
 * 7.0 → '7' y "7.0" → '7' (en Python: `^\d+\.0+$` → entero); otro texto → recortado.
 * Diferencia deliberada: aquí también se canoniza cualquier decimal numérico
 * ("7.50" → '7.5'), porque el valor numérico guardado puede ser float; en la práctica
 * las referencias son enteros, por lo que ambas reglas coinciden.
 */
export function canonizarReferencia(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'number') return Number.isFinite(valor) ? String(valor) : '';
  const texto = String(valor).trim();
  if (texto === '' || texto === 'None' || texto === 'nan' || texto === 'NaN') return '';
  if (NUMERICO.test(texto)) return String(Number(texto));
  return texto;
}

/** Normaliza una sigla para comparar: sin tildes, sin mayúsculas ni espacios en los extremos. */
export function normalizarSigla(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  return String(valor).normalize('NFD').replace(/\p{M}/gu, '').trim().toLowerCase();
}

/**
 * Resuelve una referencia contra la lista de compañías: primero por número de
 * registro y, como respaldo, por sigla normalizada. Devuelve null si no resuelve.
 */
export function resolverCompania<T extends CompaniaRef>(valor: unknown, companias: T[]): T | null {
  const ref = canonizarReferencia(valor);
  if (ref === '') return null;
  const porNumero = companias.find(c => canonizarReferencia(c['Indicador de registro']) === ref);
  if (porNumero) return porNumero;
  const sigla = normalizarSigla(ref);
  return companias.find(c => normalizarSigla(c['Sigla Compañía']) === sigla && sigla !== '') || null;
}

/** Sigla para mostrar: la de la compañía resuelta; si no resuelve, la referencia canonizada. */
export function siglaDeReferencia(valor: unknown, companias: CompaniaRef[]): string {
  const c = resolverCompania(valor, companias);
  return c ? String(c['Sigla Compañía'] ?? '') : canonizarReferencia(valor);
}

/**
 * Texto visible de una compañía resuelta: su sigla; si está vacía, su nombre; si
 * tampoco hay, un rótulo fijo. Nunca el número de registro.
 */
export function textoVisibleCompania(compania: CompaniaRef): string {
  const sigla = String(compania['Sigla Compañía'] ?? '').trim();
  if (sigla) return sigla;
  const nombre = String(compania['Nombre Compañía'] ?? '').trim();
  return nombre || 'Compañía sin sigla';
}

export const TEXTO_COMPANIA_NO_ENCONTRADA = 'Compañía no encontrada';

/**
 * Valor de una referencia a compañía para el Excel: la sigla (o el nombre) de la
 * compañía resuelta, nunca el número de registro. Si no resuelve y es numérico,
 * un rótulo fijo; si no resuelve y es texto, el texto canonizado.
 */
export function siglaParaExportar(valor: unknown, companias: CompaniaRef[]): string {
  const ref = canonizarReferencia(valor);
  if (ref === '') return '';
  const compania = resolverCompania(valor, companias);
  if (compania) return textoVisibleCompania(compania);
  return NUMERICO.test(ref) ? TEXTO_COMPANIA_NO_ENCONTRADA : ref;
}

/**
 * Valor que se guarda en el registro para una compañía: el número de registro,
 * con tipo numérico (igual que los datos migrados, que conservan el tipo de
 * `Indicador de registro`). Si no fuera numérico, se conserva tal cual.
 */
export function valorDeReferencia(compania: CompaniaRef): number | string {
  const bruto = compania['Indicador de registro'];
  const canon = canonizarReferencia(bruto);
  return NUMERICO.test(canon) ? Number(canon) : canon;
}

/** Etiqueta del selector: «sigla - autores». */
export function etiquetaCompania(compania: CompaniaRef): string {
  return `${compania['Sigla Compañía'] ?? ''} - ${compania['Autores'] ?? ''}`;
}

/** Campos de Corpus Christi que referencian compañías (Compañía, Compañía2…, Cmp, Cmp2…). */
export function esCampoCompaniaCorpus(clave: string): boolean {
  return /^(Compañía|Cmp)\d*$/.test(clave);
}

const CAMPOS_CORPUS = [
  'Compañía', ...Array.from({ length: 9 }, (_, i) => `Compañía${i + 2}`), 'Cmp', 'Cmp2',
];

/** Campos de referencia a compañía de cada colección (según COLUMN_ORDERS de xlsxExport). */
export function camposReferenciaCompania(coleccion: string): string[] {
  if (coleccion === 'corpus_christi') return CAMPOS_CORPUS;
  if (['manejo_de_caja', 'salarios', 'indicadores'].includes(coleccion)) return ['Sigla Compañía'];
  return [];
}

/**
 * Valores con los que un registro puede referenciar a la compañía: el número de
 * registro (numérico y su texto, por datos heredados) y, como respaldo, la sigla.
 */
export function valoresDeBusquedaReferencia(compania: CompaniaRef): Array<number | string> {
  const valores: Array<number | string> = [];
  const canon = canonizarReferencia(compania['Indicador de registro']);
  if (canon !== '') {
    if (NUMERICO.test(canon)) valores.push(Number(canon));
    valores.push(canon);
  }
  const sigla = String(compania['Sigla Compañía'] ?? '').trim();
  if (sigla !== '' && !valores.includes(sigla)) valores.push(sigla);
  return valores;
}
