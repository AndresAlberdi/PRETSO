import { useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode, RefObject } from 'react';
import { createPortal } from 'react-dom';
import { getFocusable, registerModal } from './modalStack';
import type { ModalEntry } from './modalStack';

interface ModalProps {
  labelledBy: string;
  describedBy?: string;
  role?: 'dialog' | 'alertdialog';
  // Si se entrega, Escape la invoca; si no, Escape no hace nada.
  onEscape?: () => void;
  initialFocus?: RefObject<HTMLElement | null>;
  busy?: boolean;
  overlayStyle: CSSProperties;
  panelStyle: CSSProperties;
  children: ReactNode;
}

// Ventana modal accesible: portal a <body>, foco contenido, fondo inerte y retorno del foco al cerrar.
export default function Modal({
  labelledBy,
  describedBy,
  role = 'dialog',
  onEscape,
  initialFocus,
  busy,
  overlayStyle,
  panelStyle,
  children,
}: ModalProps) {
  const [host] = useState(() => {
    const el = document.createElement('div');
    el.setAttribute('data-modal-host', '');
    return el;
  });
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const onEscapeRef = useRef(onEscape);
  const initialFocusRef = useRef(initialFocus);
  const zIndexRef = useRef(typeof overlayStyle.zIndex === 'number' ? overlayStyle.zIndex : 0);
  useLayoutEffect(() => {
    onEscapeRef.current = onEscape;
    initialFocusRef.current = initialFocus;
  });

  useLayoutEffect(() => {
    const overlay = overlayRef.current;
    const panel = panelRef.current;
    if (!overlay || !panel) return;
    const entry: ModalEntry = {
      host,
      panel,
      overlay,
      zIndex: zIndexRef.current,
      opener: document.activeElement,
      getOnEscape: () => onEscapeRef.current,
    };
    document.body.appendChild(host);
    const release = registerModal(entry);
    (initialFocusRef.current?.current ?? getFocusable(panel)[0] ?? panel).focus();
    return () => {
      const eraSuperior = release();
      host.remove();
      // Una ventana inferior que se cierra con otras encima no toca el foco: lo restaura la superior.
      if (!eraSuperior) return;
      const opener = entry.opener;
      const alContenido = () => document.getElementById('contenido')?.focus({ preventScroll: true });
      if (opener instanceof HTMLElement && opener.isConnected) {
        opener.focus();
        // Si el origen se retira del DOM en este mismo commit, el foco cae en <body>: se lleva al contenido.
        queueMicrotask(() => {
          if (!opener.isConnected && (document.activeElement === document.body || !document.activeElement)) alContenido();
        });
      } else {
        alContenido();
      }
    };
    // Se monta una sola vez por ventana; el estilo inicial basta para fijar el zIndex base.
  }, [host]);

  return createPortal(
    <div ref={overlayRef} style={overlayStyle}>
      <div
        ref={panelRef}
        role={role}
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        aria-busy={busy || undefined}
        tabIndex={-1}
        style={panelStyle}
      >
        {children}
      </div>
    </div>,
    host,
  );
}
