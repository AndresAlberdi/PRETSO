import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router';
import { useAdmin } from '../context/AdminContext';

// Apaga el modo edición al cambiar de ruta.
export default function EditModeRouteReset() {
  const { pathname } = useLocation();
  const { setIsEditMode } = useAdmin();
  const rutaAnterior = useRef<string | null>(null);
  useEffect(() => {
    if (rutaAnterior.current !== null && rutaAnterior.current !== pathname) {
      setIsEditMode(false);
    }
    rutaAnterior.current = pathname;
  }, [pathname, setIsEditMode]);
  return null;
}
