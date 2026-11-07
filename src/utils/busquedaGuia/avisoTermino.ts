import { validarTermino } from './termino';

/** Texto del aviso según el motivo de rechazo; `texto` es lo escrito. */
export function textoAviso(motivo: 'corto' | 'conector', texto: string): string {
  if (motivo === 'corto') return 'Escriba al menos 3 letras, o un año de cuatro cifras.';
  return `La palabra «${texto.trim()}» es muy común para buscarla sola; escriba un nombre, un lugar o un año.`;
}

/** Aviso para lo escrito, o null si es válido o está vacío. */
export function avisoDe(texto: string): string | null {
  const v = validarTermino(texto);
  if (v.ok || v.motivo === 'vacio') return null;
  return textoAviso(v.motivo, texto);
}
