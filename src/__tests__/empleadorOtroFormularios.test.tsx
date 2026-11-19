import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import GenericCreateModal from '../components/GenericCreateModal';
import GenericEditModal from '../components/GenericEditModal';

const colecciones: Record<string, any[]> = {
  companias: [{ id: 'c1', 'Indicador de registro': 7, 'Sigla Compañía': 'GA-JR', Autores: 'Alarcón' }],
  transacciones: [{ id: 't1', Num: 3, Noticia: 'Pago' }],
  documentos: [],
  salarios: [],
};

const setDocMock = vi.hoisted(() => vi.fn());
vi.mock('../firebase', () => ({ db: {} }));
vi.mock('../utils/audit', () => ({ logAction: vi.fn() }));
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, nombre: string) => nombre,
  query: (c: string) => c,
  doc: (coleccion: string) => ({ id: 'nuevo', coleccion }),
  setDoc: (...a: unknown[]) => setDocMock(...a),
  getDocs: async (nombre: string) => ({ docs: (colecciones[nombre] ?? []).map(d => ({ id: d.id, data: () => d })) }),
}));

beforeEach(() => setDocMock.mockReset().mockResolvedValue(undefined));
afterEach(cleanup);

async function abrirAlta() {
  render(<GenericCreateModal collectionName="salarios" onClose={vi.fn()} onCreated={vi.fn()} />);
  await waitFor(() => expect(screen.queryByText('Cargando opciones...')).toBeNull());
  return document.querySelector('form') as HTMLFormElement;
}
const escribir = (rotulo: string | RegExp, valor: string) =>
  fireEvent.change(screen.getByLabelText(rotulo), { target: { value: valor } });
const elegirTransaccion = () => {
  const sel = screen.getAllByRole('combobox').find((s) => (s as HTMLSelectElement).options[1]?.textContent?.startsWith('Transacción')) as HTMLSelectElement;
  fireEvent.change(sel, { target: { value: '3' } });
};

