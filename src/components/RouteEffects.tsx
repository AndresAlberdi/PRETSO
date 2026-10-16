import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router';
import { pageTitle } from '../utils/pageTitle';

// Asigna el título del documento (2.4.2) y, al cambiar de ruta, lleva el foco al contenido (2.4.1/2.4.3).
// Se ignoran los cambios REPLACE (redirecciones de <Navigate>) para no robar el foco en la primera carga.
export default function RouteEffects() {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();
  const rutaAnterior = useRef<string | null>(null);
  useEffect(() => {
    document.title = pageTitle(pathname);
    if (rutaAnterior.current !== null && rutaAnterior.current !== pathname && navigationType !== 'REPLACE') {
      document.getElementById('contenido')?.focus({ preventScroll: true });
    }
    rutaAnterior.current = pathname;
  }, [pathname, navigationType]);
  return null;
}
