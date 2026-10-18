import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react';
import CorpusChristi from '../pages/CorpusChristi';
import Indicadores from '../pages/Indicadores';

const colecciones: Record<string, any[]> = {
  corpus_christi: [
    { id: 'a', 'Indicador de registro': 1, Ciudad: 'Potosí', 'Año': 1600 },
    { id: 'b', 'Indicador de registro': 2, Ciudad: 'Lima', 'Año': 1610 },
    { id: 'c', 'Indicador de registro': 3, Ciudad: 'Quito', 'Año': 1620 },
  ],
  indicadores: [
    { id: 'i1', 'Indicador de registro': 1, 'Categorías': 'Pan' },
    { id: 'i2', 'Indicador de registro': 2, 'Categorías': 'Aceite' },
    { id: 'i3', 'Indicador de registro': 3, 'Categorías': 'Cera' },
  ],
  companias: [],
  transacciones: [],
};

vi.mock('../firebase', () => ({ db: {} }));
vi.mock('../utils/audit', () => ({ logAction: vi.fn() }));
vi.mock('react-router', () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/x', search: '', state: null }),
}));
vi.mock('../context/AdminContext', () => ({ useAdmin: () => ({ isEditMode: false }) }));
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, nombre: string) => nombre,
  query: (nombre: string) => nombre,
  where: vi.fn(), doc: vi.fn(), deleteDoc: vi.fn(), updateDoc: vi.fn(), addDoc: vi.fn(),
  getDocs: async (nombre: string) => ({
    docs: (colecciones[nombre] ?? []).map(d => ({ id: d.id, data: () => d })),
  }),
}));

afterEach(cleanup);

const primeraColumna = () =>
  screen.getAllByRole('row').slice(1).map(r => within(r).getAllByRole('cell')[0].textContent);

describe('Corpus Christi: la tabla de grupos ordena por Ciudad', () => {
  it('ordena en ambos sentidos y marca aria-sort', async () => {
    render(<CorpusChristi />);
    await screen.findByRole('cell', { name: 'Potosí' });
    fireEvent.click(screen.getByRole('button', { name: /^Ciudad/ }));
    expect(primeraColumna()).toEqual(['Lima', 'Potosí', 'Quito']);
    expect(screen.getByRole('columnheader', { name: /^Ciudad/ }).getAttribute('aria-sort')).toBe('ascending');
    fireEvent.click(screen.getByRole('button', { name: /^Ciudad/ }));
    expect(primeraColumna()).toEqual(['Quito', 'Potosí', 'Lima']);
    expect(screen.getByRole('columnheader', { name: /^Ciudad/ }).getAttribute('aria-sort')).toBe('descending');
  });
});

describe('Indicadores: la tabla de categorías ordena por Categoría', () => {
  it('ordena en ambos sentidos y marca aria-sort', async () => {
    render(<Indicadores />);
    await screen.findByRole('cell', { name: 'Pan' });
    fireEvent.click(screen.getByRole('button', { name: /^Categoría/ }));
    expect(primeraColumna()).toEqual(['Aceite', 'Cera', 'Pan']);
    expect(screen.getByRole('columnheader', { name: /^Categoría/ }).getAttribute('aria-sort')).toBe('ascending');
    fireEvent.click(screen.getByRole('button', { name: /^Categoría/ }));
    expect(primeraColumna()).toEqual(['Pan', 'Cera', 'Aceite']);
    expect(screen.getByRole('columnheader', { name: /^Categoría/ }).getAttribute('aria-sort')).toBe('descending');
  });
});
