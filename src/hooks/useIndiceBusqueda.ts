import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { cargarIndice, suscribirIndice, versionIndice } from '../utils/busquedaGuia/cargaIndice';
import { buscarEnIndice } from '../utils/busquedaGuia/indiceBusqueda';
import type { IndiceBusqueda, ResultadoRegistro } from '../utils/busquedaGuia/indiceBusqueda';
import type { UnidadBusqueda } from '../utils/busquedaGuia/mapaSecciones';

export type EstadoCarga = 'inactivo' | 'cargando' | 'listo' | 'error';

interface ResultadoCarga {
  clave: string;
  indice: IndiceBusqueda | null;
  error: boolean;
}

/**
 * Carga el índice compartido solo cuando `activo`; se recarga si se invalida.
 * Mientras recarga tras una invalidación conserva el último índice: en estado
 * `cargando`, `indice` puede no ser nulo. Tras un error, `reintentar` vuelve a
 * cargar, y desactivar y reactivar el hook también reintenta.
 */
export function useIndiceBusqueda(activo: boolean): { estado: EstadoCarga; indice: IndiceBusqueda | null; reintentar: () => void } {
  const version = useSyncExternalStore(suscribirIndice, versionIndice);
  const [intento, setIntento] = useState(0);
  const [resultado, setResultado] = useState<ResultadoCarga | null>(null);
  const clave = `${version}.${intento}`;
  const reintentar = useCallback(() => setIntento(n => n + 1), []);

  // Al desactivarse, un error anterior se olvida para que reactivar vuelva a cargar.
  if (!activo && resultado?.error) setResultado({ ...resultado, error: false, indice: null, clave: '' });

  useEffect(() => {
    if (!activo) return;
    let vigente = true;
    cargarIndice().then(
      indice => { if (vigente) setResultado({ clave, indice, error: false }); },
      () => { if (vigente) setResultado(previo => ({ clave, indice: previo?.indice ?? null, error: true })); },
    );
    return () => { vigente = false; };
  }, [activo, clave]);

  if (!activo) return { estado: 'inactivo', indice: null, reintentar };
  if (!resultado || resultado.clave !== clave) return { estado: 'cargando', indice: resultado?.indice ?? null, reintentar };
  if (resultado.error) return { estado: 'error', indice: null, reintentar };
  return { estado: 'listo', indice: resultado.indice, reintentar };
}

const SIN_REGISTROS: ReadonlyMap<string, ResultadoRegistro> = new Map();
const SIN_UNIDADES: readonly UnidadBusqueda[] = [];

/** Coincidencias de una sección, correlacionadas por `String(registro.id)`. Sin término no lee nada. */
export function useCoincidenciasSeccion(coleccion: string, termino: string | null): {
  estado: EstadoCarga;
  porId: ReadonlyMap<string, ResultadoRegistro>;
  unidades: readonly UnidadBusqueda[];
} {
  const { estado, indice } = useIndiceBusqueda(termino !== null);
  return useMemo(() => {
    if (!indice || !termino) return { estado, porId: SIN_REGISTROS, unidades: SIN_UNIDADES };
    const seccion = buscarEnIndice(indice, termino, { colecciones: [coleccion], incluirAdmin: true })[0];
    if (!seccion) return { estado, porId: SIN_REGISTROS, unidades: SIN_UNIDADES };
    const porId = new Map<string, ResultadoRegistro>();
    for (const r of seccion.registros) porId.set(String(r.registro.id), r);
    return { estado, porId, unidades: seccion.unidades };
  }, [estado, indice, termino, coleccion]);
}
