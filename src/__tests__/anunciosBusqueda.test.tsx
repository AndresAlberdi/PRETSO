import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import Busqueda from '../pages/Busqueda';

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

function buscar(categoria: string, texto: string) {
  const selects = screen.getAllByRole('combobox');
  fireEvent.change(selects[0], { target: { value: categoria } });
  fireEvent.change(screen.getByPlaceholderText('Añadir filtro...'), { target: { value: texto } });
  fireEvent.click(screen.getAllByRole('button', { name: 'Buscar' })[0]);
}

describe('Búsqueda general: anuncio de la búsqueda general', () => {
  it('vacío al inicio y «Búsqueda sin resultados» sin coincidencias', async () => {
    render(<Busqueda />);
    await screen.findByRole('heading', { name: 'Búsqueda general' });
    await vi.waitFor(() => expect(screen.queryByText(/Cargando base de datos/)).toBeNull());
    const nodo = region();
    expect(nodo.textContent).toBe('');
    buscar('all', 'zzzz-inexistente');
    await screen.findByText(/No se encontraron resultados/);
    expect(region()).toBe(nodo);
    expect(nodo.textContent).toBe('Búsqueda sin resultados');
  });
});
