import { useId, useRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import Modal from './Modal';
import readme from '../contenido/README.md?raw';

const overlayStyle: CSSProperties = {
  position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
};
const panelStyle: CSSProperties = {
  background: 'var(--bg-card)', color: 'var(--text-color)', padding: '1.5rem 2rem', borderRadius: '8px',
  maxWidth: '720px', width: '92%', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
};

/** Convierte el subconjunto de Markdown que usa el README (títulos, citas, listas, párrafos) en elementos React. */
export function renderizarReadme(texto: string, idTitulo?: string): ReactNode[] {
  const nodos: ReactNode[] = [];
  let items: string[] = [];
  const cerrarLista = () => {
    if (items.length) {
      nodos.push(<ul key={`ul-${nodos.length}`}>{items.map((t, i) => <li key={i}>{t}</li>)}</ul>);
      items = [];
    }
  };
  for (const linea of texto.split('\n')) {
    if (linea.startsWith('- ')) { items.push(linea.slice(2)); continue; }
    cerrarLista();
    const k = `n-${nodos.length}`;
    if (linea.startsWith('## ')) nodos.push(<h3 key={k}>{linea.slice(3)}</h3>);
    else if (linea.startsWith('# ')) nodos.push(<h2 key={k} id={idTitulo}>{linea.slice(2)}</h2>);
    else if (linea.startsWith('> ')) nodos.push(<blockquote key={k}>{linea.slice(2)}</blockquote>);
    else if (linea.trim()) nodos.push(<p key={k}>{linea}</p>);
  }
  cerrarLista();
  return nodos;
}

export function descargarReadme(): void {
  const url = URL.createObjectURL(new Blob([readme], { type: 'text/markdown;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'README.md';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function ReadmeModal({ onClose }: { onClose: () => void }) {
  const titulo = useId();
  const cerrar = useRef<HTMLButtonElement>(null);
  return (
    <Modal labelledBy={titulo} onEscape={onClose} initialFocus={cerrar} overlayStyle={overlayStyle} panelStyle={panelStyle}>
      <div className="readme-modal">
        {renderizarReadme(readme, titulo)}
        <div className="readme-acciones">
          <button type="button" className="boton boton-primario" onClick={descargarReadme}>Descargar README.md</button>
          <button type="button" ref={cerrar} className="boton boton-secundario" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </Modal>
  );
}