describe('alta de Remuneraciones: empleador «otro»', () => {
  it('elegir «Otro» oculta el selector y muestra los tres campos', async () => {
    await abrirAlta();
    expect(screen.getByLabelText('Sigla de la compañía (obligatorio)')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Otro (escrito a mano)'));
    expect(screen.queryByLabelText('Sigla de la compañía (obligatorio)')).toBeNull();
    expect(screen.getByLabelText('Nombre del empleador (obligatorio)')).toBeTruthy();
    expect(screen.getByLabelText('Temporadas teatrales (obligatorio)')).toBeTruthy();
    expect(screen.getByLabelText(/^Ámbito \(obligatorio/)).toBeTruthy();
  });

  it('guardar sin nombre marca el campo y muestra el mensaje', async () => {
    const form = await abrirAlta();
    fireEvent.click(screen.getByLabelText('Otro (escrito a mano)'));
    elegirTransaccion();
    fireEvent.submit(form);
    await screen.findByText('Debe escribir el nombre del empleador.');
    expect(screen.getByLabelText('Nombre del empleador (obligatorio)').getAttribute('aria-invalid')).toBe('true');
    expect(setDocMock).not.toHaveBeenCalled();
  });

  it('completo (con «desconocido») guarda la sigla null y los textos recortados', async () => {
    const form = await abrirAlta();
    fireEvent.click(screen.getByLabelText('Otro (escrito a mano)'));
    escribir('Nombre del empleador (obligatorio)', '  Pepito   Pérez ');
    escribir('Temporadas teatrales (obligatorio)', '1615');
    escribir(/^Ámbito \(obligatorio/, 'desconocido');
    escribir('Beneficiario', 'Ana');
    elegirTransaccion();
    fireEvent.submit(form);
    await waitFor(() => expect(setDocMock).toHaveBeenCalled());
    const g = setDocMock.mock.calls[0][1];
    expect(g['Sigla Compañía']).toBeNull();
    expect(g['Empleador']).toBe('Pepito Pérez');
    expect(g['Temporadas teatrales']).toBe('1615');
    expect(g['Ámbito']).toBe('desconocido');
  });

  it('en modo compañía no se guardan las claves «otro»', async () => {
    const form = await abrirAlta();
    fireEvent.click(screen.getByLabelText('Otro (escrito a mano)'));
    escribir('Nombre del empleador (obligatorio)', 'Pepito');
    fireEvent.click(screen.getByLabelText('Compañía de la lista'));
    fireEvent.change(screen.getByLabelText('Sigla de la compañía (obligatorio)'), { target: { value: '7' } });
    escribir('Beneficiario', 'Ana');
    elegirTransaccion();
    fireEvent.submit(form);
    await waitFor(() => expect(setDocMock).toHaveBeenCalled());
    const g = setDocMock.mock.calls[0][1];
    expect(g['Sigla Compañía']).toBe(7);
    expect('Empleador' in g).toBe(false);
    expect('Ámbito' in g).toBe(false);
  });
});

describe('edición de Remuneraciones: empleador «otro»', () => {
  async function abrirEdicion(record: any) {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<GenericEditModal collectionName="salarios" record={record} onSave={onSave} onClose={vi.fn()} />);
    await waitFor(() => expect((screen.getByRole('button', { name: 'Guardar cambios' }) as HTMLButtonElement).disabled).toBe(false));
    await act(async () => { await Promise.resolve(); });
    return onSave;
  }
  const otro = { id: 'r1', 'Indicador de registro': 1, 'Sigla Compañía': null, Empleador: 'Pepito', 'Temporadas teatrales': '1615', 'Ámbito': 'España', 'Beneficiario ': 'Ana' };

  it('un registro «otro» abre con el radio «Otro» y sus valores', async () => {
    await abrirEdicion(otro);
    expect((screen.getByLabelText('Otro (escrito a mano)') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText('Nombre del empleador (obligatorio)') as HTMLInputElement).value).toBe('Pepito');
    expect((screen.getByLabelText('Temporadas teatrales (obligatorio)') as HTMLInputElement).value).toBe('1615');
  });

  it('pasar a compañía anula los tres campos y guarda la sigla', async () => {
    const onSave = await abrirEdicion(otro);
    fireEvent.click(screen.getByLabelText('Compañía de la lista'));
    await screen.findByRole('option', { name: /GA-JR/ });
    fireEvent.change(screen.getByLabelText('Sigla de la compañía (obligatorio)'), { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const g = onSave.mock.calls[0][0];
    expect(g['Sigla Compañía']).toBe(7);
    expect(g['Empleador']).toBeNull();
    expect(g['Temporadas teatrales']).toBeNull();
    expect(g['Ámbito']).toBeNull();
  });

  it('pasar a «otro» sin nombre no guarda y muestra el error', async () => {
    const onSave = await abrirEdicion({ id: 'r2', 'Indicador de registro': 2, 'Sigla Compañía': 7, 'Beneficiario ': 'Ana' });
    fireEvent.click(screen.getByLabelText('Otro (escrito a mano)'));
    // La validación nativa («required») frena el clic; se envía el formulario para probar la validación propia.
    fireEvent.submit(document.querySelector('form') as HTMLFormElement);
    await screen.findByText('Debe escribir el nombre del empleador.');
    expect(onSave).not.toHaveBeenCalled();
  });

  it('con la compañía en «Ninguna» exige elegir una', async () => {
    const onSave = await abrirEdicion({ id: 'r3', 'Indicador de registro': 3, 'Sigla Compañía': 7, 'Beneficiario ': 'Ana' });
    fireEvent.change(screen.getByLabelText('Sigla de la compañía (obligatorio)'), { target: { value: '' } });
    // La validación nativa («required») frena el clic; se envía el formulario para probar la validación propia.
    fireEvent.submit(document.querySelector('form') as HTMLFormElement);
    await screen.findByText('Debe elegir una compañía existente.');
    expect(onSave).not.toHaveBeenCalled();
  });
});
