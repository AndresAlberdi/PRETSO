import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import IndiceCompanias from '../pages/IndiceCompanias';

const companias = [{ id: 'c7', 'Indicador de registro': 7, 'Sigla Compañía': 'GA-JR', Autores: 'Alarcón' }];

let colecciones: Record<string, any[]> = {};
const navegar = vi.hoisted(() => vi.fn());
const fallo = vi.hoisted(() => ({ coleccion: null as string | null }));

vi.mock('../firebase', () => ({ db: {} }));
vi.mock('../utils/audit', () => ({ logAction: vi.fn() }));
vi.mock('react-router', () => ({ useNavigate: () => navegar }));
vi.mock('../context/AdminContext', () => ({ useAdmin: () => ({ isEditMode: false }) }));
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, nombre: string) => nombre,
  query: (nombre: string) => nombre,
  doc: vi.fn(), deleteDoc: vi.fn(), updateDoc: vi.fn(), addDoc: vi.fn(),
  getDocs: async (nombre: string) => {
    if (fallo.coleccion === nombre) throw new Error('fallo simulado de lectura');
    return { docs: (colecciones[nombre] ?? []).map(d => ({ id: d.id, data: () => d })) };
  },
}));

beforeEach(() => {
  navegar.mockReset();
  fallo.coleccion = null;
  colecciones = { companias, manejo_de_caja: [], salarios: [], corpus_christi: [] };
});
afterEach(cleanup);

async function pulsar(boton: string) {
  render(<IndiceCompanias />);
  const fila = (await screen.findByText('GA-JR')).closest('tr') as HTMLElement;
  fireEvent.click(Array.from(fila.querySelectorAll('button')).find(b => b.textContent === boton)!);
}

describe('índice de compañías: navegar a Caja / Remuneraciones', () => {
  it('con registros navega con el número de registro', async () => {
    colecciones.manejo_de_caja = [{ id: 'a', 'Sigla Compañía': '7.0' }];
    await pulsar('Caja');
    await vi.waitFor(() => expect(navegar).toHaveBeenCalledWith('/caja?compania=7'));
  });

  it('sin registros avisa y no navega', async () => {
    await pulsar('Caja');
    expect(await screen.findByText(/No existen registros en esta sección/)).toBeTruthy();
    expect(navegar).not.toHaveBeenCalled();
  });

  it('si la lectura falla: mensaje propio de navegación (no habla de borrar), no navega y cierra la capa de análisis', async () => {
    fallo.coleccion = 'salarios';
    await pulsar('Remuneraciones');
    expect(await screen.findByText('No se pudo comprobar los registros de la compañía. Intente de nuevo.')).toBeTruthy();
    expect(screen.queryByText(/no se borró/)).toBeNull();
    expect(navegar).not.toHaveBeenCalled();
    expect(screen.queryByText(/analizando/i)).toBeNull();
  });
});
