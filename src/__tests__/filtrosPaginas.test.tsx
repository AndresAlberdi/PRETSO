import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import Salarios from '../pages/Salarios';
import ManejoCaja from '../pages/ManejoCaja';
import CorpusChristi from '../pages/CorpusChristi';
import Indicadores from '../pages/Indicadores';
import IndiceCompanias from '../pages/IndiceCompanias';

const colecciones: Record<string, any[]> = {
  companias: [{ id: 'c7', 'Indicador de registro': 7, 'Sigla Compañía': 'GA-JR', Autores: 'Alarcón' }],
  transacciones: [],
  salarios: [{ id: 's1', 'Sigla Compañía': 7, Ciudad: 'Potosí', 'Año': 1600 }],
  manejo_de_caja: [{ id: 'm1', 'Sigla Compañía': 7, Ciudad: 'Potosí', 'Año': 1600 }],
  corpus_christi: [{ id: 'a', 'Indicador de registro': 1, Ciudad: 'Potosí', 'Año': 1600 }],
  indicadores: [{ id: 'i1', 'Indicador de registro': 1, 'Categorías': 'Pan' }],
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

describe.each([
  ['Salarios', Salarios],
  ['ManejoCaja', ManejoCaja],
])('%s: filtros con nombre accesible', (_n, Pagina) => {
  it('los tres selects se encuentran por rol y nombre', async () => {
    render(<Pagina />);
    expect(await screen.findByRole('combobox', { name: 'Filtrar por compañía' })).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Filtrar por temporada' })).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Filtrar por ámbito' })).toBeTruthy();
  });
});

describe('CorpusChristi: filtros con nombre accesible', () => {
  it('ciudad y año', async () => {
    render(<CorpusChristi />);
    expect(await screen.findByRole('combobox', { name: 'Filtrar por ciudad' })).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Filtrar por año' })).toBeTruthy();
  });
});

describe('Indicadores: filtro con nombre accesible', () => {
  it('categoría', async () => {
    render(<Indicadores />);
    expect(await screen.findByRole('combobox', { name: 'Filtrar por categoría' })).toBeTruthy();
  });
});

describe('IndiceCompanias: búsqueda con nombre accesible', () => {
  it('el campo se encuentra por rol y nombre', async () => {
    render(<IndiceCompanias />);
    expect(await screen.findByRole('textbox', { name: 'Buscar por nombre o autores' })).toBeTruthy();
  });
});
