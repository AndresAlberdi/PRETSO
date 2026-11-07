import { normalizarTexto } from '../filtrarRegistros';
import { esConsultaAnio } from './anios';

/** Longitud máxima de un término de búsqueda (también `maxLength` del campo). */
export const LONGITUD_MAXIMA_TERMINO = 100;

/** Longitud mínima de un término (un año de cuatro cifras ya la cumple). */
export const LONGITUD_MINIMA = 3;

/** Conectores y palabras vacías del español (ya sin tildes) que no sirven como término solos. */
export const CONECTORES: ReadonlySet<string> = new Set([
  'a', 'al', 'ante', 'bajo', 'con', 'contra', 'de', 'del', 'desde', 'e', 'el', 'ella', 'ellos', 'en', 'entre',
  'es', 'esa', 'ese', 'esto', 'hacia', 'hasta', 'la', 'las', 'le', 'lo', 'los', 'mas', 'ni', 'no', 'o', 'para',
  'por', 'que', 'se', 'segun', 'sin', 'sobre', 'su', 'sus', 'tras', 'u', 'un', 'una', 'unas', 'unos', 'y',
]);

export type ResultadoTermino =
  | { ok: true; termino: string }
  | { ok: false; motivo: 'vacio' | 'corto' | 'conector' };

/**
 * Valida un término de búsqueda. Se normaliza y recorta; vacío → 'vacio';
 * menos de 3 caracteres → 'corto' (salvo un año de 4 cifras); un término formado
 * solo por conectores («con», «de la») → 'conector'. Una frase que mezcla
 * conectores con otras palabras («caja de la compañía») es válida.
 */
export function validarTermino(termino: unknown): ResultadoTermino {
  const normal = normalizarTexto(termino);
  if (normal === '') return { ok: false, motivo: 'vacio' };
  if (esConsultaAnio(normal)) return { ok: true, termino: normal };
  if (normal.length < LONGITUD_MINIMA) return { ok: false, motivo: 'corto' };
  if (normal.split(' ').every(p => CONECTORES.has(p))) return { ok: false, motivo: 'conector' };
  return { ok: true, termino: normal };
}
