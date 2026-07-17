import React, { useEffect, useState } from 'react';
import { collection, query, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { cleanFirebaseData } from '../utils';

interface GenericEditModalProps {
  collectionName: string;
  record: any;
  onSave: (updatedRecord: any) => Promise<void>;
  onClose: () => void;
}

const COLLECTION_LABELS: Record<string, string> = {
  documentos: 'Documentos',
  companias: 'Compañias',
  transacciones: 'Transacciones',
  manejo_de_caja: 'Manejo de Caja',
  salarios: 'Salarios',
  corpus_christi: 'Corpus Christi',
  indicadores: 'Indicadores',
  bibliografia: 'Bibliografía'
};

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
  const [documents, setDocuments] = useState<any[]>([]);

  useEffect(() => {
    async function loadDocuments() {
      if (collectionName === 'transacciones') {
        try {
          const qDocs = query(collection(db, 'documentos'));
          const snapDocs = await getDocs(qDocs);
          const docList = snapDocs.docs.map(cleanFirebaseData).sort((a, b) => Number(a.Doc) - Number(b.Doc));
          setDocuments(docList);
        } catch (error) {
          console.error("Error loading documents in GenericEditModal", error);
        }
      }
    }
    loadDocuments();
  }, [collectionName]);

  const handleChange = (key: string, value: any) => {
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

  // Sort keys custom function to place primary keys first and Doc1..Doc10 last
  const getSortedKeys = () => {
    const keys = Object.keys(record).filter(k => k !== 'id');
    
    let indexField = '';
    if (collectionName === 'documentos') indexField = 'Doc';
    else if (collectionName === 'transacciones') indexField = 'Num';
    else if (keys.includes('Indicador de registro')) indexField = 'Indicador de registro';

    keys.sort((a, b) => {
      // 1. Index field always goes first
      if (a === indexField) return -1;
      if (b === indexField) return 1;

      // 2. Doc1..Doc10 go to the end for transacciones
      const isDocA = /^Doc\d+$/.test(a);
      const isDocB = /^Doc\d+$/.test(b);
      if (isDocA && !isDocB) return 1;
      if (!isDocA && isDocB) return -1;
      if (isDocA && isDocB) {
        const numA = Number(a.replace('Doc', ''));
        const numB = Number(b.replace('Doc', ''));
        return numA - numB;
      }

      // 3. Alphabetical sort for all other fields
      return a.localeCompare(b);
    });

    return keys;
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
          Editar Registro - {(COLLECTION_LABELS[collectionName] || collectionName).toUpperCase()}
        </h2>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', marginTop: '1.5rem' }}>
          {getSortedKeys().map(key => {
            const isReadOnly = READONLY_FIELDS.includes(key);
            const isTextarea = TEXTAREA_FIELDS.includes(key);
            const isDocField = /^Doc\d+$/.test(key);
            const displayLabel = FIELD_LABEL_MAP[key] || key;

            return (
              <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>
                  {displayLabel} {isReadOnly && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>(No Editable)</span>}
                </label>
                
                {isDocField ? (
                  <select
                    value={formData[key] !== null && formData[key] !== undefined ? formData[key] : ''}
                    onChange={e => handleChange(key, e.target.value === '' ? null : Number(e.target.value))}
                    disabled={isReadOnly || loading}
                    style={{
                      padding: '0.6rem',
                      borderRadius: '4px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-body)',
                      color: 'var(--text-primary)',
                      fontSize: '0.95rem'
                    }}
                  >
                    <option value="">Ninguno</option>
                    {documents.map(d => (
                      <option key={d.id} value={d.Doc}>
                        Doc {d.Doc} - {d.Documento ? d.Documento.substring(0, 50) + '...' : ''}
                      </option>
                    ))}
                  </select>
                ) : isTextarea ? (
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
