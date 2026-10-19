import { useEffect, useLayoutEffect, useRef } from 'react';

/**
 * Devuelve el foco a `#contenido` cuando la vista cambia y el control que lo
 * tenía desapareció del documento (WCAG 2.4.3, orden del foco).
 *
 * Patrón: si la acción conserva un control equivalente, el foco va a ese
 * control; si el control activado desaparece, va a `#contenido` (igual que
 * RouteEffects y Modal). Solo actúa si el último elemento enfocado quedó
 * desconectado, de modo que no roba el foco en la carga inicial ni cuando otro
 * componente ya lo movió.
 */
export function useRestoreFocusOnViewChange(view: string): void {
  const lastFocused = useRef<Element | null>(null);
  const previousView = useRef(view);

  useEffect(() => {
    const onFocus = (e: Event) => {
      lastFocused.current = e.target instanceof Element ? e.target : null;
    };
    document.addEventListener('focus', onFocus, true);
    return () => document.removeEventListener('focus', onFocus, true);
  }, []);

  useLayoutEffect(() => {
    if (previousView.current === view) return;
    previousView.current = view;
    const last = lastFocused.current;
    const active = document.activeElement;
    if (last && !last.isConnected && (active === null || active === document.body)) {
      document.getElementById('contenido')?.focus({ preventScroll: true });
    }
    // No retener el subárbol desconectado.
    lastFocused.current = null;
  }, [view]);
}
