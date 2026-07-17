import React from 'react';

interface ConfirmModalProps {
  title: string;
  message: React.ReactNode;
  onConfirm?: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  isAlertOnly?: boolean;
}

export default function ConfirmModal({ 
  title, 
  message, 
  onConfirm, 
  onCancel, 
  confirmText = "Confirmar", 
  cancelText = "Cancelar",
  isAlertOnly = false
}: ConfirmModalProps) {
  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        background: 'var(--bg-card)',
        padding: '2rem',
        borderRadius: '8px',
        maxWidth: '500px',
        width: '90%',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
      }}>
        <h2 style={{ marginTop: 0, color: 'var(--primary-color)' }}>{title}</h2>
        <div style={{ margin: '1.5rem 0', lineHeight: '1.5' }}>{message}</div>
        
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
          {!isAlertOnly && (
            <button 
              onClick={onCancel}
              style={{ padding: '0.5rem 1rem', background: '#e0e0e0', color: '#333', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              {cancelText}
            </button>
          )}
          <button 
            onClick={isAlertOnly ? onCancel : onConfirm}
            style={{ padding: '0.5rem 1rem', background: isAlertOnly ? 'var(--primary-color)' : '#ff4d4f', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            {isAlertOnly ? 'Entendido' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
