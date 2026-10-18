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

  it('si setDoc falla y el usuario corrige, el reintento usa el mismo ID y guarda la corrección; onCreated una sola vez', async () => {
    setDoc.mockRejectedValueOnce(new Error('sin red'));
    const { form, onClose, onCreated } = await abrirAlta('bibliografia');
    llenarBibliografia();
    fireEvent.submit(form);
    expect(await screen.findByText('sin red')).toBeTruthy();
    expect(onCreated).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.change(screen.getByPlaceholderText('Autores del documento...'), { target: { value: 'Ana B' } });
    fireEvent.submit(form);
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(setDoc).toHaveBeenCalledTimes(2);
    expect(setDoc.mock.calls[1][0]).toBe(setDoc.mock.calls[0][0]);
    expect(setDoc.mock.calls[1][0].id).toBe('id-1');
    expect(setDoc.mock.calls[0][1].Autores).toBe('Ana');
    expect(setDoc.mock.calls[1][1].Autores).toBe('Ana B');
    expect(docMock).toHaveBeenCalledTimes(1);
    expect(logAction).toHaveBeenCalledTimes(1);
    expect(onCreated).toHaveBeenCalledTimes(1);
    expect(onCreated.mock.calls[0][0]).toMatchObject({ id: 'id-1', Autores: 'Ana B' });
  });

  it('un reintento tras un error de validación escribe una sola vez', async () => {
    const { form, onClose } = await abrirAlta('bibliografia');
    fireEvent.change(screen.getByPlaceholderText('Autores del documento...'), { target: { value: '  ' } });
    fireEvent.change(screen.getByPlaceholderText('Detalles bibliográficos...'), { target: { value: 'Ref 1' } });
    fireEvent.submit(form);
    expect(await screen.findByText("Debe completar el campo 'Autores'.")).toBeTruthy();
    expect(setDoc).not.toHaveBeenCalled();
    fireEvent.change(screen.getByPlaceholderText('Autores del documento...'), { target: { value: 'Ana' } });
    fireEvent.submit(form);
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(setDoc).toHaveBeenCalledTimes(1);
    expect(setDoc.mock.calls[0][1].Autores).toBe('Ana');
  });

  it('con índice secuencial, el reintento conserva el índice y no vuelve a consultar ni recalcular el índice', async () => {
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
    expect(setDoc.mock.calls[1][1]).toMatchObject({ Doc: 5 });
    expect(setDoc.mock.calls[1][0].id).toBe(setDoc.mock.calls[0][0].id);
  });

  it.each(['onCreated', 'onClose'])('si %s lanza tras escribir, el mensaje dice que ya se guardó y el reintento no repite escritura ni auditoría', async (cual) => {
    const { form, onClose, onCreated } = await abrirAlta('bibliografia');
    (cual === 'onCreated' ? onCreated : onClose).mockImplementationOnce(() => { throw new Error('fallo del padre'); });
    llenarBibliografia();
    fireEvent.submit(form);
    expect(await screen.findByText('El registro ya se guardó; ciérrelo con «Cerrar».')).toBeTruthy();
    // Cambios posteriores no se reescriben
    fireEvent.change(screen.getByPlaceholderText('Autores del documento...'), { target: { value: 'Otro' } });
    fireEvent.submit(form);
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(cual === 'onClose' ? 2 : 1));
    expect(setDoc).toHaveBeenCalledTimes(1);
    expect(setDoc.mock.calls[0][1].Autores).toBe('Ana');
    expect(logAction).toHaveBeenCalledTimes(1);
    expect(logAction.mock.calls[0][3].Autores).toBe('Ana');
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
