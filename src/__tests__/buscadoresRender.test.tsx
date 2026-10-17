import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import Documentos from '../pages/Documentos';
import Transacciones from '../pages/Transacciones';

const colecciones: Record<string, any[]> = {
  documentos: [
    { id: 'd1', Doc: 1, Documento: 'Carta de García sobre el carro' },
    { id: 'd2', Doc: 2, Documento: 'Recibo de tela' },
  ],
  transacciones: [
    { id: 't1', Num: 1, Noticia: 'Pago a García', 'Fuentes para la generación del dato': 'ALP', Doc1: 5 },
    { id: 't2', Num: 2, Noticia: 'Compra de tela', 'Fuentes para la generación del dato': 'AGI' },
  ],
};

vi.mock('../firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, nombre: string) => nombre,
  query: (c: string) => c,
  where: vi.fn(),
  doc: vi.fn(),
  deleteDoc: vi.fn(),
  updateDoc: vi.fn(),
  getDocs: async (nombre: string) => ({
    docs: colecciones[nombre].map(d => ({ id: d.id, data: () => d })),
  }),
}));
vi.mock('../context/AdminContext', () => ({ useAdmin: () => ({ isEditMode: false }) }));

function filtrar(categoria: string, texto: string) {
  fireEvent.change(screen.getByRole('combobox'), { target: { value: categoria } });
  fireEvent.change(screen.getByPlaceholderText('Añadir filtro...'), { target: { value: texto } });
  fireEvent.click(screen.getAllByRole('button', { name: 'Buscar' })[0]);
}

describe('buscadores de administración', () => {
  afterEach(cleanup);
  it('Documentos reduce la tabla al filtrar y muestra el conteo', async () => {
    render(<Documentos />);
    await waitFor(() => expect(screen.getByText('Mostrando 2 de 2 registros')).toBeTruthy());
    filtrar('all', 'garcia');
    expect(screen.getByText('Mostrando 1 de 2 registros')).toBeTruthy();
    expect(screen.queryByText('Recibo de tela')).toBeNull();
    filtrar('doc', '99');
    expect(screen.getByText('No se encontraron registros con los filtros aplicados.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar' }));
    expect(screen.getByText('Mostrando 2 de 2 registros')).toBeTruthy();
  });

  it('Transacciones reduce la tabla al filtrar por documento vinculado', async () => {
    render(<Transacciones />);
    await waitFor(() => expect(screen.getByText('Mostrando 2 de 2 registros')).toBeTruthy());
    filtrar('doc', '5');
    expect(screen.getByText('Mostrando 1 de 2 registros')).toBeTruthy();
    expect(screen.queryByText('Compra de tela')).toBeNull();
  });
});
