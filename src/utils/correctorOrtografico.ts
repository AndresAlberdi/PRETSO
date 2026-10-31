import type { HTMLAttributes } from 'react';

/** Atributos del corrector ortográfico del navegador para un campo. */
export type PropsCorrector = Pick<HTMLAttributes<HTMLElement>, 'spellCheck' | 'lang'>;

/** Texto libre en español (datos históricos): el navegador subraya y sugiere. */
export const TEXTO_LIBRE: PropsCorrector = { spellCheck: true, lang: 'es' };

/** Códigos y llaves: sin corrector, porque el subrayado distrae y una sugerencia aceptada corrompería la llave. */
export const TEXTO_CODIGO: PropsCorrector = { spellCheck: false };

/**
 * Campos que son siglas, índices o referencias numéricas:
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
 * Campos que en el alta son `input type="number"`: sin corrector, sea cual sea
 * el tipo con que llegó el valor importado. Los nombres replican los del alta,
 * incluidos los espacios del campo heredado de representaciones.
 */
export const CAMPOS_NUMERICOS: readonly string[] = [
  'Año',
  'Ración diaria',
  'Pago por representación',
  'Días de ración en un año',
  'Número estimado de representaciones por año',
  'Número de representaciones  por año ',
];

/**
 * Devuelve los atributos del corrector para un campo según su nombre. El tipo
 * del valor original solo importa si es booleano; un número en un campo libre
 * (p. ej. «Monto a pagar») conserva el corrector, como el resto del texto.
 */
export function propsCorrector(campo: string, valorOriginal?: unknown): PropsCorrector {
  if (CAMPOS_CODIGO.includes(campo) || CAMPOS_NUMERICOS.includes(campo) || /^Doc\d+$/.test(campo)) return TEXTO_CODIGO;
  if (typeof valorOriginal === 'boolean') return TEXTO_CODIGO;
  return TEXTO_LIBRE;
}
