import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import GenericCreateModal from '../components/GenericCreateModal';

// Pruebas de caracterización de la ruta de escritura del alta: fijan QUÉ se escribe
// (colección y registro) y cuántas veces se registra la auditoría. Son independientes de si
// la escritura se hace con addDoc o con setDoc: ambos delegan en `escribir`.
const colecciones: Record<string, any[]> = {
  bibliografia: [{ id: 'b1', Autores: 'Previo' }],
  documentos: [{ id: 'd1', Doc: 4, Documento: 'x' }, { id: 'd2', Doc: 9, Documento: 'y' }],
  companias: [], transacciones: [], manejo_de_caja: [], salarios: [], indicadores: [], corpus_christi: [],
};

const escribir = vi.hoisted(() => vi.fn());
const logAction = vi.hoisted(() => vi.fn());
vi.mock('../firebase', () => ({ db: {} }));
vi.mock('../utils/audit', () => ({ logAction: (...a: unknown[]) => logAction(...a) }));
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, nombre: string) => nombre,
  query: (c: string) => c,
  doc: (coleccion: string) => ({ id: 'id-cliente', coleccion }),
  addDoc: (coleccion: unknown, datos: unknown) => escribir(coleccion, datos),
  setDoc: (ref: { coleccion: string }, datos: unknown) => escribir(ref.coleccion, datos),
  getDocs: async (nombre: string) => ({
    docs: colecciones[nombre].map(d => ({ id: d.id, data: () => d })),
  }),
}));

beforeEach(() => {
  escribir.mockReset().mockResolvedValue({ id: 'nuevo' });
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

describe('alta: qué se escribe', () => {
  it('colección simple (bibliografía): escribe solo los campos del formulario, sin índice', async () => {
    const { form, onCreated, onClose } = await abrirAlta('bibliografia');
    fireEvent.change(screen.getByPlaceholderText('Autores del documento...'), { target: { value: 'Ana' } });
    fireEvent.change(screen.getByPlaceholderText('Detalles bibliográficos...'), { target: { value: 'Ref 1' } });
    fireEvent.submit(form);
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(escribir).toHaveBeenCalledTimes(1);
    expect(escribir.mock.calls[0][0]).toBe('bibliografia');
    expect(escribir.mock.calls[0][1]).toEqual({ Autores: 'Ana', 'Referencias bibliográficas': 'Ref 1' });
    expect(logAction).toHaveBeenCalledTimes(1);
    expect(logAction.mock.calls[0].slice(0, 2)).toEqual(['CREATE', 'bibliografia']);
    expect(onCreated).toHaveBeenCalledTimes(1);
  });

  it('colección con índice secuencial (documentos): escribe Doc = máximo + 1', async () => {
    const { form, onClose } = await abrirAlta('documentos');
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Carta' } });
    fireEvent.submit(form);
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(escribir).toHaveBeenCalledTimes(1);
    expect(escribir.mock.calls[0][0]).toBe('documentos');
    expect(escribir.mock.calls[0][1]).toMatchObject({ Doc: 10 });
    expect(logAction).toHaveBeenCalledTimes(1);
    expect(logAction.mock.calls[0].slice(0, 2)).toEqual(['CREATE', 'documentos']);
  });
});
