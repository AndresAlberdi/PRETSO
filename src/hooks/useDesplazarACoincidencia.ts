import { useEffect } from 'react';

/** Raíz de las páginas; los modales se montan fuera de `#contenido` y pasan su propia raíz. */
export const RAIZ_PAGINA = '#contenido';
export type RaizDesplazamiento = string | (() => Element | null);

/** Raíz del modal que contiene el elemento con ese id (válida con modales apilados). */
export function raizDeModal(idTitulo: string): () => Element | null {
  return () => document.getElementById(idTitulo)?.closest('[aria-modal="true"]') ?? null;
}

/**
 * Cuando `clave` cambia y no es nula, desplaza la vista a la primera
 * coincidencia dentro de `raiz` (selector o función). No mueve el foco.
 */
export function useDesplazarACoincidencia(clave: string | null, raiz: RaizDesplazamiento = RAIZ_PAGINA): void {
  useEffect(() => {
    if (clave === null) return;
    const contenedor = typeof raiz === 'string' ? document.querySelector(raiz) : raiz();
    const primera = contenedor?.querySelector('mark.coincidencia, .boton-con-coincidencia, .fila-con-coincidencia');
    if (primera && typeof primera.scrollIntoView === 'function') primera.scrollIntoView({ block: 'center' });
    // `raiz` se lee al cambiar la clave; una función nueva en cada render no debe repetir el desplazamiento.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);
}
