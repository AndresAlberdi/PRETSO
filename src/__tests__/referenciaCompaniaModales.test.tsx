import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import GenericCreateModal from '../components/GenericCreateModal';
import GenericEditModal from '../components/GenericEditModal';

const colecciones: Record<string, any[]> = {
  companias: [
    { id: 'c1', 'Indicador de registro': 7, 'Sigla Compañía': 'GA-JR', Autores: 'Alarcón y Ramírez' },
    { id: 'c2', 'Indicador de registro': 12.0, 'Sigla Compañía': 'JG', Autores: 'Juan' },
  ],
  transacciones: [{ id: 't1', Num: 3, Noticia: 'Pago' }],
  documentos: [],
  manejo_de_caja: [], salarios: [], indicadores: [{ id: 'i0', 'Indicador de registro': 4, 'Categorías': 'Deuda' }],
  corpus_christi: [{ id: 'k0', 'Indicador de registro': 2, Ciudad: 'Potosí', 'Año': 1600 }],
};

const addDoc = vi.hoisted(() => vi.fn());
vi.mock('../firebase', () => ({ db: {} }));
vi.mock('../utils/audit', () => ({ logAction: vi.fn() }));
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, nombre: string) => nombre,
  query: (c: string) => c,
  addDoc: (...a: unknown[]) => addDoc(...a),
  getDocs: async (nombre: string) => ({
    docs: colecciones[nombre].map(d => ({ id: d.id, data: () => d })),
  }),
}));

beforeEach(() => addDoc.mockReset().mockResolvedValue({ id: 'nuevo' }));
afterEach(cleanup);

async function abrirAlta(coleccion: string) {
  const onCreated = vi.fn();
  const { container } = render(<GenericCreateModal collectionName={coleccion} onClose={vi.fn()} onCreated={onCreated} />);
  await waitFor(() => expect(screen.queryByText('Cargando opciones...')).toBeNull());
  return { form: container.querySelector('form') as HTMLFormElement, onCreated };
}

describe('alta: la compañía se guarda por número de registro', () => {
  it('Manejo de Caja guarda el número (tipo numérico) y muestra «sigla - autores»', async () => {
    const { form } = await abrirAlta('manejo_de_caja');
    expect(screen.getByRole('option', { name: 'JG - Juan' })).toBeTruthy();
    const [selCompania, selTransaccion] = screen.getAllByRole('combobox');
    // Valor por defecto: la primera compañía, por número
    expect((selCompania as HTMLSelectElement).value).toBe('7');
    fireEvent.change(selCompania, { target: { value: '12' } });
    fireEvent.change(selTransaccion, { target: { value: '3' } });
    fireEvent.submit(form);
    await waitFor(() => expect(addDoc).toHaveBeenCalled());
    const guardado = addDoc.mock.calls[0][1];
    expect(guardado['Sigla Compañía']).toBe(12);
    expect(typeof guardado['Sigla Compañía']).toBe('number');
  });

  it('Remuneraciones guarda el número por defecto', async () => {
    const { form } = await abrirAlta('salarios');
    const [, selTransaccion] = screen.getAllByRole('combobox');
    fireEvent.change(selTransaccion, { target: { value: '3' } });
    fireEvent.submit(form);
    await waitFor(() => expect(addDoc).toHaveBeenCalled());
    expect(addDoc.mock.calls[0][1]['Sigla Compañía']).toBe(7);
  });

  it('Indicadores guarda el número elegido', async () => {
    const { form } = await abrirAlta('indicadores');
    const combos = screen.getAllByRole('combobox') as HTMLSelectElement[];
    const selCompania = combos.find(s => Array.from(s.options).some(o => o.text === 'GA-JR - Alarcón y Ramírez'))!;
    const selTransaccion = combos.find(s => Array.from(s.options).some(o => o.text.startsWith('Transacción 3')))!;
    fireEvent.change(selCompania, { target: { value: '7' } });
    fireEvent.change(selTransaccion, { target: { value: '3' } });
    fireEvent.submit(form);
    await waitFor(() => expect(addDoc).toHaveBeenCalled());
    const guardado = addDoc.mock.calls[0][1];
    expect(guardado['Sigla Compañía']).toBe(7);
    expect(typeof guardado['Sigla Compañía']).toBe('number');
  });

  it('Corpus Christi guarda la compañía principal por número', async () => {
    const { form } = await abrirAlta('corpus_christi');
    const combos = screen.getAllByRole('combobox') as HTMLSelectElement[];
    const selCompania = combos.find(s => Array.from(s.options).some(o => o.text === 'JG - Juan'))!;
    const selTransaccion = combos.find(s => Array.from(s.options).some(o => o.text.startsWith('Transacción 3')))!;
    fireEvent.change(selCompania, { target: { value: '12' } });
    fireEvent.change(selTransaccion, { target: { value: '3' } });
    fireEvent.submit(form);
    await waitFor(() => expect(addDoc).toHaveBeenCalled());
    expect(addDoc.mock.calls[0][1]['Compañía']).toBe(12);
  });
});

describe('edición: la compañía es un selector', () => {
  async function abrirEdicion(coleccion: string, record: any) {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<GenericEditModal collectionName={coleccion} record={record} onSave={onSave} onClose={vi.fn()} />);
    const selector = (await screen.findByLabelText('Compañía')) as HTMLSelectElement;
    await waitFor(() => expect(selector.options.length).toBeGreaterThan(2));
    return { onSave, selector };
  }

  it('muestra el selector con el valor actual y guarda el número elegido', async () => {
    const { onSave, selector } = await abrirEdicion('manejo_de_caja', { id: 'r1', 'Indicador de registro': 1, 'Sigla Compañía': 7.0 });
    expect(selector.tagName).toBe('SELECT');
    expect(selector.value).toBe('7');
    fireEvent.change(selector, { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar Cambios' }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0][0]['Sigla Compañía']).toBe(12);
  });

  it('conserva un valor sin resolver si no se cambia', async () => {
    const { onSave, selector } = await abrirEdicion('salarios', { id: 'r2', 'Sigla Compañía': 'ZZ' });
    expect(screen.getByRole('option', { name: '(sin resolver: ZZ)' })).toBeTruthy();
    expect(selector.value).toBe('ZZ');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar Cambios' }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0][0]['Sigla Compañía']).toBe('ZZ');
  });

  it('no cambia el campo Sigla Compañía de la colección companias (texto libre)', async () => {
    render(<GenericEditModal collectionName="companias" record={{ id: 'c1', 'Indicador de registro': 7, 'Sigla Compañía': 'GA-JR' }} onSave={vi.fn()} onClose={vi.fn()} />);
    expect(screen.queryByRole('combobox')).toBeNull();
    expect((screen.getByDisplayValue('GA-JR') as HTMLInputElement).tagName).toBe('INPUT');
  });

  it('Corpus Christi: los campos de compañía son selectores', async () => {
    const { selector } = await abrirEdicion('corpus_christi', { id: 'r3', Ciudad: 'Potosí', 'Compañía': 12.0 });
    expect(selector.value).toBe('12');
  });
});
