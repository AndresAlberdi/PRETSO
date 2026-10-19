import { useId, useState } from 'react';

/**
 * Ayuda de sección: botón «?» que despliega un panel con la descripción.
 * - WCAG 1.4.13 (contenido al pasar el cursor o al enfocar): el contenido se muestra por acción
 *   explícita, se descarta con Escape y es persistente hasta que se cierra o se pierde el foco.
 * - WCAG 2.1.1 (teclado): se opera con clic, Enter y Espacio al ser un botón nativo.
 * - WCAG 4.1.2 (nombre, función, valor): nombre accesible por aria-label, estado por aria-expanded
 *   y relación con el panel por aria-controls. No se usa el atributo title.
 */
export default function Tooltip({ label, content }: { label: string; content: string }) {
  const panelId = useId();
  const [open, setOpen] = useState(false);

  return (
    <span className="ayuda-seccion">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && open) {
            e.preventDefault();
            setOpen(false);
          }
        }}
        onBlur={() => setOpen(false)}
        style={{
          width: '24px',
          height: '24px',
          padding: 0,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.2)',
          color: 'var(--text-primary)',
          fontSize: '0.8rem',
          fontWeight: 'bold',
          lineHeight: 1,
          cursor: 'help',
        }}
      >
        <span aria-hidden="true">?</span>
      </button>
      <span id={panelId} hidden={!open} className="ayuda-seccion-panel">
        {content}
      </span>
    </span>
  );
}
