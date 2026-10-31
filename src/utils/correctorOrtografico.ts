import type { HTMLAttributes } from 'react';

/** Atributos del corrector ortográfico del navegador para un campo. */
export type PropsCorrector = Pick<HTMLAttributes<HTMLElement>, 'spellCheck' | 'lang'>;

/** Texto libre en español (datos históricos): el navegador subraya y sugiere. */
export const TEXTO_LIBRE: PropsCorrector = { spellCheck: true, lang: 'es' };

/** Códigos y llaves: sin corrector, porque el subrayado distrae y una sugerencia aceptada corrompería la llave. */
export const TEXTO_CODIGO: PropsCorrector = { spellCheck: false };

/**
 * Campos que son siglas, índices, referencias numéricas o credenciales:
 * nunca pasan por el corrector ortográfico.
 */
export const CAMPOS_CODIGO: readonly string[] = [
  'Sigla Compañía',
  'Doc',
  'Num',
  'Indicador de registro',
  'Transacción',
];

/**
 * Devuelve los atributos del corrector para un campo según su nombre y el
 * tipo de su valor original (los valores numéricos o booleanos son códigos).
 */
export function propsCorrector(campo: string, valorOriginal?: unknown): PropsCorrector {
  if (CAMPOS_CODIGO.includes(campo) || /^Doc\d+$/.test(campo)) return TEXTO_CODIGO;
  if (typeof valorOriginal === 'number' || typeof valorOriginal === 'boolean') return TEXTO_CODIGO;
  return TEXTO_LIBRE;
}
