import { useState } from 'react';
import { PIE } from '../legal/textosLegales';
import ReadmeModal from './ReadmeModal';

// Recuadro que redacta Laura (vacío hasta entonces) y, debajo, el enlace al README de la plataforma.
export default function ExplicacionPortada() {
  const [readmeAbierto, setReadmeAbierto] = useState(false);
  return (
    <div className="portada-explicacion">
      <section className="pie-explicacion" aria-label="Sobre PRETSO">{PIE.explicacion}</section>
      <button type="button" className="pie-readme" aria-haspopup="dialog" onClick={() => setReadmeAbierto(true)}>
        Más sobre la plataforma (README.md)
      </button>
      {readmeAbierto && <ReadmeModal onClose={() => setReadmeAbierto(false)} />}
    </div>
  );
}
