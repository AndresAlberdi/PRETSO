import { Link, useLocation } from 'react-router';
import { PIE } from '../legal/textosLegales';

const ENLACES = [
  { to: '/aviso-legal', texto: 'Aviso legal' },
  { to: '/privacidad', texto: 'Privacidad' },
  { to: '/cookies', texto: 'Cookies' },
  { to: '/accesibilidad', texto: 'Accesibilidad' },
  { to: '/creditos', texto: 'Créditos' },
] as const;

// Pie de página con titularidad, financiación y enlaces legales. Aparece solo en la portada y es su único
// landmark contentinfo; en las demás páginas no se muestra.
export function PiePagina() {
  if (useLocation().pathname !== '/') return null;
  return (
    <footer className="pie-pagina">
      <p>{PIE.titularidad}</p>
      <p>{PIE.financiacion}</p>
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
    </footer>
  );
}

export default PiePagina;
