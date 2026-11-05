import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import Busqueda from '../pages/Busqueda';
import { invalidarIndice } from '../utils/busquedaGuia/cargaIndice';

const companias = [
  { id: 'c7', 'Indicador de registro': 7, 'Sigla Compañía': 'GA-JR', 'Nombre Compañía': 'Compañía de Alarcón', Autores: 'Alarcón y Ramírez' },
  { id: 'c12', 'Indicador de registro': 12, 'Sigla Compañía': 'JG', Autores: 'García' },
];

let colecciones: Record<string, any[]> = {};
vi.mock('../firebase', () => ({ db: {} }));
vi.mock('../utils/audit', () => ({ logAction: vi.fn() }));
vi.mock('../context/AdminContext', () => ({ useAdmin: () => ({ isAdmin: false, adminLoading: false }) }));
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

describe('Búsqueda general: anuncio de la búsqueda general', () => {
  it('vacío al inicio, y se anuncia «Búsqueda sin resultados» o las secciones con coincidencias', async () => {
    render(<MemoryRouter initialEntries={['/buscar']}><Busqueda /></MemoryRouter>);
    await screen.findByRole('heading', { name: 'Búsqueda general' });
    const nodo = region();
    expect(nodo.textContent).toBe('');
    fireEvent.change(screen.getByLabelText('Buscar en la base de datos'), { target: { value: 'zzzz-inexistente' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    await screen.findByText(/No se encontró/);
    expect(region()).toBe(nodo);
    expect(nodo.textContent).toBe('Búsqueda sin resultados');
    fireEvent.change(screen.getByLabelText('Buscar en la base de datos'), { target: { value: 'Potosí' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    await screen.findByRole('heading', { level: 2, name: 'Secciones con «Potosí»' });
    expect(region()).toBe(nodo);
    expect(nodo.textContent).toBe('Búsqueda: «Potosí» aparece en 3 secciones');
  });
});
