import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import GenericCreateModal from '../components/GenericCreateModal';

const colecciones: Record<string, any[]> = {
  bibliografia: [],
  documentos: [{ id: 'd1', Doc: 4, Documento: 'x' }],
  companias: [], transacciones: [], manejo_de_caja: [], salarios: [], indicadores: [], corpus_christi: [],
};

const setDoc = vi.hoisted(() => vi.fn());
const docMock = vi.hoisted(() => vi.fn());
const getDocs = vi.hoisted(() => vi.fn());
const logAction = vi.hoisted(() => vi.fn());
vi.mock('../firebase', () => ({ db: {} }));
vi.mock('../utils/audit', () => ({ logAction: (...a: unknown[]) => logAction(...a) }));
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, nombre: string) => nombre,
  query: (c: string) => c,
  doc: (...a: unknown[]) => docMock(...a),
  setDoc: (...a: unknown[]) => setDoc(...a),
  getDocs: (nombre: string) => getDocs(nombre),
}));

let contadorIds = 0;
beforeEach(() => {
  contadorIds = 0;
  setDoc.mockReset().mockResolvedValue(undefined);
  // Cada llamada a doc() devuelve un ID distinto: si el componente la repite, la prueba lo detecta.
  docMock.mockReset().mockImplementation((coleccion: string) => ({ id: `id-${++contadorIds}`, coleccion }));
  getDocs.mockReset().mockImplementation(async (nombre: string) => ({
    docs: colecciones[nombre].map(d => ({ id: d.id, data: () => d })),
  }));
  logAction.mockReset().mockResolvedValue(undefined);
});
afterEach(cleanup);

async function abrirAlta(coleccion: string) {
  const onCreated = vi.fn();
  const onClose = vi.fn();
  render(<GenericCreateModal collectionName={coleccion} onClose={onClose} onCreated={onCreated} />);
  await waitFor(() => expect(screen.queryByText('Cargando opciones...')).toBeNull());
  return { form: document.querySelector('form') as HTMLFormElement, onCreated, onClose };
}

function llenarBibliografia() {
  fireEvent.change(screen.getByPlaceholderText('Autores del documento...'), { target: { value: 'Ana' } });
  fireEvent.change(screen.getByPlaceholderText('Detalles bibliográficos...'), { target: { value: 'Ref 1' } });
}

describe('alta idempotente', () => {
  it('dos envíos seguidos inmediatos producen una sola escritura', async () => {
    let terminar: () => void = () => {};
    setDoc.mockReturnValue(new Promise<void>(res => { terminar = res; }));
    const { form, onClose, onCreated } = await abrirAlta('bibliografia');
    llenarBibliografia();
    fireEvent.submit(form);
    fireEvent.submit(form);
    terminar();
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(setDoc).toHaveBeenCalledTimes(1);
    expect(logAction).toHaveBeenCalledTimes(1);
    expect(onCreated).toHaveBeenCalledTimes(1);
  });

  it('si setDoc falla, el reintento usa el mismo ID y el mismo registro; onCreated una sola vez', async () => {
    setDoc.mockRejectedValueOnce(new Error('sin red'));
    const { form, onClose, onCreated } = await abrirAlta('bibliografia');
    llenarBibliografia();
    fireEvent.submit(form);
    expect(await screen.findByText('sin red')).toBeTruthy();
    expect(onCreated).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.submit(form);
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(setDoc).toHaveBeenCalledTimes(2);
    expect(setDoc.mock.calls[1][0]).toBe(setDoc.mock.calls[0][0]);
    expect(setDoc.mock.calls[1][0].id).toBe('id-1');
    expect(setDoc.mock.calls[1][1]).toBe(setDoc.mock.calls[0][1]);
    expect(docMock).toHaveBeenCalledTimes(1);
    expect(onCreated).toHaveBeenCalledTimes(1);
    expect(onCreated.mock.calls[0][0].id).toBe('id-1');
  });

  it('con índice secuencial, el reintento reutiliza el registro y no vuelve a consultar ni recalcular el índice', async () => {
    setDoc.mockRejectedValueOnce(new Error('sin red'));
    const { form, onClose } = await abrirAlta('documentos');
    const consultasAlAbrir = getDocs.mock.calls.length;
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Carta' } });
    fireEvent.submit(form);
    await screen.findByText('sin red');
    // Otro usuario crea un documento mientras tanto: el índice del reintento no cambia.
    colecciones.documentos.push({ id: 'd2', Doc: 5, Documento: 'z' });
    fireEvent.submit(form);
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    colecciones.documentos.pop();
    expect(getDocs.mock.calls.length).toBe(consultasAlAbrir);
    expect(setDoc.mock.calls[0][1]).toMatchObject({ Doc: 5 });
    expect(setDoc.mock.calls[1][1]).toBe(setDoc.mock.calls[0][1]);
    expect(setDoc.mock.calls[1][0].id).toBe(setDoc.mock.calls[0][0].id);
  });

  it('si el documento ya se escribió y el cierre falla después, el reintento no escribe de nuevo', async () => {
    logAction.mockRejectedValueOnce(new Error('bitácora'));
    const { form, onClose, onCreated } = await abrirAlta('bibliografia');
    llenarBibliografia();
    fireEvent.submit(form);
    expect(await screen.findByText('bitácora')).toBeTruthy();
    expect(onCreated).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.submit(form);
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(setDoc).toHaveBeenCalledTimes(1);
    expect(logAction).toHaveBeenCalledTimes(2);
    expect(onCreated).toHaveBeenCalledTimes(1);
  });

  it('el alta con logAction resuelto escribe una vez y cierra', async () => {
    const { form, onClose } = await abrirAlta('bibliografia');
    llenarBibliografia();
    fireEvent.submit(form);
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(setDoc).toHaveBeenCalledTimes(1);
    expect(logAction).toHaveBeenCalledTimes(1);
  });
});
