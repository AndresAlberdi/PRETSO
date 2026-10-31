// Validación de la sigla de una compañía: formato, duplicado exacto (bloquea) y
// parecido por partes (solo avisa). Funciones puras, sin acceso a Firestore.
import { normalizarSigla } from './referenciaCompania';

export interface CompaniaSigla {
  id: string;
  'Sigla Compañía'?: unknown;
}

export type TipoParecido = 'contenida' | 'contiene' | 'reordenada';

export interface ParecidoSigla {
  id: string;
  sigla: string;
  tipo: TipoParecido;
}

export type ResultadoSigla =
  | { estado: 'ok' }
  | { estado: 'error'; motivo: 'formato'; mensaje: string }
  | { estado: 'error'; motivo: 'duplicada'; mensaje: string; conflicto: { id: string; sigla: string } }
  | { estado: 'aviso'; parecidos: ParecidoSigla[] };

export const TITULO_AVISO_SIGLA = 'Sigla parecida a otra existente';
export const CIERRE_AVISO_SIGLA = '¿Desea guardarla de todos modos?';
export const MENSAJE_VERIFICACION_SIGLA = 'No se pudo verificar si la sigla ya existe; no se guardó. Intente de nuevo.';

/** Texto de la sigla en forma canónica de Unicode y sin espacios en los extremos. */
export function prepararSigla(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  return String(valor).normalize('NFC').trim();
}

/** Partes de la sigla, sin tildes ni mayúsculas, separadas por guion. */
export function partesSigla(valor: unknown): string[] {
  return normalizarSigla(prepararSigla(valor))
    .split('-')
    .map(p => p.trim())
    .filter(Boolean);
}

/** Clave de comparación: las partes unidas por un guion. */
export function claveSigla(valor: unknown): string {
  return partesSigla(valor).join('-');
}

/** Mensaje de error de formato, o null si el formato es válido. */
export function errorFormatoSigla(valor: unknown): string | null {
  const s = prepararSigla(valor);
  if (s === '') return 'Debe ingresar la sigla de la compañía.';
  if (/\s/u.test(s)) return 'La sigla no puede contener espacios; una las partes con un guion (por ejemplo, GA-JR).';
  if (s.startsWith('-') || s.endsWith('-')) return 'La sigla no puede empezar ni terminar con un guion.';
  if (s.includes('--')) return 'Una las partes de la sigla con un solo guion, no con varios seguidos.';
  if (!/^[\p{L}\p{Nd}]+(?:-[\p{L}\p{Nd}]+)*$/u.test(s)) {
    return 'La sigla solo admite letras y números, con las partes unidas por un guion (por ejemplo, GA-JR).';
  }
  return null;
}

// Cuenta las apariciones de cada parte.
function contar(partes: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const p of partes) m.set(p, (m.get(p) ?? 0) + 1);
  return m;
}

// ¿Todas las partes de `a` están en `b` (con multiplicidad)?
function incluida(a: Map<string, number>, b: Map<string, number>): boolean {
  for (const [parte, n] of a) if ((b.get(parte) ?? 0) < n) return false;
  return true;
}

/**
 * Evalúa una sigla frente a las de las demás compañías. `idPropio` excluye a la
 * compañía que se está editando. El duplicado exacto tiene prioridad y bloquea;
 * el parecido por partes solo avisa.
 */
export function evaluarSigla(valor: unknown, companias: CompaniaSigla[], idPropio?: string | null): ResultadoSigla {
  const fmt = errorFormatoSigla(valor);
  if (fmt) return { estado: 'error', motivo: 'formato', mensaje: fmt };

  const p = partesSigla(valor);
  const clave = p.join('-');
  const otras = companias
    .filter(c => c.id !== idPropio)
    .map(c => {
      const sigla = String(c['Sigla Compañía'] ?? '').trim();
      return { id: c.id, sigla, partes: partesSigla(sigla) };
    })
    .filter(c => c.partes.length > 0);

  const igual = otras.find(c => c.partes.join('-') === clave);
  if (igual) {
    return {
      estado: 'error',
      motivo: 'duplicada',
      mensaje: `Ya existe una compañía con la sigla «${igual.sigla}». Use una sigla distinta.`,
      conflicto: { id: igual.id, sigla: igual.sigla },
    };
  }

  const mias = contar(p);
  const parecidos: ParecidoSigla[] = [];
  for (const c of otras) {
    const suyas = contar(c.partes);
    const miaEnSuya = incluida(mias, suyas);
    const suyaEnMia = incluida(suyas, mias);
    if (miaEnSuya && suyaEnMia) parecidos.push({ id: c.id, sigla: c.sigla, tipo: 'reordenada' });
    else if (miaEnSuya) parecidos.push({ id: c.id, sigla: c.sigla, tipo: 'contenida' });
    else if (suyaEnMia) parecidos.push({ id: c.id, sigla: c.sigla, tipo: 'contiene' });
  }
  if (parecidos.length === 0) return { estado: 'ok' };
  parecidos.sort((a, b) => a.sigla.localeCompare(b.sigla, 'es') || a.id.localeCompare(b.id));
  return { estado: 'aviso', parecidos };
}

/** Línea descriptiva de un parecido, para el aviso. */
export function lineaParecido(p: ParecidoSigla): string {
  if (p.tipo === 'contenida') return `Está contenida en «${p.sigla}».`;
  if (p.tipo === 'contiene') return `Contiene a «${p.sigla}».`;
  return `Tiene las mismas partes que «${p.sigla}», en otro orden.`;
}

/** Frase introductoria del aviso, en singular o plural. */
export function introAvisoSigla(sigla: string, cantidad: number): string {
  return cantidad > 1
    ? `La sigla «${sigla}» se parece a la de otras compañías ya registradas:`
    : `La sigla «${sigla}» se parece a la de otra compañía ya registrada:`;
}
