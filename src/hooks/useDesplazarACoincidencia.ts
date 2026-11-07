import { useEffect, useRef } from 'react';

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
  // `raiz` se guarda en una referencia: una función nueva en cada render no debe repetir el desplazamiento.
  // Se actualiza en un efecto declarado antes, para que el de la clave lea siempre la raíz vigente.
  const raizRef = useRef(raiz);
  useEffect(() => {
    raizRef.current = raiz;
  }, [raiz]);
  useEffect(() => {
    if (clave === null) return;
    const actual = raizRef.current;
    const contenedor = typeof actual === 'string' ? document.querySelector(actual) : actual();
    const primera = contenedor?.querySelector('mark.coincidencia, .boton-con-coincidencia, .fila-con-coincidencia');
    if (primera && typeof primera.scrollIntoView === 'function') primera.scrollIntoView({ block: 'center' });
  }, [clave]);
}
