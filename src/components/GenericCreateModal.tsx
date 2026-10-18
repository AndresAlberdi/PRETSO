import React, { useEffect, useId, useRef, useState } from 'react';
import { collection, doc, getDocs, query, setDoc, type DocumentReference } from 'firebase/firestore';
import { db } from '../firebase';
import { cleanFirebaseData } from '../utils';
import { logAction } from '../utils/audit';
import { canonizarReferencia } from '../utils/referenciaCompania';
import SelectorCompania from './SelectorCompania';
import Modal from './Modal';
import ConfirmModal from './ConfirmModal';

const COLLECTION_LABELS: Record<string, string> = {
  documentos: 'Documentos',
  companias: 'Compañias',
  transacciones: 'Transacciones',
  manejo_de_caja: 'Manejo de Caja',
  salarios: 'Remuneraciones',
  corpus_christi: 'Corpus Christi',
  indicadores: 'Indicadores',
  bibliografia: 'Bibliografía'
};

interface GenericCreateModalProps {
  collectionName: string;
  onClose: () => void;
  onCreated: (newRecord: any) => void;
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: 'rgba(0,0,0,0.6)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 2000
};

const panelStyle: React.CSSProperties = {
  background: 'var(--bg-card)',
  padding: '2.5rem',
  borderRadius: '12px',
  maxWidth: '700px',
  width: '90%',
  maxHeight: '90vh',
  overflowY: 'auto',
  border: '1px solid var(--border-color)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
};

// Error de validación del formulario: indica el campo inválido para marcarlo y enlazarlo con el mensaje.
class ValidationError extends Error {
  readonly field: string;
  constructor(field: string, message: string) {
    super(message);
    this.field = field;
  }
}

const fieldsetStyle: React.CSSProperties = { border: 0, padding: 0, margin: 0, minWidth: 0 };
const legendStyle: React.CSSProperties = { padding: '0 0 0.5rem', fontWeight: 'bold' };

