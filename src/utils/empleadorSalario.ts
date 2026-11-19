// Empleador «otro» en Remuneraciones: un registro de `salarios` puede tener como empleador una compañía de la lista
// ('Sigla Compañía') o, si esa sigla está vacía, un empleador escrito a mano con tres datos en el mismo registro:
// 'Empleador', 'Temporadas teatrales' y 'Ámbito'. No hay lista ni tabla de otros empleadores.
import { canonizarReferencia } from './referenciaCompania';
import { normalizarTexto } from './filtrarRegistros';

export const TEXTO_OTRO = 'otro';
export const PARAMETRO_EMPLEADOR = 'empleador';
export const VALOR_FILTRO_OTRO = '__otro__';
export const CAMPOS_EMPLEADOR_OTRO = ['Empleador', 'Temporadas teatrales', 'Ámbito'] as const;

type Registro = Record<string, unknown>;

/** Texto escrito a mano: solo string o número; espacios colapsados y recortados. Otro tipo → ''. */
export function textoManual(v: unknown): string {
  if (typeof v !== 'string' && typeof v !== 'number') return '';
  return String(v).normalize('NFC').replace(/\s+/g, ' ').trim();
}

/** «Otro» = sin compañía referenciada y con nombre de empleador. Si hay sigla, gana la compañía. */
export function esEmpleadorOtro(r: Registro): boolean {
  return canonizarReferencia(r['Sigla Compañía']) === '' && textoManual(r['Empleador']) !== '';
}

/** Clave estable y legible (para la URL) del grupo: nombre|temporadas|ámbito normalizados. */
export function claveEmpleadorOtro(r: Registro): string {
  return CAMPOS_EMPLEADOR_OTRO
    .map((c) => normalizarTexto(textoManual(r[c])).replace(/\|/g, '/'))
    .join('|');
}

export interface GrupoEmpleadorOtro<T> {
  clave: string;
  nombre: string;
  temporadas: string;
  ambito: string;
  registros: T[];
}

const numeroIndicador = (r: Registro): number => {
  const n = Number(r['Indicador de registro']);
  return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
};

/** Agrupa los registros «otro» por nombre, temporadas y ámbito normalizados. */
export function agruparEmpleadoresOtro<T extends Registro>(registros: readonly T[]): GrupoEmpleadorOtro<T>[] {
  const mapa = new Map<string, T[]>();
  for (const r of registros) {
    if (!esEmpleadorOtro(r)) continue;
    const k = claveEmpleadorOtro(r);
    const l = mapa.get(k);
    if (l) l.push(r);
    else mapa.set(k, [r]);
  }
  const grupos: GrupoEmpleadorOtro<T>[] = [];
  for (const [clave, lista] of mapa) {
    const ordenada = [...lista].sort((a, b) => numeroIndicador(a) - numeroIndicador(b));
    const base = ordenada[0];
    grupos.push({
      clave,
      nombre: textoManual(base['Empleador']),
      temporadas: textoManual(base['Temporadas teatrales']),
      ambito: textoManual(base['Ámbito']),
      registros: ordenada,
    });
  }
  const cmp = (a: string, b: string) => a.localeCompare(b, 'es', { numeric: true });
  return grupos.sort((a, b) => cmp(a.nombre, b.nombre) || cmp(a.temporadas, b.temporadas) || cmp(a.ambito, b.ambito));
}

/** Primer error de un empleador «otro», o null si está completo. «desconocido» es un valor válido. */
export function validarEmpleadorOtro(d: Registro): { campo: string; mensaje: string } | null {
  if (textoManual(d['Empleador']) === '') return { campo: 'Empleador', mensaje: 'Debe escribir el nombre del empleador.' };
  if (textoManual(d['Temporadas teatrales']) === '') return { campo: 'Temporadas teatrales', mensaje: 'Debe escribir las temporadas teatrales.' };
  if (textoManual(d['Ámbito']) === '') return { campo: 'Ámbito', mensaje: 'Debe escribir el ámbito; si no se conoce, escriba «desconocido».' };
  return null;
}
