import { useEffect, useId, useRef, useState } from 'react';

/**
 * Ayuda de sección: botón «?» que despliega un panel con la descripción.
 * - WCAG 1.4.13 (contenido al pasar el cursor o al enfocar): el contenido se muestra por acción
 *   explícita y se cierra con Escape (desde cualquier punto), con un nuevo clic, al hacer clic fuera
 *   o al mover el foco fuera; un clic dentro del panel NO lo cierra, de modo que el texto se puede leer
 *   y copiar.
 * - WCAG 2.1.1 (teclado): se opera con clic, Enter y Espacio al ser un botón nativo.
 * - WCAG 4.1.2 (nombre, función, valor): nombre accesible por aria-label, estado por aria-expanded
 *   y relación con el panel por aria-controls. No se usa el atributo title.
 */
export default function Tooltip({ label, content }: { label: string; content: string }) {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Escuchadores en document solo mientras el panel está abierto; el setState va dentro de ellos.
  useEffect(() => {
    if (!open) return;
    const fuera = (e: Event) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const dentro = rootRef.current?.contains(document.activeElement) ?? false;
      setOpen(false);
      if (dentro) buttonRef.current?.focus();
    };
    document.addEventListener('pointerdown', fuera);
    document.addEventListener('focusin', fuera);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('pointerdown', fuera);
      document.removeEventListener('focusin', fuera);
      document.removeEventListener('keydown', tecla);
    };
  }, [open]);

  return (
    <span className="ayuda-seccion" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
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
