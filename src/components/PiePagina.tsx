import { useState } from 'react';
import { Link, useLocation } from 'react-router';
import { PIE } from '../legal/textosLegales';
import ReadmeModal from './ReadmeModal';

const ENLACES = [
  { to: '/aviso-legal', texto: 'Aviso legal' },
  { to: '/privacidad', texto: 'Privacidad' },
  { to: '/cookies', texto: 'Cookies' },
  { to: '/accesibilidad', texto: 'Accesibilidad' },
  { to: '/creditos', texto: 'Créditos' },
] as const;

function EnlacesLegales() {
  return (
    <nav aria-label="Información legal">
      <ul>
        {ENLACES.map(({ to, texto }) => (
          <li key={to}>
            {to === '/accesibilidad' && PIE.urlDeclaracionAgid ? (
              <a href={PIE.urlDeclaracionAgid} target="_blank" rel="noopener noreferrer">{texto}</a>
            ) : (
              <Link to={to}>{texto}</Link>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}

// Pie de página. Es el único landmark contentinfo de la vista. La titularidad, la financiación, el recuadro
// explicativo y el README solo aparecen en la portada; en las demás páginas queda la franja de enlaces legales.
export function PiePagina() {
  const portada = useLocation().pathname === '/';
  const [readmeAbierto, setReadmeAbierto] = useState(false);
  if (!portada) {
    return (
      <footer className="pie-pagina">
        <EnlacesLegales />
      </footer>
    );
  }
  return (
    <footer className="pie-pagina pie-portada">
      <div className="pie-textos">
        <p>{PIE.titularidad}</p>
        <p>{PIE.financiacion}</p>
      </div>
      <div className="pie-fila">
        <div className="pie-izquierda">
          <section className="pie-explicacion" aria-label="Sobre PRETSO">{PIE.explicacion}</section>
          <button type="button" className="pie-readme" aria-haspopup="dialog" onClick={() => setReadmeAbierto(true)}>
            Más sobre la plataforma (README.md)
          </button>
        </div>
        <div className="pie-derecha">
          <EnlacesLegales />
        </div>
      </div>
      {readmeAbierto && <ReadmeModal onClose={() => setReadmeAbierto(false)} />}
    </footer>
  );
}

export default PiePagina;
