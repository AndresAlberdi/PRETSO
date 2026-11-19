import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react';
import Salarios from '../pages/Salarios';
import { invalidarIndice } from '../utils/busquedaGuia/cargaIndice';

const companias = [
  { id: 'c7', 'Indicador de registro': 7, 'Sigla Compañía': 'GA-JR', 'Nombre Compañía': 'Compañía de Alarcón', Autores: 'Alarcón', 'Temporadas teatrales': 'De 1590 a 1600', 'Ámbito': 'España' },
];
const CLAVE = 'pepito perez|de 1615 a 1616|desconocido';

let colecciones: Record<string, any[]> = {};
const ubicacion = vi.hoisted(() => ({ search: '' }));
const navegar = vi.hoisted(() => vi.fn());

vi.mock('../firebase', () => ({ db: {} }));
vi.mock('../utils/audit', () => ({ logAction: vi.fn() }));
vi.mock('react-router', () => ({
  useNavigate: () => navegar,
  useLocation: () => ({ pathname: '/remuneraciones', search: ubicacion.search, state: null }),
}));
vi.mock('../context/AdminContext', () => ({ useAdmin: () => ({ isAdmin: true, isEditMode: false }) }));
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, nombre: string) => nombre,
  query: (nombre: string) => nombre,
  where: vi.fn(), doc: vi.fn(), deleteDoc: vi.fn(), updateDoc: vi.fn(), addDoc: vi.fn(),
  getDocs: async (nombre: string) => ({ docs: (colecciones[nombre] ?? []).map(d => ({ id: d.id, data: () => d })) }),
}));

beforeEach(() => {
  invalidarIndice();
  navegar.mockReset();
  ubicacion.search = '';
  colecciones = {
    companias,
    transacciones: [],
    salarios: [
      { id: 's1', 'Indicador de registro': 1, 'Sigla Compañía': 7, Ciudad: 'Potosí', 'Año': 1600, 'Beneficiario ': 'Pedro Gómez' },
      { id: 's2', 'Indicador de registro': 2, 'Sigla Compañía': null, Empleador: 'Pepito Pérez', 'Temporadas teatrales': 'De 1615 a 1616', 'Ámbito': 'desconocido', Ciudad: 'Lima', 'Año': 1615, 'Beneficiario ': 'Ana Ruiz' },
      { id: 's3', 'Indicador de registro': 3, 'Sigla Compañía': null, Empleador: 'pepito perez', 'Temporadas teatrales': 'De 1615 a 1616', 'Ámbito': 'Desconocido', Ciudad: 'Quito', 'Año': 1616, 'Beneficiario ': 'Luis Mora' },
    ],
  };
});
afterEach(cleanup);

const filasTabla = async () => {
  const tabla = await screen.findByRole('table');
  return within(tabla).getAllByRole('row').slice(1);
};

describe('Remuneraciones: empleador «otro»', () => {
  it('el listado muestra la fila «otro» con el nombre; dos registros del mismo grupo son una fila', async () => {
    render(<Salarios />);
    const filas = await filasTabla();
    expect(filas).toHaveLength(2);
    const otro = filas.find(f => f.textContent?.includes('Pepito Pérez'))!;
    expect(within(otro).getAllByRole('cell')[0].textContent).toBe('otro');
    expect(within(otro).getAllByRole('cell')[2].textContent).toBe('De 1615 a 1616');
  });

  it('el filtro «otro» deja solo esas filas', async () => {
    render(<Salarios />);
    await filasTabla();
    fireEvent.change(screen.getByLabelText('Filtrar por compañía'), { target: { value: '__otro__' } });
    const filas = await filasTabla();
    expect(filas).toHaveLength(1);
    expect(filas[0].textContent).toContain('Pepito Pérez');
  });

  it('los filtros de temporada y ámbito incluyen los valores escritos a mano', async () => {
    render(<Salarios />);
    await filasTabla();
    fireEvent.change(screen.getByLabelText('Filtrar por ámbito'), { target: { value: 'desconocido' } });
    const filas = await filasTabla();
    expect(filas).toHaveLength(1);
    fireEvent.change(screen.getByLabelText('Filtrar por temporada'), { target: { value: 'De 1590 a 1600' } });
    expect(screen.queryByText('Pepito Pérez')).toBeNull();
  });

  it('ordenar «Compañía u otro» intercala bien las filas', async () => {
    render(<Salarios />);
    await filasTabla();
    fireEvent.click(screen.getByRole('button', { name: /Compañía u otro/ }));
    const filas = await filasTabla();
    expect(filas.map(f => within(f).getAllByRole('cell')[0].textContent)).toEqual(['GA-JR / Compañía de Alarcón', 'otro']);
  });

  it('TRATO en «otro» navega con el parámetro empleador y sin compania', async () => {
    render(<Salarios />);
    const filas = await filasTabla();
    const otro = filas.find(f => f.textContent?.includes('Pepito Pérez'))!;
    fireEvent.click(within(otro).getByRole('button', { name: 'TRATO' }));
    expect(navegar).toHaveBeenCalledTimes(1);
    const url = new URL(navegar.mock.calls[0][0], 'http://x');
    expect(url.searchParams.get('empleador')).toBe(CLAVE);
    expect(url.searchParams.has('compania')).toBe(false);
  });

  it('con ?empleador=<clave> muestra los registros del grupo', async () => {
    ubicacion.search = `?empleador=${encodeURIComponent(CLAVE)}`;
    render(<Salarios />);
    const tabla = await screen.findByRole('table');
    expect(within(tabla).getByText('Ana Ruiz')).toBeTruthy();
    expect(within(tabla).getByText('Luis Mora')).toBeTruthy();
    expect(within(tabla).queryByText('Pedro Gómez')).toBeNull();
    expect(screen.getByText('2 registros para otro / Pepito Pérez')).toBeTruthy();
  });

  it('con una clave inexistente avisa «Empleador no encontrado»', async () => {
    ubicacion.search = '?empleador=nadie|x|y';
    render(<Salarios />);
    expect(await screen.findByText('Empleador no encontrado')).toBeTruthy();
  });

  it('con ?q=Pepito, el nivel 2 lista solo el grupo con coincidencia', async () => {
    ubicacion.search = '?q=Pepito';
    render(<Salarios />);
    const filas = await filasTabla();
    expect(filas).toHaveLength(1);
    expect(filas[0].textContent).toContain('Pepito Pérez');
  });

  it('«Volver» borra los dos parámetros', async () => {
    ubicacion.search = `?empleador=${encodeURIComponent(CLAVE)}`;
    render(<Salarios />);
    await screen.findByRole('table');
    fireEvent.click(screen.getByRole('button', { name: 'Volver a listado inicial' }));
    const url = new URL(navegar.mock.calls[0][0], 'http://x');
    expect(url.searchParams.has('empleador')).toBe(false);
    expect(url.searchParams.has('compania')).toBe(false);
  });
});
