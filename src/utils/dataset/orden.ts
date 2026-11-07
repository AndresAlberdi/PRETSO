import type { Registro } from './tipos';

export const esRegistro = (v: unknown): v is Registro => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Orden estable por número; los valores no numéricos (NaN) van al final. */
export function ordenarPorNumero<T>(items: readonly T[], clave: (item: T) => number): T[] {
  return items
    .map((item, indice) => ({ item, indice, n: clave(item) }))
    .sort((a, b) => {
      const aNan = Number.isNaN(a.n);
      const bNan = Number.isNaN(b.n);
      if (aNan !== bNan) return aNan ? 1 : -1;
      if (!aNan && a.n !== b.n) return a.n - b.n;
      return a.indice - b.indice;
    })
    .map((x) => x.item);
}
