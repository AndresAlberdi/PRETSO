// Referencia a una compañía en los registros de Manejo de Caja, Remuneraciones,
// Indicadores y Corpus Christi: la llave interna es el NÚMERO de registro
// («Indicador de registro» de la colección `companias`); la sigla solo se muestra.

export interface CompaniaRef {
  [campo: string]: any;
}

const NUMERICO = /^-?\d+(\.\d+)?$/;

/** Canoniza una referencia: None/vacío → '', 7.0 → '7', "7.0" → '7', otro texto → recortado. */
export function canonizarReferencia(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'number') return Number.isFinite(valor) ? String(valor) : '';
  const texto = String(valor).trim();
  if (texto === '') return '';
  if (NUMERICO.test(texto)) return String(Number(texto));
  return texto;
}

/** Normaliza una sigla para comparar: sin tildes, sin mayúsculas ni espacios en los extremos. */
export function normalizarSigla(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  return String(valor).normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
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
