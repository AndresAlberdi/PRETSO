import { useCallback, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { LONGITUD_MAXIMA_TERMINO, validarTermino } from '../utils/busquedaGuia/termino';

export { LONGITUD_MAXIMA_TERMINO };

/** Parámetros de URL que identifican la unidad abierta (nivel 3) de cada sección. */
export const PARAMETROS_UNIDAD = ['compania', 'ciudad', 'anio', 'categoria'] as const;

export interface EstadoTermino {
  /** `?q=` recortado (trim, máximo 100); '' si no hay. */
  crudo: string;
  /** Término normalizado si es válido; null en caso contrario. */
  termino: string | null;
  /** Fija `q`, borra los parámetros de unidad y conserva el resto (replace). */
  fijar: (texto: string) => void;
  /** Borra `q` y conserva el resto (replace). */
  quitar: () => void;
}

function leerCrudo(search: string): string {
  return (new URLSearchParams(search).get('q') ?? '').trim().slice(0, LONGITUD_MAXIMA_TERMINO).trim();
}

/**
 * Término de búsqueda de la URL (`?q=`). Se construye sobre `useLocation` y
 * `useNavigate` (no `useSearchParams`). Guarda una copia local que se actualiza
 * al enviar y se resincroniza cuando cambia `location.search`.
 */
export function useTerminoBusqueda(): EstadoTermino {
  const location = useLocation();
  const navigate = useNavigate();
  const search = location.search ?? '';
  const desdeUrl = leerCrudo(search);
  // Copia local válida solo mientras la URL no cambie: se deriva en render, sin efecto.
  const [local, setLocal] = useState<{ search: string; crudo: string } | null>(null);
  const crudo = local !== null && local.search === search ? local.crudo : desdeUrl;

  const fijar = useCallback((texto: string) => {
    const recortado = texto.trim().slice(0, LONGITUD_MAXIMA_TERMINO).trim();
    const params = new URLSearchParams(search);
    params.set('q', recortado);
    for (const p of PARAMETROS_UNIDAD) params.delete(p);
    setLocal({ search, crudo: recortado });
    navigate(`${location.pathname}?${params.toString()}${location.hash ?? ''}`, { replace: true });
  }, [search, location.pathname, location.hash, navigate]);

  const quitar = useCallback(() => {
    const params = new URLSearchParams(search);
    params.delete('q');
    const resto = params.toString();
    setLocal({ search, crudo: '' });
    navigate(`${location.pathname}${resto ? `?${resto}` : ''}${location.hash ?? ''}`, { replace: true });
  }, [search, location.pathname, location.hash, navigate]);

  const termino = useMemo(() => {
    const v = validarTermino(crudo);
    return v.ok ? v.termino : null;
  }, [crudo]);

  return { crudo, termino, fijar, quitar };
}

/** Navegación dentro de la sección que conserva `q`. */
export function useNavegacionGuia(): {
  parametros: URLSearchParams;
  irA: (cambios: Record<string, string | null>, opciones?: { reemplazar?: boolean }) => void;
} {
  const location = useLocation();
  const navigate = useNavigate();
  const search = location.search ?? '';
  const parametros = useMemo(() => new URLSearchParams(search), [search]);

  const irA = useCallback((cambios: Record<string, string | null>, opciones: { reemplazar?: boolean } = {}) => {
    const params = new URLSearchParams(search);
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor === null) params.delete(clave);
      else params.set(clave, valor);
    }
    const texto = params.toString();
    navigate(`${location.pathname}${texto ? `?${texto}` : ''}${location.hash ?? ''}`, { replace: opciones.reemplazar === true });
  }, [search, location.pathname, location.hash, navigate]);

  return { parametros, irA };
}
