import React, { useState } from 'react';

interface GenericEditModalProps {
  collectionName: string;
  record: any;
  onSave: (updatedRecord: any) => Promise<void>;
  onClose: () => void;
}

const FIELD_LABEL_MAP: Record<string, string> = {
  'Sigla Compañía': 'Compañía',
  'Año': 'Año',
  'Años': 'Años',
  'Categorías': 'Categoría',
  'Beneficiario ': 'Beneficiario',
  'Encargado ': 'Encargado',
  'Número de representaciones  por año ': 'Número de representaciones por año'
};

const TEXTAREA_FIELDS = [
  'Documento',
  'Noticia',
  'Referencias bibliográficas',
  'Fuentes para la generación del dato'
];

const READONLY_FIELDS = [
  'Doc',
  'Num',
  'Indicador de registro'
];

export default function GenericEditModal({ collectionName, record, onSave, onClose }: GenericEditModalProps) {
  const [formData, setFormData] = useState<any>({ ...record });
  const [loading, setLoading] = useState(false);

  const handleChange = (key: string, value: string) => {
    setFormData((prev: any) => ({ ...prev, [key]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Auto-convert fields back to their original types (number, boolean) before saving
    const processedData = { ...formData };
    for (const key of Object.keys(processedData)) {
      if (key === 'id') continue;
      const originalValue = record[key];

      // Handle number type conversions
      if (typeof originalValue === 'number') {
        processedData[key] = processedData[key] === '' ? null : Number(processedData[key]);
      } 
      // Handle boolean type conversions
      else if (typeof originalValue === 'boolean') {
        processedData[key] = processedData[key] === 'true' || processedData[key] === true;
      }
    }

    await onSave(processedData);
    setLoading(false);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000
    }}>
      <div style={{
        background: 'var(--bg-card)',
        padding: '2rem',
        borderRadius: '12px',
        maxWidth: '600px',
        width: '90%',
        maxHeight: '90vh',
        overflowY: 'auto',
        border: '1px solid var(--border-color)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
      }}>
        <h2 style={{ marginTop: 0, color: 'var(--primary-color)' }}>
          Editar Registro - {collectionName.toUpperCase().replace(/_/g, ' ')}
        </h2>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', marginTop: '1.5rem' }}>
          {Object.keys(record)
            .filter(k => k !== 'id')
            .sort()
            .map(key => {
              const isReadOnly = READONLY_FIELDS.includes(key);
              const isTextarea = TEXTAREA_FIELDS.includes(key);
              const displayLabel = FIELD_LABEL_MAP[key] || key;

              return (
                <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>
                    {displayLabel} {isReadOnly && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>(No Editable)</span>}
                  </label>
                  
                  {isTextarea ? (
                    <textarea
                      value={formData[key] || ''}
                      onChange={e => handleChange(key, e.target.value)}
                      disabled={isReadOnly || loading}
                      rows={5}
                      style={{
                        padding: '0.6rem',
                        borderRadius: '4px',
                        border: '1px solid var(--border-color)',
                        background: isReadOnly ? 'rgba(255,255,255,0.05)' : 'var(--bg-body)',
                        color: 'var(--text-primary)',
                        fontFamily: 'inherit',
                        fontSize: '0.95rem'
                      }}
                    />
                  ) : (
                    <input
                      type="text"
                      value={formData[key] !== null && formData[key] !== undefined ? formData[key] : ''}
                      onChange={e => handleChange(key, e.target.value)}
                      disabled={isReadOnly || loading}
                      style={{
                        padding: '0.6rem',
                        borderRadius: '4px',
                        border: '1px solid var(--border-color)',
                        background: isReadOnly ? 'rgba(255,255,255,0.05)' : 'var(--bg-body)',
                        color: 'var(--text-primary)',
                        fontSize: '0.95rem'
                      }}
                    />
                  )}
                </div>
              );
            })}
          
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
            <button 
              type="button"
              onClick={onClose}
              style={{ padding: '0.5rem 1.2rem', background: '#ccc', color: '#333', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              disabled={loading}
            >
              Cancelar
            </button>
            <button 
              type="submit"
              style={{ padding: '0.5rem 1.2rem', background: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              disabled={loading}
            >
              {loading ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
