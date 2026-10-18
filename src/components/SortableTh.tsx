import type { CSSProperties } from 'react';

export interface SortConfigLike {
  key: PropertyKey;
  direction: 'asc' | 'desc';
}

interface SortableThProps<K extends PropertyKey> {
  label: string;
  sortKey: K;
  sortConfig: SortConfigLike | null;
  onSort: (key: K) => void;
  style?: CSSProperties;
}

// Encabezado de columna ordenable: un botón nativo dentro del <th> (operable con teclado, WCAG 2.1.1)
// y aria-sort solo en la columna activa (WCAG 4.1.2). El nombre accesible es la etiqueta visible.
export default function SortableTh<K extends PropertyKey>({ label, sortKey, sortConfig, onSort, style }: SortableThProps<K>) {
  const activo = sortConfig !== null && sortConfig.key === sortKey;
  const ariaSort = activo ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending') : undefined;

  return (
    <th scope="col" aria-sort={ariaSort} style={style}>
      <button type="button" className="sort-header-button" onClick={() => onSort(sortKey)}>
        {label}
        <SortIndicator activo={activo} direction={sortConfig?.direction} />
      </button>
    </th>
  );
}

function SortIndicator({ activo, direction }: { activo: boolean; direction?: 'asc' | 'desc' }) {
  if (!activo) return null;
  return <span aria-hidden="true">{direction === 'asc' ? ' ▲' : ' ▼'}</span>;
}
