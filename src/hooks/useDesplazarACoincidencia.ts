import { useEffect } from 'react';

/** Raíz de las páginas; los modales usan `RAIZ_MODAL` porque se montan fuera de `#contenido`. */
export const RAIZ_PAGINA = '#contenido';
export const RAIZ_MODAL = '[aria-modal="true"]';

/**
 * Cuando `clave` cambia y no es nula, desplaza la vista a la primera
 * coincidencia dentro de `raiz`. No mueve el foco.
 */
export function useDesplazarACoincidencia(clave: string | null, raiz: string = RAIZ_PAGINA): void {
  useEffect(() => {
    if (clave === null) return;
    const primera = document
      .querySelector(raiz)
      ?.querySelector('mark.coincidencia, .boton-con-coincidencia, .fila-con-coincidencia');
    if (primera && typeof primera.scrollIntoView === 'function') primera.scrollIntoView({ block: 'center' });
  }, [clave, raiz]);
}
