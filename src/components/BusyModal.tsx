import { useId } from 'react';
import type { CSSProperties } from 'react';
import Modal from './Modal';

interface BusyModalProps {
  title?: string;
  message?: string;
}

const overlayStyle: CSSProperties = {
  position: 'fixed',
  top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: 'rgba(0,0,0,0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000
};

const panelStyle: CSSProperties = {
  background: 'var(--bg-card)',
  padding: '2rem',
  borderRadius: '8px',
  maxWidth: '400px',
  width: '90%',
  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
  textAlign: 'center'
};

// Capa de espera: no se puede cancelar (sin Escape) y el foco queda en el propio panel.
export default function BusyModal({ title = 'Por favor espere', message = 'Analizando registros...' }: BusyModalProps) {
  const titleId = useId();
  const messageId = useId();
  return (
    <Modal
      labelledBy={titleId}
      describedBy={messageId}
      busy
      overlayStyle={overlayStyle}
      panelStyle={panelStyle}
    >
      <h2 id={titleId} style={{ marginTop: 0, color: 'var(--primary-color)' }}>{title}</h2>
      <div id={messageId} style={{ margin: '1.5rem 0', fontWeight: 'bold' }}>{message}</div>
    </Modal>
  );
}
