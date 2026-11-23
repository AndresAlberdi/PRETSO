import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter, useNavigate, useLocation } from 'react-router';
import ManejoCaja from '../pages/ManejoCaja';
import Salarios from '../pages/Salarios';
import { invalidarIndice } from '../utils/busquedaGuia/cargaIndice';

const companias = [
  { id: 'c7', 'Indicador de registro': 7, 'Sigla Compañía': 'GA-JR', 'Nombre Compañía': 'Compañía de Alarcón', Autores: 'Alarcón y Ramírez' },
  { id: 'c12', 'Indicador de registro': 12, 'Sigla Compañía': 'JG', Autores: 'Juan' },
];
let colecciones: Record<string, Array<Record<string, unknown> & { id: string }>> = {};

vi.mock('../firebase', () => ({ db: {} }));
vi.mock('../utils/audit', () => ({ logAction: vi.fn() }));
vi.mock('../context/AdminContext', () => ({ useAdmin: () => ({ isAdmin: false, isEditMode: false }) }));
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, nombre: string) => nombre,
  query: (nombre: string) => nombre,
  where: vi.fn(), doc: vi.fn(), deleteDoc: vi.fn(), updateDoc: vi.fn(), addDoc: vi.fn(),
  getDocs: async (nombre: string) => ({ docs: (colecciones[nombre] ?? []).map(d => ({ id: d.id, data: () => d })) }),
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
  };
});
afterEach(cleanup);

function Atras() {
  const navegar = useNavigate();
  const { search } = useLocation();
  return (
    <>
      <button onClick={() => navegar(-1)}>Atrás del navegador</button>
      <output aria-label="url">{search}</output>
    </>
  );
}

function montar(Pagina: React.ComponentType, entradas: string[]) {
  return render(
    <MemoryRouter initialEntries={entradas} initialIndex={entradas.length - 1}>
      <Atras />
      <Pagina />
    </MemoryRouter>,
  );
}

const volver = () => screen.queryByRole('button', { name: /^Volver a / });

describe('Manejo de caja: la selección se deriva de la URL', () => {
  it('abre con ?compania=, cambia la selección y el botón Atrás vuelve al listado y de nuevo al detalle', async () => {
    montar(ManejoCaja, ['/x']);
    const botones = await screen.findAllByRole('button', { name: 'CAJA' });
    expect(volver()).toBeNull();
    fireEvent.click(botones[0]);
    expect(await screen.findByRole('button', { name: 'Volver a listado inicial' })).toBeTruthy();
    expect(screen.getByLabelText('url').textContent).toMatch(/compania=/);
    fireEvent.click(screen.getByRole('button', { name: 'Atrás del navegador' }));
    expect(await screen.findAllByRole('button', { name: 'CAJA' })).toBeTruthy();
    expect(volver()).toBeNull();
    expect(screen.getByLabelText('url').textContent).toBe('');
  });

  it('abre directamente con ?compania= y «Volver a listado inicial» quita el parámetro', async () => {
    montar(ManejoCaja, ['/x?compania=7']);
    const salir = await screen.findByRole('button', { name: 'Volver a listado inicial' });
    expect(screen.getByLabelText('url').textContent).toBe('?compania=7');
    fireEvent.click(salir);
    expect(await screen.findAllByRole('button', { name: 'CAJA' })).toBeTruthy();
    expect(screen.getByLabelText('url').textContent).toBe('');
  });

  it('un cambio de URL a otra compañía cambia la selección, y Atrás regresa a la anterior', async () => {
    montar(ManejoCaja, ['/x?compania=7']);
    await screen.findByRole('button', { name: 'Volver a listado inicial' });
    fireEvent.click(screen.getByRole('button', { name: 'Volver a listado inicial' }));
    const botones = await screen.findAllByRole('button', { name: 'CAJA' });
    fireEvent.click(botones[1]);
    expect(await screen.findByRole('button', { name: 'Volver a listado inicial' })).toBeTruthy();
    expect(screen.getByLabelText('url').textContent).toMatch(/compania=\d+/);
    fireEvent.click(screen.getByRole('button', { name: 'Atrás del navegador' }));
    expect(await screen.findAllByRole('button', { name: 'CAJA' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Atrás del navegador' }));
    expect(await screen.findByRole('button', { name: 'Volver a listado inicial' })).toBeTruthy();
    expect(screen.getByLabelText('url').textContent).toBe('?compania=7');
  });

  it('con búsqueda, abre el detalle con ?q=&compania= y «Volver a los resultados» conserva q', async () => {
    montar(ManejoCaja, ['/x?q=Potosí&compania=7']);
    const salir = await screen.findByRole('button', { name: 'Volver a los resultados' });
    fireEvent.click(salir);
    await screen.findByRole('table');
    expect(volver()).toBeNull();
    expect(screen.getByLabelText('url').textContent).toBe('?q=Potos%C3%AD');
  });
});

describe('Remuneraciones: la selección se deriva de la URL', () => {
  it('abre con ?compania= y «Volver a los resultados» conserva q', async () => {
    montar(Salarios, ['/x?q=Potosí&compania=7']);
    const salir = await screen.findByRole('button', { name: 'Volver a los resultados' });
    fireEvent.click(salir);
    await screen.findByRole('table');
    expect(volver()).toBeNull();
    expect(screen.getByLabelText('url').textContent).toBe('?q=Potos%C3%AD');
  });

  it('TRATO abre el detalle, Atrás vuelve a los resultados y se puede abrir de nuevo el detalle', async () => {
    montar(Salarios, ['/x?q=Potosí']);
    const trato = await screen.findByRole('button', { name: 'TRATO' });
    fireEvent.click(trato);
    expect(await screen.findByRole('button', { name: 'Volver a los resultados' })).toBeTruthy();
    expect(screen.getByLabelText('url').textContent).toMatch(/compania=7/);
    fireEvent.click(screen.getByRole('button', { name: 'Atrás del navegador' }));
    expect(await screen.findByRole('button', { name: 'TRATO' })).toBeTruthy();
    expect(volver()).toBeNull();
    expect(screen.getByLabelText('url').textContent).toBe('?q=Potosí');
    fireEvent.click(screen.getByRole('button', { name: 'TRATO' }));
    expect(await screen.findByRole('button', { name: 'Volver a los resultados' })).toBeTruthy();
  });

  it('abre con ?empleador= y «Volver a listado inicial» quita el parámetro', async () => {
    montar(Salarios, ['/x?empleador=inexistente']);
    expect(await screen.findByRole('button', { name: 'Volver a listado inicial' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Volver a listado inicial' }));
    await screen.findByText(/Mostrando \d+ registros/);
    expect(screen.getByLabelText('url').textContent).toBe('');
  });
});
