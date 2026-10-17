import type { SearchFilter } from '../components/SearchBar';

/**
 * Normalización de texto para comparar. Es el ÚNICO lugar donde se decide
 * cómo se comparan las cadenas: hoy ignora mayúsculas/minúsculas y tildes
 * («Garcia» encuentra «García»). Si se decide conservar las tildes, basta
 * con quitar la línea de eliminación de marcas diacríticas.
 */
export function normalizarTexto(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  return String(valor)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export type ModoBusqueda = 'contiene' | 'exacto';
export type ConfigCategoria = { campos: string[]; modo?: ModoBusqueda };

const PREFIJO_IDENTIFICADOR = /^(?:doc|nro|n°)\.?\s*/;
const NUMERO = /^-?\d+(?:\.\d+)?$/;

/** Igualdad exacta ya normalizada; «7» y «7.0» son iguales si ambos son numéricos. */
function coincideExacto(valor: string, q: string): boolean {
  if (q === '') return false;
  if (valor === q) return true;
  return NUMERO.test(valor) && NUMERO.test(q) && Number(valor) === Number(q);
}

/**
 * Filtra registros en memoria. Los filtros son acumulables (AND): un registro
 * se conserva solo si cumple todos. Cada categoría de filtro se asocia a la
 * configuración de búsqueda: una lista de campos (modo «contiene») o
 * `{ campos, modo }`. En modo «exacto» se exige igualdad tras normalizar y se
 * admite el prefijo «Doc», «Doc.», «Nro.» o «N°» delante del número.
 * Basta que un campo coincida.
 * Sin filtros devuelve todos los registros. Una categoría desconocida no
 * encuentra nada.
 */
export function filtrarRegistros<T extends Record<string, any>>(
  registros: T[],
  filtros: SearchFilter[],
  camposPorCategoria: Record<string, string[] | ConfigCategoria>
): T[] {
  if (filtros.length === 0) return registros;
  const consultas = filtros.map(f => {
    const cfg = camposPorCategoria[f.category];
    const campos = Array.isArray(cfg) ? cfg : (cfg?.campos ?? []);
    const exacto = !Array.isArray(cfg) && cfg?.modo === 'exacto';
    const base = normalizarTexto(f.query);
    return { campos, exacto, q: exacto ? base.replace(PREFIJO_IDENTIFICADOR, '').trim() : base };
  });
  return registros.filter(r =>
    consultas.every(({ campos, exacto, q }) =>
      campos.some(campo => {
        const v = normalizarTexto(r[campo]);
        return exacto ? coincideExacto(v, q) : v.includes(q);
      })
    )
  );
}
