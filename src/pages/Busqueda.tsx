import { useMemo } from "react";
import { Link } from "react-router";
import CampoBusqueda from "../components/CampoBusqueda";
import { useAdmin } from "../context/AdminContext";
import { useIndiceBusqueda } from "../hooks/useIndiceBusqueda";
import { useTerminoBusqueda } from "../hooks/useTerminoBusqueda";
import { SECCIONES } from "../utils/secciones";
import { contar } from "../utils/anuncios";
import { buscarEnIndice } from "../utils/busquedaGuia/indiceBusqueda";
import { enlaceSeccion } from "../utils/busquedaGuia/rutas";

const MENSAJE_ERROR = 'No se pudo cargar la base de datos para la búsqueda. Inténtelo de nuevo más tarde.';

const FLECHA = (
  <svg className="flecha-seccion" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
);

export default function Busqueda() {
  const { isAdmin } = useAdmin();
  const { crudo, termino, fijar, quitar } = useTerminoBusqueda();
  // Precarga al montar: el índice se comparte y se guarda en caché.
  const { estado, indice, reintentar } = useIndiceBusqueda(true);

  const resultados = useMemo(
    () => (termino && indice ? buscarEnIndice(indice, termino, { incluirAdmin: isAdmin }) : []),
    [termino, indice, isAdmin],
  );

  const buscando = termino !== null && estado !== 'error' && indice === null;
  const hayError = estado === 'error';
  const resuelto = termino !== null && !buscando && !hayError;

  const anuncio = !resuelto
    ? ''
    : resultados.length === 0
      ? 'Búsqueda sin resultados'
      : `Búsqueda: «${crudo}» aparece en ${contar(resultados.length, 'sección', 'secciones')}`;

  return (
    <div>
      <div style={{ textAlign: 'center', margin: '2rem 0' }}>
        <h1 className="titulo-busqueda">Búsqueda general</h1>

        <div style={{ display: 'inline-block', textAlign: 'left', minWidth: 'min(300px, 100%)', maxWidth: '600px', width: '100%' }}>
          <CampoBusqueda
            etiqueta="Buscar en la base de datos"
            valorInicial={crudo}
            onBuscar={fijar}
            onLimpiar={quitar}
          />
        </div>
      </div>

      <output aria-live="polite" className="visually-hidden">{anuncio}</output>

      {hayError && (
        <div>
          <p role="alert">{MENSAJE_ERROR}</p>
          <button type="button" onClick={reintentar}>Reintentar</button>
        </div>
      )}

      {buscando && <div style={{ textAlign: 'center', marginTop: '2rem' }}>Buscando en la base de datos...</div>}

      {resuelto && resultados.length === 0 && (
        <p style={{ marginTop: '2rem' }}>No se encontró «{crudo}» en ninguna sección.</p>
      )}

      {resuelto && resultados.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <h2>Secciones con «{crudo}»</h2>
          <ol className="lista-secciones">
            {resultados.map((r, i) => (
              <li key={r.coleccion}><Link to={enlaceSeccion(r.coleccion, crudo)} className="fila-seccion">
                <span className="numero-seccion">{i + 1}</span>
                <span className="nombre-seccion">{r.nombre} ({contar(r.registros.length, 'registro', 'registros')})</span>
                {FLECHA}
              </Link></li>
            ))}
          </ol>
        </div>
      )}

      {termino === null && !hayError && (
        <>
          <p className="rotulo-secciones">Secciones</p>
          <nav aria-label="Secciones de la base de datos">
            <ol className="lista-secciones">
              {SECCIONES.map((s, i) => (
                <li key={s.ruta}><Link to={s.ruta} className="fila-seccion">
                  <span className="numero-seccion">{i + 1}</span>
                  <span className="nombre-seccion">{s.nombre}</span>
                  {FLECHA}
                </Link></li>
              ))}
            </ol>
          </nav>
        </>
      )}
    </div>
  );
}
