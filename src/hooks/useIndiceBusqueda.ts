import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { cargarIndice, suscribirIndice, versionIndice } from '../utils/busquedaGuia/cargaIndice';
import { buscarEnIndice } from '../utils/busquedaGuia/indiceBusqueda';
import type { IndiceBusqueda, ResultadoRegistro } from '../utils/busquedaGuia/indiceBusqueda';
import type { UnidadBusqueda } from '../utils/busquedaGuia/mapaSecciones';

export type EstadoCarga = 'inactivo' | 'cargando' | 'listo' | 'error';

/** Carga el índice compartido solo cuando `activo`; se recarga si se invalida. */
export function useIndiceBusqueda(activo: boolean): { estado: EstadoCarga; indice: IndiceBusqueda | null } {
  const version = useSyncExternalStore(suscribirIndice, versionIndice);
  const [resultado, setResultado] = useState<{ clave: number; indice: IndiceBusqueda | null; error: boolean } | null>(null);

  useEffect(() => {
    if (!activo) return;
    let vigente = true;
    cargarIndice().then(
      indice => { if (vigente) setResultado({ clave: version, indice, error: false }); },
      () => { if (vigente) setResultado({ clave: version, indice: null, error: true }); },
    );
    return () => { vigente = false; };
  }, [activo, version]);

  if (!activo) return { estado: 'inactivo', indice: null };
  if (!resultado || resultado.clave !== version) return { estado: 'cargando', indice: null };
  if (resultado.error) return { estado: 'error', indice: null };
  return { estado: 'listo', indice: resultado.indice };
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
