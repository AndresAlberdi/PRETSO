import { useState } from 'react';
import { PIE } from '../legal/textosLegales';
import ReadmeModal from './ReadmeModal';

// Recuadro de la explicación de la portada y, solo con sesión iniciada, el enlace al README de la plataforma.
export default function ExplicacionPortada({ conReadme = false }: { conReadme?: boolean }) {
  const [readmeAbierto, setReadmeAbierto] = useState(false);
  return (
    <div className="portada-explicacion">
      <section className="pie-explicacion" aria-label="Sobre PRETSO">{PIE.explicacion.split('\n\n').filter(Boolean).map((t) => <p key={t}>{t}</p>)}</section>
      {conReadme && (
        <button type="button" className="pie-readme" aria-haspopup="dialog" onClick={() => setReadmeAbierto(true)}>
          Más sobre la plataforma (README.md)
        </button>
      )}
      {conReadme && readmeAbierto && <ReadmeModal onClose={() => setReadmeAbierto(false)} />}
    </div>
  );
}
