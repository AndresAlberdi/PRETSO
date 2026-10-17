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
    .toLowerCase();
}

/**
 * Filtra registros en memoria. Los filtros son acumulables (AND): un registro
 * se conserva solo si cumple todos. Cada categoría de filtro se asocia a la
 * lista de campos donde se busca (basta que uno contenga el texto).
 * Sin filtros devuelve todos los registros. Una categoría desconocida no
 * encuentra nada.
 */
export function filtrarRegistros<T extends Record<string, any>>(
  registros: T[],
  filtros: SearchFilter[],
  camposPorCategoria: Record<string, string[]>
): T[] {
  if (filtros.length === 0) return registros;
  const consultas = filtros.map(f => ({
    campos: camposPorCategoria[f.category] ?? [],
    q: normalizarTexto(f.query),
  }));
  return registros.filter(r =>
    consultas.every(({ campos, q }) =>
      campos.some(campo => normalizarTexto(r[campo]).includes(q))
    )
  );
}
