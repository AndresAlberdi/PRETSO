import { Fragment } from 'react';
import type { JSX } from 'react';
import { buscarTramos } from '../utils/busquedaGuia/coincidencias';

export const CLASE_BOTON_COINCIDENCIA = 'boton-con-coincidencia';
export const CLASE_FILA_COINCIDENCIA = 'fila-con-coincidencia';

interface ResaltadoProps {
  texto: string | number | null | undefined;
  termino: string | null;
  /** Campo de años: una consulta de cuatro cifras marca el rango completo. */
  anio?: boolean;
}

/**
 * Muestra `texto` con las apariciones de `termino` en nodos `<mark>` de React
 * (nunca innerHTML). Recalcula los tramos sobre el texto visible.
 */
export function Resaltado({ texto, termino, anio }: ResaltadoProps): JSX.Element {
  // Solo texto y números; booleanos y demás valores no producen salida (igual que React).
  if (typeof texto !== 'string' && typeof texto !== 'number') return <></>;
  if (texto === '') return <></>;
  const plano = String(texto);
  if (!termino) return <>{plano}</>;
  const tramos = buscarTramos(plano, termino, { anio });
  if (tramos.length === 0) return <>{plano}</>;
  return (
    <>
      {tramos.map((t, i) => (
        <Fragment key={i}>
          {t.coincide ? <mark className="coincidencia">{t.texto}</mark> : t.texto}
        </Fragment>
      ))}
    </>
  );
}

/** Aviso para lectores de pantalla en un botón que lleva a una coincidencia. */
export function TextoCoincidencia({ crudo }: { crudo: string }): JSX.Element {
  return <span className="visually-hidden"> (contiene «{crudo}»)</span>;
}
