import { useSyncExternalStore } from 'react';
import { afterEach, vi } from 'vitest';

// Router falso con estado: `navigate` actualiza la URL simulada y avisa a quien la lea, como el
// router real. Las páginas derivan su selección de la URL, de modo que un navigate que no cambia
// nada (el de un mock estático) ya no reproduce la navegación.
const pathname = '/x';
let search = '';
const oyentes = new Set<() => void>();
let ubicacionActual = { pathname, search, hash: '', state: null as unknown };

function fijarBusqueda(nueva: string): void {
  if (nueva === search) return;
  search = nueva;
  ubicacionActual = { pathname, search, hash: '', state: null };
  oyentes.forEach(f => f());
}

/** `ubicacion.search = '?q=x'` fija la URL simulada antes de montar la página. */
export const ubicacion = {
  get search(): string { return search; },
  set search(valor: string) { fijarBusqueda(valor); },
};

/** Espía de `navigate`: además de registrar la llamada, actualiza la URL simulada. */
export const navegar = vi.fn((destino: string | number, _opciones?: { replace?: boolean }) => {
  if (typeof destino !== 'string') return;
  const sinHash = destino.split('#')[0];
  const i = sinHash.indexOf('?');
  fijarBusqueda(i < 0 ? '' : sinHash.slice(i));
});

function suscribir(f: () => void): () => void {
  oyentes.add(f);
  return () => { oyentes.delete(f); };
}

export const routerFalso = {
  useNavigate: () => navegar,
  useLocation: () => useSyncExternalStore(suscribir, () => ubicacionActual),
};

afterEach(() => {
  fijarBusqueda('');
  navegar.mockClear();
});
