import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import Documentos from '../pages/Documentos';
import Transacciones from '../pages/Transacciones';

const colecciones: Record<string, any[]> = {
  documentos: [
    { id: 'd1', Doc: 1, Documento: 'Carta de García sobre el carro' },
    { id: 'd2', Doc: 2, Documento: 'Recibo de tela' },
    { id: 'd3', Doc: 12, Documento: 'Inventario' },
  ],
  transacciones: [
    { id: 't1', Num: 1, Noticia: 'Pago a García', 'Fuentes para la generación del dato': 'ALP', Doc1: 5 },
    { id: 't2', Num: 2, Noticia: 'Compra de tela', 'Fuentes para la generación del dato': 'AGI', Doc10: 15 },
    { id: 't3', Num: 12, Noticia: 'Alquiler', 'Fuentes para la generación del dato': 'Legajo' },
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
const estado = vi.hoisted(() => ({ isAdmin: false, isEditMode: false }));
vi.mock('../context/AdminContext', () => ({ useAdmin: () => ({ isAdmin: estado.isAdmin, isEditMode: estado.isEditMode }) }));

function filtrar(categoria: string, texto: string) {
  fireEvent.change(screen.getByRole('combobox'), { target: { value: categoria } });
  fireEvent.change(screen.getByPlaceholderText('Añadir filtro...'), { target: { value: texto } });
  fireEvent.click(screen.getAllByRole('button', { name: 'Buscar' })[0]);
}

describe('buscadores de administración', () => {
  afterEach(() => { cleanup(); estado.isAdmin = false; estado.isEditMode = false; });
  it('Documentos reduce la tabla al filtrar y muestra el conteo', async () => {
    render(<Documentos />);
    await waitFor(() => expect(screen.getByText('Mostrando 3 de 3 registros')).toBeTruthy());
    filtrar('all', 'garcia');
    expect(screen.getByText('Mostrando 1 de 3 registros')).toBeTruthy();
    expect(screen.queryByText('Recibo de tela')).toBeNull();
    filtrar('doc', '99');
    expect(screen.getByText('No se encontraron registros con los filtros aplicados.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar' }));
    expect(screen.getByText('Mostrando 3 de 3 registros')).toBeTruthy();
  });

  it('Documentos: «doc» es exacto y el texto libre es «contiene»', async () => {
    render(<Documentos />);
    await waitFor(() => expect(screen.getByText('Mostrando 3 de 3 registros')).toBeTruthy());
    filtrar('doc', '1');
    expect(screen.getByText('Mostrando 1 de 3 registros')).toBeTruthy();
    expect(screen.getByText('Carta de García sobre el carro')).toBeTruthy();
    expect(screen.queryByText('Inventario')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar' }));
    filtrar('all', 'tela');
    expect(screen.getByText('Mostrando 1 de 3 registros')).toBeTruthy();
    expect(screen.getByText('Recibo de tela')).toBeTruthy();
  });

  it('Transacciones reduce la tabla al filtrar por documento vinculado', async () => {
    render(<Transacciones />);
    await waitFor(() => expect(screen.getByText('Mostrando 3 de 3 registros')).toBeTruthy());
    filtrar('doc', '5');
    expect(screen.getByText('Mostrando 1 de 3 registros')).toBeTruthy();
    expect(screen.queryByText('Compra de tela')).toBeNull();
    expect(screen.queryByText('Alquiler')).toBeNull();
  });

  it('Transacciones: Doc10 se encuentra, y «Doc 15» no trae el 5', async () => {
    render(<Transacciones />);
    await waitFor(() => expect(screen.getByText('Mostrando 3 de 3 registros')).toBeTruthy());
    filtrar('doc', 'Doc 15');
    expect(screen.getByText('Mostrando 1 de 3 registros')).toBeTruthy();
    expect(screen.getByText('Compra de tela')).toBeTruthy();
    expect(screen.queryByText('Pago a García')).toBeNull();
  });

  it('Transacciones: num exacto, noticia y fuentes', async () => {
    render(<Transacciones />);
    await waitFor(() => expect(screen.getByText('Mostrando 3 de 3 registros')).toBeTruthy());
    filtrar('num', '2');
    expect(screen.getByText('Mostrando 1 de 3 registros')).toBeTruthy();
    expect(screen.getByText('Compra de tela')).toBeTruthy();
    expect(screen.queryByText('Alquiler')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar' }));
    filtrar('noticia', 'garcia');
    expect(screen.getByText('Mostrando 1 de 3 registros')).toBeTruthy();
    expect(screen.getByText('Pago a García')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar' }));
    filtrar('fuentes', 'legajo');
    expect(screen.getByText('Mostrando 1 de 3 registros')).toBeTruthy();
    expect(screen.getByText('Alquiler')).toBeTruthy();
    expect(screen.queryByText('Pago a García')).toBeNull();
  });

  it('un administrador ve «Nuevo registro», Editar y Borrar junto al buscador sin activar el modo edición', async () => {
    estado.isAdmin = true;
    estado.isEditMode = false;
    for (const Pagina of [Documentos, Transacciones]) {
      const { unmount } = render(<Pagina />);
      await waitFor(() => expect(screen.getByText('Mostrando 3 de 3 registros')).toBeTruthy());
      expect(screen.getByRole('button', { name: 'Nuevo registro' })).toBeTruthy();
      expect(screen.getByPlaceholderText('Añadir filtro...')).toBeTruthy();
      expect(screen.getAllByRole('button', { name: 'Editar' }).length).toBe(3);
      expect(screen.getAllByRole('button', { name: 'Borrar' }).length).toBe(3);
      unmount();
    }
  });

  it('sin ser administrador no hay controles de carga aunque el modo edición esté forzado', async () => {
    estado.isAdmin = false;
    estado.isEditMode = true;
    for (const Pagina of [Documentos, Transacciones]) {
      const { unmount } = render(<Pagina />);
      await waitFor(() => expect(screen.getByText('Mostrando 3 de 3 registros')).toBeTruthy());
      expect(screen.queryByRole('button', { name: 'Nuevo registro' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Editar' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Borrar' })).toBeNull();
      expect(screen.queryByRole('columnheader', { name: 'Admin' })).toBeNull();
      expect(screen.queryByText('Solo editores')).toBeNull();
      unmount();
    }
  });
});
