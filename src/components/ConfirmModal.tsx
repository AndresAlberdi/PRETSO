import React, { useId, useRef } from 'react';
import Modal from './Modal';

interface ConfirmModalProps {
  title: string;
  message: React.ReactNode;
  onConfirm?: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  isAlertOnly?: boolean;
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: 'rgba(0,0,0,0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000
};

const panelStyle: React.CSSProperties = {
  background: 'var(--bg-card)',
  padding: '2rem',
  borderRadius: '8px',
  maxWidth: '500px',
  width: '90%',
  boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
};

export default function ConfirmModal({ 
  title, 
  message, 
  onConfirm, 
  onCancel, 
  confirmText = "Confirmar", 
  cancelText = "Cancelar",
  isAlertOnly = false
}: ConfirmModalProps) {
  const titleId = useId();
  const messageId = useId();
  // Confirmación: el foco inicial va a «Cancelar»; solo aviso: a «Entendido».
  const focoInicial = useRef<HTMLButtonElement>(null);

  return (
    <Modal
      role="alertdialog"
      labelledBy={titleId}
      describedBy={messageId}
      onEscape={onCancel}
      initialFocus={focoInicial}
      overlayStyle={overlayStyle}
      panelStyle={panelStyle}
    >
      <h2 id={titleId} style={{ marginTop: 0, color: 'var(--primary-color)' }}>{title}</h2>
      <div id={messageId} style={{ margin: '1.5rem 0', lineHeight: '1.5' }}>{message}</div>
      
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
        {!isAlertOnly && (
          <button 
            ref={focoInicial}
            onClick={onCancel}
            style={{ padding: '0.5rem 1rem', background: '#e0e0e0', color: '#333', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            {cancelText}
          </button>
        )}
        <button 
          ref={isAlertOnly ? focoInicial : undefined}
          onClick={isAlertOnly ? onCancel : onConfirm}
          style={{ padding: '0.5rem 1rem', background: isAlertOnly ? 'var(--primary-color)' : '#ff4d4f', color: isAlertOnly ? 'var(--on-primary)' : 'var(--on-danger)', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          {isAlertOnly ? 'Entendido' : confirmText}
        </button>
      </div>
    </Modal>
  );
}
