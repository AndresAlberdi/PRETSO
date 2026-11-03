/**
 * Reconocimiento de años en los campos marcados como `anio` (formatos reales
 * verificados el 03/11/2026, sección B0 del plan):
 *  - número solo (Año de Caja, Remuneraciones y Corpus; casi todo «Años»);
 *  - «De AAAA a AAAA», «de AAAA (mes) a AAAA (mes)», con espacios múltiples;
 *  - «Activa en AAAA [desconocemos el intervalo de tiempo]» (año único);
 *  - «de la década de AAAA a AAAA» (el extremo inferior es la década completa).
 * No se soportan formas abreviadas como «1580-81» o «1580/81»: no existen en los datos.
 */

export interface RangoAnio {
  desde: number;
  hasta: number;
  /** Posición inicial en el texto original. */
  inicio: number;
  /** Posición final (exclusiva) en el texto original. */
  fin: number;
}

/** Amplitud máxima admitida para un rango (hasta - desde). */
export const AMPLITUD_MAXIMA = 100;

const MES = String.raw`(?:\s*\([^)]*\))?`;
const PATRON = new RegExp(
  [
    String.raw`de\s+la\s+d[eé]cada\s+de\s+(?<dd>\d{4})${MES}\s+a\s+(?<dh>\d{4})${MES}`,
    String.raw`\bde\s+(?<rd>\d{4})${MES}\s+a\s+(?<rh>\d{4})${MES}`,
    String.raw`\bactiva\s+en\s+(?<ua>\d{4})\b`,
    String.raw`^\s*(?<nu>\d{4})(?:\.0+)?\s*$`,
  ].join('|'),
  'gi',
);

/** ¿La consulta es exactamente un año de cuatro dígitos? */
export function esConsultaAnio(termino: string): boolean {
  return /^\d{4}$/.test(termino.trim());
}

/**
 * Rangos de años presentes en un texto. Un rango invertido (hasta < desde) o de
 * amplitud mayor que 100 no se toma como rango: solo cuentan sus dos extremos
 * como años exactos.
 */
export function rangosDeAnios(texto: unknown): RangoAnio[] {
  if (texto === null || texto === undefined) return [];
  const s = String(texto);
  const salida: RangoAnio[] = [];
  for (const m of s.matchAll(PATRON)) {
    const g = m.groups ?? {};
    const inicio = m.index ?? 0;
    const fin = inicio + m[0].length;
    if (g.dd !== undefined) {
      const desde = Math.floor(Number(g.dd) / 10) * 10;
      const hasta = Math.max(Number(g.dh), desde + 9);
      agregarRango(salida, desde, hasta, inicio, fin);
    } else if (g.rd !== undefined) {
      agregarRango(salida, Number(g.rd), Number(g.rh), inicio, fin);
    } else {
      const anio = Number(g.ua ?? g.nu);
      salida.push({ desde: anio, hasta: anio, inicio, fin });
    }
  }
  return salida;
}

function agregarRango(salida: RangoAnio[], desde: number, hasta: number, inicio: number, fin: number): void {
  if (hasta >= desde && hasta - desde <= AMPLITUD_MAXIMA) {
    salida.push({ desde, hasta, inicio, fin });
    return;
  }
  salida.push({ desde, hasta: desde, inicio, fin });
  salida.push({ desde: hasta, hasta, inicio, fin });
}

/** Rangos del texto que contienen el año consultado (extremos e intermedios, P1). */
export function rangosQueContienen(texto: unknown, anio: number): RangoAnio[] {
  return rangosDeAnios(texto).filter(r => anio >= r.desde && anio <= r.hasta);
}