export default function GenericCreateModal({ collectionName, onClose, onCreated }: GenericCreateModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorField, setErrorField] = useState<string | null>(null);
  // Se activa con cualquier edición del usuario (no con los valores por defecto precargados);
  // decide si Escape pide confirmar el descarte.
  const [touched, setTouched] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const titleId = useId();
  const fieldId = useId();
  const errorId = `${fieldId}-error`;
  const closeRef = useRef<HTMLButtonElement>(null);

  // Integridad del alta: la protección contra doble envío es síncrona (el estado `saving` se
  // actualiza de forma asíncrona y no basta). El ID se fija en el primer envío y los reintentos lo
  // reutilizan; una vez escrito el documento, el registro queda fijado y no se vuelve a escribir.
  const enviandoRef = useRef(false);
  const docRefRef = useRef<DocumentReference | null>(null);
  const registroRef = useRef<Record<string, unknown> | null>(null);
  const escritoRef = useRef(false);
  const auditadoRef = useRef(false);
  const notificadoRef = useRef(false);

  // Auto-calculated sequential index
  const [nextIndex, setNextIndex] = useState<number | null>(null);

  // Available options for selection dropdowns
  const [transactions, setTransactions] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  
  // Unique values for specific fields to allow "selecting existing or typing new"
  const [existingCategories, setExistingCategories] = useState<string[]>([]);
  const [existingCities, setExistingCities] = useState<string[]>([]);
  const [existingYears, setExistingYears] = useState<number[]>([]);

  // Form states
  const [formData, setFormData] = useState<any>({});
  
  // Custom states for specific requirements
  const [selectedDocs, setSelectedDocs] = useState<string[]>(Array(10).fill('')); // For Transacción (up to 10 doc associations)
  const [categoryType, setCategoryType] = useState<'select' | 'input'>('select');
  const [cityType, setCityType] = useState<'select' | 'input'>('select');
  const [yearType, setYearType] = useState<'select' | 'input'>('select');

  useEffect(() => {
    async function loadFormContext() {
      try {
        setLoading(true);
        setError(null);
        setErrorField(null);

        // 1. Calculate next sequential index
        let indexField = '';
        if (collectionName === 'documentos') indexField = 'Doc';
        else if (collectionName === 'transacciones') indexField = 'Num';
        else if (collectionName === 'bibliografia') indexField = '';
        else indexField = 'Indicador de registro';

        let maxIdx = 0;
        const qAll = query(collection(db, collectionName));
        const snapAll = await getDocs(qAll);
        snapAll.docs.forEach(d => {
          const val = Number(d.data()[indexField]);
          if (!isNaN(val) && val > maxIdx) {
            maxIdx = val;
          }
        });
        if (indexField) {
          setNextIndex(maxIdx + 1);
        }

        // 2. Load associations depending on collection requirements
        // We always need companies for Salarios, Manejo de Caja, Indicadores, Corpus Christi
        const qComp = query(collection(db, 'companias'));
        const snapComp = await getDocs(qComp);
        const compList = snapComp.docs.map(cleanFirebaseData);
        setCompanies(compList);

        // We need transactions for Indicadores, Corpus Christi, Salarios, Manejo de Caja
        const qTrans = query(collection(db, 'transacciones'));
        const snapTrans = await getDocs(qTrans);
        const transList = snapTrans.docs.map(cleanFirebaseData).sort((a, b) => Number(a.Num) - Number(b.Num));
        setTransactions(transList);

        // We need documents for Transacciones (up to 10 docs)
        const qDocs = query(collection(db, 'documentos'));
        const snapDocs = await getDocs(qDocs);
        const docList = snapDocs.docs.map(cleanFirebaseData).sort((a, b) => Number(a.Doc) - Number(b.Doc));
        setDocuments(docList);

        // Fetch categories for Indicadores
        if (collectionName === 'indicadores') {
          const qInd = query(collection(db, 'indicadores'));
          const snapInd = await getDocs(qInd);
          const cats = Array.from(new Set(snapInd.docs.map(d => d.data()['Categorías']))).filter(Boolean) as string[];
          setExistingCategories(cats.sort());
          if (cats.length > 0) {
            setFormData((prev: any) => ({ ...prev, 'Categorías': cats[0] }));
          } else {
            setCategoryType('input');
          }
        }

        // Fetch cities and years for Corpus Christi
        if (collectionName === 'corpus_christi') {
          const qCorp = query(collection(db, 'corpus_christi'));
          const snapCorp = await getDocs(qCorp);
          const dataCorp = snapCorp.docs.map(d => d.data());
          const cities = Array.from(new Set(dataCorp.map(d => d['Ciudad']))).filter(Boolean) as string[];
          const years = Array.from(new Set(dataCorp.map(d => Number(d['Año'])))).filter(n => !isNaN(n)) as number[];
          setExistingCities(cities.sort());
          setExistingYears(years.sort((a, b) => a - b));

          const defaultCity = cities[0] || '';
          const defaultYear = years[0] || '';
          setFormData((prev: any) => ({
            ...prev,
            'Ciudad': defaultCity,
            'Año': defaultYear
          }));
          if (cities.length === 0) setCityType('input');
          if (years.length === 0) setYearType('input');
        }

      } catch (err: any) {
        console.error("Error loading create modal context", err);
        setError("Error al cargar los datos del formulario.");
      } finally {
        setLoading(false);
      }
    }

    loadFormContext();
  }, [collectionName]);

  const invalidProps = (field: string): { 'aria-invalid'?: true; 'aria-describedby'?: string } =>
    errorField === field ? { 'aria-invalid': true, 'aria-describedby': errorId } : {};

  const handleChange = (key: string, value: any) => {
    setTouched(true);
    setFormData((prev: any) => ({ ...prev, [key]: value }));
  };

  const handleDocChange = (index: number, value: string) => {
    setTouched(true);
    setSelectedDocs(prev => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (enviandoRef.current) return;
    enviandoRef.current = true;
    setError(null);
    setErrorField(null);
    setSaving(true);

    try {
      const recordToSave: any = { ...formData };

      // Apply index
      if (nextIndex !== null) {
        if (collectionName === 'documentos') {
          recordToSave['Doc'] = nextIndex;
        } else if (collectionName === 'transacciones') {
          recordToSave['Num'] = nextIndex;
        } else {
          recordToSave['Indicador de registro'] = nextIndex;
        }
      }

      // 1. Validations and format assignments
      
      // Transactions documents (choose up to 10 documents)
      if (collectionName === 'transacciones') {
        const docCount = selectedDocs.filter(Boolean).length;
        if (docCount === 0) {
          throw new ValidationError('Doc', "Debe asociar al menos un documento a la transacción.");
        }
        for (let i = 0; i < 10; i++) {
          recordToSave[`Doc${i + 1}`] = selectedDocs[i] ? Number(selectedDocs[i]) : null;
        }
      }

      // Indicadores
      if (collectionName === 'indicadores') {
        if (!recordToSave['Categorías'] || !recordToSave['Categorías'].trim()) {
          throw new ValidationError('Categorías', "Debe ingresar o seleccionar una categoría.");
        }
        if (!recordToSave['Transacción']) {
          throw new ValidationError('Transacción', "Debe asociar obligatoriamente una transacción existente.");
        }
        recordToSave['Transacción'] = Number(recordToSave['Transacción']);
        recordToSave['Años'] = recordToSave['Años'] ? String(recordToSave['Años']).trim() : '';
      }

      // Corpus Christi
      if (collectionName === 'corpus_christi') {
        if (!recordToSave['Ciudad'] || !recordToSave['Ciudad'].trim()) {
          throw new ValidationError('Ciudad', "Debe ingresar o seleccionar una ciudad.");
        }
        if (!recordToSave['Año']) {
          throw new ValidationError('Año', "Debe ingresar o seleccionar un año.");
        }
        if (!recordToSave['Transacción']) {
          throw new ValidationError('Transacción', "Debe asociar obligatoriamente una transacción existente.");
        }
        recordToSave['Transacción'] = Number(recordToSave['Transacción']);
        recordToSave['Año'] = Number(recordToSave['Año']);
      }

      // Salarios
      if (collectionName === 'salarios') {
        if (canonizarReferencia(recordToSave['Sigla Compañía']) === '') {
          throw new ValidationError('Sigla Compañía', "Debe elegir una compañía existente.");
        }
        if (!recordToSave['Transacción']) {
          throw new ValidationError('Transacción', "Debe asociar obligatoriamente una transacción existente.");
        }
        recordToSave['Transacción'] = Number(recordToSave['Transacción']);
        recordToSave['Año'] = Number(recordToSave['Año']);
        if (recordToSave['Ración diaria'] !== undefined) recordToSave['Ración diaria'] = Number(recordToSave['Ración diaria']) || null;
        if (recordToSave['Pago por representación'] !== undefined) recordToSave['Pago por representación'] = Number(recordToSave['Pago por representación']) || null;
      }

      // Manejo de Caja
      if (collectionName === 'manejo_de_caja') {
        if (canonizarReferencia(recordToSave['Sigla Compañía']) === '') {
          throw new ValidationError('Sigla Compañía', "Debe elegir una compañía existente.");
        }
        if (!recordToSave['Transacción']) {
          throw new ValidationError('Transacción', "Debe asociar obligatoriamente una transacción existente.");
        }
        recordToSave['Transacción'] = Number(recordToSave['Transacción']);
        recordToSave['Año'] = Number(recordToSave['Año']);
      }

      // Bibliografía validation
      if (collectionName === 'bibliografia') {
        if (!recordToSave['Autores'] || !recordToSave['Autores'].trim()) {
          throw new ValidationError('Autores', "Debe completar el campo 'Autores'.");
        }
        if (!recordToSave['Referencias bibliográficas'] || !recordToSave['Referencias bibliográficas'].trim()) {
          throw new ValidationError('Referencias bibliográficas', "Debe completar las 'Referencias bibliográficas'.");
        }
      }

      // 2. Save in Firestore: el ID se genera en el cliente una sola vez y los reintentos lo reutilizan
      // (no se duplica el documento). El registro se reconstruye en cada intento, de modo que una
      // corrección del usuario tras un fallo se guarda; solo se fija una vez escrito con éxito.
      if (!docRefRef.current) docRefRef.current = doc(collection(db, collectionName));
      const docRef = docRefRef.current;
      if (!escritoRef.current) {
        await setDoc(docRef, recordToSave);
        escritoRef.current = true;
        registroRef.current = recordToSave;
      }
      const registro = registroRef.current as Record<string, unknown>;

      // 3. Log Action (una sola vez)
      if (!auditadoRef.current) {
        auditadoRef.current = true;
        await logAction('CREATE', collectionName, docRef.id, registro);
      }

      // 4. Return to parent (una sola vez, aunque el cierre posterior falle)
      if (!notificadoRef.current) {
        notificadoRef.current = true;
        onCreated({ id: docRef.id, ...registro });
      }

      onClose();

    } catch (err: any) {
      if (escritoRef.current) {
        // El documento ya existe: el error es posterior a la escritura y los cambios nuevos no se reescriben.
        setError("El registro ya se guardó; ciérrelo con «Cerrar».");
        setErrorField(null);
      } else {
        setError(err.message || "Error al guardar el nuevo registro.");
        setErrorField(err instanceof ValidationError ? err.field : null);
      }
    } finally {
      enviandoRef.current = false;
      setSaving(false);
    }
  };

  // Escape no hace nada mientras guarda; sin cambios cierra; con cambios pide confirmar el descarte.
  const handleEscape = () => {
    if (saving) return;
    if (touched) setConfirmDiscard(true);
    else onClose();
  };

  return (
    <>
      <Modal labelledBy={titleId} onEscape={handleEscape} initialFocus={closeRef} overlayStyle={overlayStyle} panelStyle={panelStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
          <h2 id={titleId} style={{ marginTop: 0, color: 'var(--primary-color)' }}>Nuevo Registro - {(COLLECTION_LABELS[collectionName] || collectionName).toUpperCase()}</h2>
          <button ref={closeRef} onClick={onClose} disabled={saving} style={{ padding: '0.4rem 0.8rem', background: '#ccc', color: '#333', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Cerrar</button>
        </div>

        {loading ? <p>Cargando opciones...</p> : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
            
            {/* 1. Show Correlative ID if applicable */}
            {nextIndex !== null && (
              <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                <span style={{ fontWeight: 'bold' }}>Índice Autogenerado: </span>
                <span style={{ fontSize: '1.1rem', color: 'var(--primary-color)', fontWeight: 'bold' }}>{nextIndex}</span>
              </div>
            )}

            {/* 2. Collection specific inputs */}
            
            {/* --- DOCUMENTOS --- */}
            {collectionName === 'documentos' && (
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <strong>Documento (Texto)</strong>
                <textarea
                  required
                  rows={4}
                  value={formData['Documento'] || ''}
                  onChange={e => handleChange('Documento', e.target.value)}
                  placeholder="Ingrese el texto completo de la escritura/documento..."
                />
              </label>
            )}

            {/* --- TRANSACCIONES --- */}
            {collectionName === 'transacciones' && (
              <>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <strong>Noticia</strong>
                  <textarea
                    required
                    rows={4}
                    value={formData['Noticia'] || ''}
                    onChange={e => handleChange('Noticia', e.target.value)}
                    placeholder="Noticia sobre la transacción..."
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <strong>Fuentes para la generación del dato</strong>
                  <textarea
                    required
                    rows={3}
                    value={formData['Fuentes para la generación del dato'] || ''}
                    onChange={e => handleChange('Fuentes para la generación del dato', e.target.value)}
                    placeholder="Detalles sobre las fuentes y referencias..."
                  />
                </label>
                
                <fieldset style={fieldsetStyle}>
                  <legend style={legendStyle}>Asociar Documentos (Hasta 10)</legend>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.8rem' }}>
                    {Array.from({ length: 10 }).map((_, i) => (
                      <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <label htmlFor={`${fieldId}-doc-${i}`} style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Documento {i + 1}</label>
                        <select
                          id={`${fieldId}-doc-${i}`}
                          {...(i === 0 ? invalidProps('Doc') : {})}
                          value={selectedDocs[i]}
                          onChange={e => handleDocChange(i, e.target.value)}
                        >
                          <option value="">Ninguno</option>
                          {documents.map(d => (
                            <option key={d.id} value={d.Doc}>Doc {d.Doc} - {d.Documento ? d.Documento.substring(0, 40) + '...' : ''}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </fieldset>
              </>
            )}

            {/* --- COMPANIAS --- */}
            {collectionName === 'companias' && (
              <>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <strong>Sigla Compañía</strong>
                  <input
                    type="text"
                    required
                    value={formData['Sigla Compañía'] || ''}
                    onChange={e => handleChange('Sigla Compañía', e.target.value)}
                    placeholder="Ej: GA-JR"
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <strong>Autores</strong>
                  <input
                    type="text"
                    value={formData['Autores'] || ''}
                    onChange={e => handleChange('Autores', e.target.value)}
                    placeholder="Ej: Gonzalo de Alarcón y Juan Ramírez"
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <strong>Temporadas teatrales</strong>
                  <input
                    type="text"
                    value={formData['Temporadas teatrales'] || ''}
                    onChange={e => handleChange('Temporadas teatrales', e.target.value)}
                    placeholder="Ej: De 1600 a 1601"
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <strong>Índice de compañías</strong>
                  <input
                    type="text"
                    value={formData['Índice de compañías'] || ''}
                    onChange={e => handleChange('Índice de compañías', e.target.value)}
                    placeholder="Ej: Sí / No"
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <strong>Ámbito</strong>
                  <input
                    type="text"
                    value={formData['Ámbito'] || ''}
                    onChange={e => handleChange('Ámbito', e.target.value)}
                    placeholder="Ej: España"
                  />
                </label>
              </>
            )}

            {/* --- BIBLIOGRAFIA --- */}
            {collectionName === 'bibliografia' && (
              <>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <strong>Autores</strong>
                  <input
                    type="text"
                    required
                    {...invalidProps('Autores')}
                    value={formData['Autores'] || ''}
                    onChange={e => handleChange('Autores', e.target.value)}
                    placeholder="Autores del documento..."
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <strong>Referencias bibliográficas</strong>
                  <textarea
                    required
                    rows={4}
                    {...invalidProps('Referencias bibliográficas')}
                    value={formData['Referencias bibliográficas'] || ''}
                    onChange={e => handleChange('Referencias bibliográficas', e.target.value)}
                    placeholder="Detalles bibliográficos..."
                  />
                </label>
              </>
            )}

            {/* --- MANEJO DE CAJA --- */}
            {collectionName === 'manejo_de_caja' && (
              <>
                <label htmlFor={`${fieldId}-compania`} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <strong>Sigla Compañía (Obligatorio)</strong>
                  <SelectorCompania
                    id={`${fieldId}-compania`}
                    required
                    ariaInvalid={errorField === 'Sigla Compañía'}
                    ariaDescribedBy={errorField === 'Sigla Compañía' ? errorId : undefined}
                    companias={companies}
                    cargando={loading}
                    value={formData['Sigla Compañía']}
                    onChange={v => handleChange('Sigla Compañía', v ?? '')}
                    textoVacio="Seleccione una compañía..."
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <strong>Transacción Relacionada (Obligatorio)</strong>
                  <select
                    required
                    {...invalidProps('Transacción')}
                    value={formData['Transacción'] || ''}
                    onChange={e => handleChange('Transacción', e.target.value)}
                  >
                    <option value="">Seleccione una transacción...</option>
                    {transactions.map(t => (
                      <option key={t.id} value={t.Num}>Transacción {t.Num} - {t.Noticia ? t.Noticia.substring(0, 60) + '...' : ''}</option>
                    ))}
                  </select>
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <strong>Ciudad</strong>
                  <input
                    type="text"
                    required
                    value={formData['Ciudad'] || ''}
                    onChange={e => handleChange('Ciudad', e.target.value)}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <strong>Año</strong>
                  <input
                    type="number"
                    required
                    value={formData['Año'] || ''}
                    onChange={e => handleChange('Año', e.target.value)}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <strong>Ingresos</strong>
                  <input
                    type="text"
                    value={formData['Ingresos'] || ''}
                    onChange={e => handleChange('Ingresos', e.target.value)}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <strong>Egresos</strong>
                  <input
                    type="text"
                    value={formData['Egresos'] || ''}
                    onChange={e => handleChange('Egresos', e.target.value)}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <strong>Otros bienes de la compañía</strong>
                  <input
                    type="text"
                    value={formData['Otros bienes de la compañía'] || ''}
                    onChange={e => handleChange('Otros bienes de la compañía', e.target.value)}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <strong>Datos sobre normativa de manejo de caja</strong>
                  <input
                    type="text"
                    value={formData['Datos sobre normativa de manejo de caja'] || ''}
                    onChange={e => handleChange('Datos sobre normativa de manejo de caja', e.target.value)}
                  />
                </label>
              </>
            )}

            {/* --- SALARIOS --- */}
            {collectionName === 'salarios' && (
              <>
                <label htmlFor={`${fieldId}-compania`} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <strong>Sigla Compañía (Obligatorio)</strong>
                  <SelectorCompania
                    id={`${fieldId}-compania`}
                    required
                    ariaInvalid={errorField === 'Sigla Compañía'}
                    ariaDescribedBy={errorField === 'Sigla Compañía' ? errorId : undefined}
                    companias={companies}
                    cargando={loading}
                    value={formData['Sigla Compañía']}
                    onChange={v => handleChange('Sigla Compañía', v ?? '')}
                    textoVacio="Seleccione una compañía..."
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <strong>Transacción Relacionada (Obligatorio)</strong>
                  <select
                    required
                    {...invalidProps('Transacción')}
                    value={formData['Transacción'] || ''}
                    onChange={e => handleChange('Transacción', e.target.value)}
                  >
                    <option value="">Seleccione una transacción...</option>
                    {transactions.map(t => (
                      <option key={t.id} value={t.Num}>Transacción {t.Num} - {t.Noticia ? t.Noticia.substring(0, 60) + '...' : ''}</option>
                    ))}
                  </select>
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <strong>Beneficiario</strong>
                  <input
                    type="text"
                    required
                    value={formData['Beneficiario '] || ''}
                    onChange={e => handleChange('Beneficiario ', e.target.value)}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <strong>Encargo (Ocupación)</strong>
                  <input
                    type="text"
                    value={formData['Encargo'] || ''}
                    onChange={e => handleChange('Encargo', e.target.value)}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <strong>Monto a pagar (Remuneración)</strong>
                  <input
                    type="text"
                    value={formData['Monto a pagar'] || ''}
                    onChange={e => handleChange('Monto a pagar', e.target.value)}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <strong>Ciudad</strong>
                  <input
                    type="text"
                    value={formData['Ciudad'] || ''}
                    onChange={e => handleChange('Ciudad', e.target.value)}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <strong>Año</strong>
                  <input
                    type="number"
                    value={formData['Año'] || ''}
                    onChange={e => handleChange('Año', e.target.value)}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <strong>Ración diaria (Número)</strong>
                  <input
                    type="number"
                    value={formData['Ración diaria'] || ''}
                    onChange={e => handleChange('Ración diaria', e.target.value)}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <strong>Pago por representación (Número)</strong>
                  <input
                    type="number"
                    value={formData['Pago por representación'] || ''}
                    onChange={e => handleChange('Pago por representación', e.target.value)}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <strong>Días de ración en un año</strong>
                  <input
                    type="number"
                    value={formData['Días de ración en un año'] || ''}
                    onChange={e => handleChange('Días de ración en un año', e.target.value)}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <strong>Número estimado de representaciones por año</strong>
                  <input
                    type="number"
                    value={formData['Número estimado de representaciones por año'] || ''}
                    onChange={e => handleChange('Número estimado de representaciones por año', e.target.value)}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <strong>Número de representaciones por año</strong>
                  <input
                    type="number"
                    value={formData['Número de representaciones  por año '] || ''}
                    onChange={e => handleChange('Número de representaciones  por año ', e.target.value)}
                  />
                </label>
              </>
            )}

            {/* --- CORPUS CHRISTI --- */}
            {collectionName === 'corpus_christi' && (
              <>
                <fieldset style={fieldsetStyle}>
                  <legend id={`${fieldId}-ciudad-leyenda`} style={legendStyle}>Ciudad (Obligatorio)</legend>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      <label style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                        <input type="radio" name={`${fieldId}-ciudad-modo`} checked={cityType === 'select'} onChange={() => setCityType('select')} disabled={existingCities.length === 0} />
                        Elegir previa
                      </label>
                      <label style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                        <input type="radio" name={`${fieldId}-ciudad-modo`} checked={cityType === 'input'} onChange={() => setCityType('input')} />
                        Nueva ciudad
                      </label>
                    </div>
                    {cityType === 'select' ? (
                      <select
                        required
                        aria-labelledby={`${fieldId}-ciudad-leyenda`}
                        {...invalidProps('Ciudad')}
                        value={formData['Ciudad'] || ''}
                        onChange={e => handleChange('Ciudad', e.target.value)}
                      >
                        {existingCities.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    ) : (
                      <input
                        type="text"
                        aria-labelledby={`${fieldId}-ciudad-leyenda`}
                        {...invalidProps('Ciudad')}
                        required
                        placeholder="Nombre de la nueva ciudad"
                        value={formData['Ciudad'] || ''}
                        onChange={e => handleChange('Ciudad', e.target.value)}
                      />
                    )}
                  </div>
                </fieldset>

                <fieldset style={fieldsetStyle}>
                  <legend id={`${fieldId}-anio-leyenda`} style={legendStyle}>Año (Obligatorio)</legend>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      <label style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                        <input type="radio" name={`${fieldId}-anio-modo`} checked={yearType === 'select'} onChange={() => setYearType('select')} disabled={existingYears.length === 0} />
                        Elegir previo
                      </label>
                      <label style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                        <input type="radio" name={`${fieldId}-anio-modo`} checked={yearType === 'input'} onChange={() => setYearType('input')} />
                        Nuevo año
                      </label>
                    </div>
                    {yearType === 'select' ? (
                      <select
                        required
                        aria-labelledby={`${fieldId}-anio-leyenda`}
                        {...invalidProps('Año')}
                        value={formData['Año'] || ''}
                        onChange={e => handleChange('Año', e.target.value)}
                      >
                        {existingYears.map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                    ) : (
                      <input
                        type="number"
                        aria-labelledby={`${fieldId}-anio-leyenda`}
                        {...invalidProps('Año')}
                        required
                        placeholder="Año (numérico)"
                        value={formData['Año'] || ''}
                        onChange={e => handleChange('Año', e.target.value)}
                      />
                    )}
                  </div>
                </fieldset>

                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <strong>Transacción Relacionada (Obligatorio)</strong>
                  <select
                    required
                    {...invalidProps('Transacción')}
                    value={formData['Transacción'] || ''}
                    onChange={e => handleChange('Transacción', e.target.value)}
                  >
                    <option value="">Seleccione una transacción...</option>
                    {transactions.map(t => (
                      <option key={t.id} value={t.Num}>Transacción {t.Num} - {t.Noticia ? t.Noticia.substring(0, 60) + '...' : ''}</option>
                    ))}
                  </select>
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <strong>Encargo</strong>
                  <input
                    type="text"
                    value={formData['Encargo'] || ''}
                    onChange={e => handleChange('Encargo', e.target.value)}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <strong>Encargado</strong>
                  <input
                    type="text"
                    value={formData['Encargado '] || ''}
                    onChange={e => handleChange('Encargado ', e.target.value)}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <strong>Monto a pagar</strong>
                  <input
                    type="text"
                    value={formData['Monto a pagar'] || ''}
                    onChange={e => handleChange('Monto a pagar', e.target.value)}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <strong>Fondos</strong>
                  <input
                    type="text"
                    value={formData['Fondos'] || ''}
                    onChange={e => handleChange('Fondos', e.target.value)}
                  />
                </label>
                <label htmlFor={`${fieldId}-compania`} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <strong>Compañía Principal</strong>
                  <SelectorCompania
                    id={`${fieldId}-compania`}
                    companias={companies}
                    cargando={loading}
                    value={formData['Compañía']}
                    onChange={v => handleChange('Compañía', v)}
                  />
                </label>
              </>
            )}

            {/* --- INDICADORES --- */}
            {collectionName === 'indicadores' && (
              <>
                <fieldset style={fieldsetStyle}>
                  <legend id={`${fieldId}-categoria-leyenda`} style={legendStyle}>Categoría / Indicador (Obligatorio)</legend>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      <label style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                        <input type="radio" name={`${fieldId}-categoria-modo`} checked={categoryType === 'select'} onChange={() => setCategoryType('select')} disabled={existingCategories.length === 0} />
                        Elegir previa
                      </label>
                      <label style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                        <input type="radio" name={`${fieldId}-categoria-modo`} checked={categoryType === 'input'} onChange={() => setCategoryType('input')} />
                        Nueva categoría
                      </label>
                    </div>
                    {categoryType === 'select' ? (
                      <select
                        required
                        aria-labelledby={`${fieldId}-categoria-leyenda`}
                        {...invalidProps('Categorías')}
                        value={formData['Categorías'] || ''}
                        onChange={e => handleChange('Categorías', e.target.value)}
                      >
                        {existingCategories.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    ) : (
                      <input
                        type="text"
                        aria-labelledby={`${fieldId}-categoria-leyenda`}
                        {...invalidProps('Categorías')}
                        required
                        placeholder="Nombre de la nueva categoría"
                        value={formData['Categorías'] || ''}
                        onChange={e => handleChange('Categorías', e.target.value)}
                      />
                    )}
                  </div>
                </fieldset>

                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <strong>Transacción Relacionada (Obligatorio)</strong>
                  <select
                    required
                    {...invalidProps('Transacción')}
                    value={formData['Transacción'] || ''}
                    onChange={e => handleChange('Transacción', e.target.value)}
                  >
                    <option value="">Seleccione una transacción...</option>
                    {transactions.map(t => (
                      <option key={t.id} value={t.Num}>Transacción {t.Num} - {t.Noticia ? t.Noticia.substring(0, 60) + '...' : ''}</option>
                    ))}
                  </select>
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <strong>Ciudad</strong>
                  <input
                    type="text"
                    value={formData['Ciudad'] || ''}
                    onChange={e => handleChange('Ciudad', e.target.value)}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <strong>Años</strong>
                  <input
                    type="text"
                    value={formData['Años'] || ''}
                    onChange={e => handleChange('Años', e.target.value)}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <strong>Concepto</strong>
                  <input
                    type="text"
                    value={formData['Concepto'] || ''}
                    onChange={e => handleChange('Concepto', e.target.value)}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <strong>Monto</strong>
                  <input
                    type="text"
                    value={formData['Monto'] || ''}
                    onChange={e => handleChange('Monto', e.target.value)}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <strong>Nota</strong>
                  <input
                    type="text"
                    value={formData['Nota'] || ''}
                    onChange={e => handleChange('Nota', e.target.value)}
                  />
                </label>
                <label htmlFor={`${fieldId}-compania`} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <strong>Compañía</strong>
                  <SelectorCompania
                    id={`${fieldId}-compania`}
                    companias={companies}
                    cargando={loading}
                    value={formData['Sigla Compañía']}
                    onChange={v => handleChange('Sigla Compañía', v)}
                  />
                </label>
              </>
            )}

            {error && <div id={errorId} role="alert" style={{ color: '#ff4d4f', background: 'rgba(255,77,79,0.1)', padding: '0.8rem', borderRadius: '4px', textAlign: 'center', fontSize: '0.95rem' }}>{error}</div>}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                style={{ padding: '0.5rem 1.2rem', background: '#e0e0e0', color: '#333', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                style={{ padding: '0.5rem 1.2rem', background: 'var(--primary-color)', color: 'var(--on-primary)', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                {saving ? 'Guardando...' : 'Crear Registro'}
              </button>
            </div>

          </form>
        )}
      </Modal>
      {confirmDiscard && (
        <ConfirmModal
          title="Descartar cambios"
          message="Hay cambios sin guardar. ¿Desea cerrar el formulario y descartarlos?"
          confirmText="Descartar"
          cancelText="Seguir editando"
          onConfirm={() => { setConfirmDiscard(false); onClose(); }}
          onCancel={() => setConfirmDiscard(false)}
        />
      )}
    </>
  );
}
