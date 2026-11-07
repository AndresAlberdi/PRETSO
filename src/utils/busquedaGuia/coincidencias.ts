import { normalizarTexto } from '../filtrarRegistros';
import { esConsultaAnio, rangosQueContienen } from './anios';
import { validarTermino } from './termino';

/** Fragmento de un texto: `coincide` indica que debe resaltarse. */
export interface Tramo {
  texto: string;
  coincide: boolean;
}

export interface TextoNormalizado {
  /** Texto normalizado (sin tildes, minúsculas, espacios colapsados y recortados). */
  normal: string;
  /** Para cada carácter normalizado, posición inicial en el original. */
  inicio: number[];
  /** Para cada carácter normalizado, posición final (exclusiva) en el original. */
  fin: number[];
}

/**
 * Normaliza igual que `normalizarTexto` y conserva la correspondencia de cada
 * carácter normalizado con su posición en el texto original.
 */
export function normalizarConMapa(texto: string): TextoNormalizado {
  let normal = '';
  const inicio: number[] = [];
  const fin: number[] = [];
  let pendiente = -1; // inicio de un espacio en espera de emitirse
  let finPendiente = 0;
  let i = 0;
  for (const ch of texto) {
    const largo = ch.length;
    if (/\s/u.test(ch)) {
      if (normal !== '') {
        if (pendiente === -1) pendiente = i;
        finPendiente = i + largo;
      }
    } else {
      const pieza = normalizarTexto(ch);
      if (pieza === '') {
        // Marca combinante suelta (texto NFD): pertenece al carácter anterior.
        if (pendiente === -1 && fin.length > 0) fin[fin.length - 1] = i + largo;
      } else {
        if (pendiente !== -1) {
          normal += ' ';
          inicio.push(pendiente);
          fin.push(finPendiente);
          pendiente = -1;
        }
        for (const c of pieza) {
          normal += c;
          for (let k = 0; k < c.length; k++) {
            inicio.push(i);
            fin.push(i + largo);
          }
        }
      }
    }
    i += largo;
  }
  return { normal, inicio, fin };
}

export interface OpcionesBusqueda {
  /** El campo es de años: una consulta de cuatro dígitos coincide con rangos. */
  anio?: boolean;
}

/**
 * Tramos de `texto` con las coincidencias de `termino` (frase literal
 * normalizada, P4). Si no hay coincidencia devuelve `[]`; si la hay, devuelve
 * el texto completo dividido en tramos contiguos. En campos de año con una
 * consulta de cuatro dígitos se resalta el rango completo que contiene el año.
 */
export function buscarTramos(texto: unknown, termino: string, opciones: OpcionesBusqueda = {}): Tramo[] {
  if (texto === null || texto === undefined) return [];
  const valido = validarTermino(termino);
  if (!valido.ok) return [];
  return buscarTramosPreparado(String(texto), undefined, valido.termino, opciones.anio === true);
}

/**
 * ¿Coincide la consulta ya validada y normalizada? Es la pregunta barata (sin
 * tramos ni mapas) para los niveles 1 y 2. `normal` es el texto ya normalizado.
 */
export function coincideNormalizado(texto: string, normal: string, consulta: string, anio: boolean): boolean {
  if (anio && esConsultaAnio(consulta)) return rangosQueContienen(texto, Number(consulta)).length > 0;
  return normal.includes(consulta);
}

/**
 * Tramos con una consulta ya validada y normalizada. Si se da `normal` (texto
 * normalizado precalculado), el mapa solo se construye cuando hay coincidencia.
 */
export function buscarTramosPreparado(
  original: string,
  normal: string | undefined,
  consulta: string,
  anio: boolean,
): Tramo[] {
  if (original === '') return [];
  const intervalos: Array<[number, number]> = [];
  if (anio && esConsultaAnio(consulta)) {
    for (const r of rangosQueContienen(original, Number(consulta))) intervalos.push([r.inicio, r.fin]);
  } else {
    if (normal !== undefined && !normal.includes(consulta)) return [];
    const mapa = normalizarConMapa(original);
    let desde = 0;
    for (;;) {
      const pos = mapa.normal.indexOf(consulta, desde);
      if (pos === -1) break;
      intervalos.push([mapa.inicio[pos], mapa.fin[pos + consulta.length - 1]]);
      desde = pos + consulta.length;
    }
  }
  return construirTramos(original, intervalos);
}

function construirTramos(original: string, intervalos: Array<[number, number]>): Tramo[] {
  if (intervalos.length === 0) return [];
  intervalos.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const unidos: Array<[number, number]> = [];
  for (const [a, b] of intervalos) {
    const ultimo = unidos[unidos.length - 1];
    if (ultimo && a <= ultimo[1]) ultimo[1] = Math.max(ultimo[1], b);
    else unidos.push([a, b]);
  }
  const tramos: Tramo[] = [];
  let cursor = 0;
  for (const [a, b] of unidos) {
    if (a > cursor) tramos.push({ texto: original.slice(cursor, a), coincide: false });
    tramos.push({ texto: original.slice(a, b), coincide: true });
    cursor = b;
  }
  if (cursor < original.length) tramos.push({ texto: original.slice(cursor), coincide: false });
  return tramos;
}
