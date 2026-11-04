import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import IndiceCompanias from '../pages/IndiceCompanias';
import { invalidarIndice } from '../utils/busquedaGuia/cargaIndice';

const companias = [
  { id: 'c7', 'Indicador de registro': 7, 'Sigla Compañía': 'GA-JR', 'Nombre Compañía': 'Compañía de Alarcón', Autores: 'Alarcón y Ramírez' },
  { id: 'c12', 'Indicador de registro': 12, 'Sigla Compañía': 'JG', Autores: 'García' },
];

let colecciones: Record<string, any[]> = {};
const ubicacion = vi.hoisted(() => ({ search: '' }));

vi.mock('../firebase', () => ({ db: {} }));
vi.mock('../utils/audit', () => ({ logAction: vi.fn() }));
vi.mock('react-router', () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/x', search: ubicacion.search, state: null }),
  Link: ({ to, children, ...r }: any) => <a href={String(to)} {...r}>{children}</a>,
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

beforeEach(() => {
  invalidarIndice();
  ubicacion.search = '';
  colecciones = {
    companias,
    transacciones: [],
    manejo_de_caja: [
      { id: 'm1', 'Sigla Compañía': 7, Ciudad: 'Potosí', 'Año': 1600, Ingresos: 100 },
      { id: 'm2', 'Sigla Compañía': 12, Ciudad: 'Lima', 'Año': 1610, Ingresos: 50 },
    ],
    salarios: [
      { id: 's1', 'Sigla Compañía': 7, Ciudad: 'Potosí', 'Año': 1600, 'Beneficiario ': 'Pedro Gómez' },
      { id: 's2', 'Sigla Compañía': 12, Ciudad: 'Lima', 'Año': 1610, 'Beneficiario ': 'Ana Ruiz' },
    ],
    corpus_christi: [
      { id: 'a', 'Indicador de registro': 1, Ciudad: 'Potosí', 'Año': 1600, 'Encargado ': 'Luis' },
      { id: 'b', 'Indicador de registro': 2, Ciudad: 'Lima', 'Año': 1610, 'Encargado ': 'Marta' },
    ],
    indicadores: [
      { id: 'i1', 'Indicador de registro': 1, 'Categorías': 'Pan' },
      { id: 'i2', 'Indicador de registro': 2, 'Categorías': 'Aceite' },
      { id: 'i3', 'Indicador de registro': 3, 'Categorías': 'Cera' },
    ],
    bibliografia: [], documentos: [],
  };
});
afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

const region = () => document.querySelector('output.visually-hidden') as HTMLElement;

describe('Índice de compañías: anuncio de la búsqueda guiada', () => {
  it('anuncia el total al terminar de buscar, sin retraso fijo, y se vacía al limpiar', async () => {
    ubicacion.search = '?q=garc';
    render(<IndiceCompanias />);
    await screen.findByText('Búsqueda: 1 compañía encontrada');
    expect(region().textContent).toBe('Búsqueda: 1 compañía encontrada');
    expect(document.querySelectorAll('output[aria-live]')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Limpiar' }));
    await waitFor(() => expect(region().textContent).toBe(''));
  });

  it('sin búsqueda el anuncio persiste vacío', async () => {
    render(<IndiceCompanias />);
    await screen.findByText('GA-JR');
    expect(region().textContent).toBe('');
  });
});
