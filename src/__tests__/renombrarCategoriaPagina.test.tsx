import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react';

const permiso = vi.hoisted(() => ({ canEdit: false }));
const colecciones: Record<string, any[]> = {
  indicadores: [
    { id: 'i1', 'Indicador de registro': 1, 'Categorías': 'Pan' },
    { id: 'i2', 'Indicador de registro': 2, 'Categorías': 'Pan' },
    { id: 'i3', 'Indicador de registro': 3, 'Categorías': 'Vino' },
  ],
};

const renombrar = vi.hoisted(() => vi.fn());
vi.mock('../utils/renombrarCategoria', async (orig) => ({
  ...(await orig<typeof import('../utils/renombrarCategoria')>()),
  renombrarCategoria: (...a: unknown[]) => renombrar(...a),
}));
vi.mock('../firebase', () => ({ db: {} }));
vi.mock('../utils/audit', () => ({ logAction: vi.fn() }));
vi.mock('../hooks/useCanEdit', () => ({ useCanEdit: () => permiso.canEdit }));
vi.mock('react-router', () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/x', search: '', state: null }),
}));
vi.mock('../context/AdminContext', () => ({ useAdmin: () => ({ isEditMode: false }) }));
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, n: string) => n,
  query: (n: string) => n,
  where: vi.fn(), doc: vi.fn(), deleteDoc: vi.fn(), updateDoc: vi.fn(), addDoc: vi.fn(), writeBatch: vi.fn(),
  getDocs: async (n: string) => ({ docs: (colecciones[n] ?? []).map(d => ({ id: d.id, data: () => d })) }),
}));

import Indicadores from '../pages/Indicadores';
import { RenombreParcialError } from '../utils/renombrarCategoria';

afterEach(() => { cleanup(); renombrar.mockReset(); });

describe('Indicadores: botón Renombrar', () => {
  it('no aparece sin permiso de edición', async () => {
    permiso.canEdit = false;
    render(<Indicadores />);
    await screen.findAllByRole('button', { name: 'LISTA' });
    expect(screen.queryByRole('button', { name: /Renombrar/ })).toBeNull();
  });
  it('aparece con permiso de edición', async () => {
    permiso.canEdit = true;
    render(<Indicadores />);
    expect((await screen.findAllByRole('button', { name: /Renombrar/ })).length).toBe(2);
  });

  const abrir = async () => {
    permiso.canEdit = true;
    render(<Indicadores />);
    fireEvent.click((await screen.findAllByRole('button', { name: 'Renombrar la categoría Pan' }))[0]);
    const campo = await screen.findByLabelText('Nombre nuevo');
    fireEvent.change(campo, { target: { value: 'Panes' } });
    fireEvent.click(screen.getByRole('button', { name: 'Renombrar', hidden: true }));
  };

  it('onRenombrada actualiza la lista, el filtro y el detalle', async () => {
    renombrar.mockResolvedValue(2);
    permiso.canEdit = true;
    render(<Indicadores />);
    const filtro = await screen.findByRole('combobox', { name: 'Filtrar por categoría' }) as HTMLSelectElement;
    fireEvent.change(filtro, { target: { value: 'Pan' } });
    fireEvent.click(screen.getByRole('button', { name: 'Renombrar la categoría Pan' }));
    fireEvent.change(await screen.findByLabelText('Nombre nuevo'), { target: { value: 'Panes' } });
    fireEvent.click(screen.getByRole('button', { name: 'Renombrar', hidden: true }));
    await waitFor(() => expect(filtro.value).toBe('Panes'));
    expect(screen.queryByLabelText('Nombre nuevo')).toBeNull();
    const fila = screen.getByRole('cell', { name: 'Panes' }).closest('tr') as HTMLElement;
    fireEvent.click(within(fila).getByRole('button', { name: 'LISTA' }));
    expect(await screen.findByText('2 transacciones registradas')).toBeTruthy();
  });

  it('onParcial actualiza solo los registros ya cambiados y deja abierta la ventana', async () => {
    renombrar.mockRejectedValue(new RenombreParcialError(['i1'], new Error('x')));
    await abrir();
    expect((await screen.findByRole('alert', { hidden: true })).textContent).toContain('Se renombraron 1 de 2 registros');
    expect(screen.getByLabelText('Nombre nuevo')).toBeTruthy();
    const categorias = screen.getAllByRole('cell', { hidden: true }).map(c => c.textContent);
    expect(categorias).toContain('Panes');
    expect(categorias).toContain('Pan');
  });
});
