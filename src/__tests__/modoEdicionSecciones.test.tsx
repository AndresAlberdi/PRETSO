import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { ComponentType } from 'react';
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react';
import ManejoCaja from '../pages/ManejoCaja';
import Salarios from '../pages/Salarios';
import CorpusChristi from '../pages/CorpusChristi';
import Indicadores from '../pages/Indicadores';
import IndiceCompanias from '../pages/IndiceCompanias';
import Bibliografia from '../pages/Bibliografia';

const SRC = resolve(__dirname, '..');

vi.mock('../firebase', () => ({ auth: {}, db: {}, firebaseConfig: {} }));
vi.mock('../utils/audit', () => ({ logAction: vi.fn() }));
vi.mock('react-router', () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/x', search: '', state: null }),
}));
const estado = vi.hoisted(() => ({
  isAdmin: false, isReader: false, isEditMode: false, setIsEditMode: vi.fn(),
}));
vi.mock('../context/AdminContext', () => ({ useAdmin: () => estado }));

let colecciones: Record<string, Array<{ id: string } & Record<string, unknown>>> = {};
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, nombre: string) => nombre,
  query: (nombre: string) => nombre,
  where: vi.fn(), doc: vi.fn(), deleteDoc: vi.fn(), updateDoc: vi.fn(), addDoc: vi.fn(),
  getDocs: async (nombre: string) => ({
    docs: (colecciones[nombre] ?? []).map(d => ({ id: d.id, data: () => d })),
  }),
}));

beforeEach(() => {
  const base = { 'Sigla Compañía': 7, Ciudad: 'Potosí', 'Año': 1600 };
  colecciones = {
    companias: [
      { id: 'c7', 'Indicador de registro': 7, 'Sigla Compañía': 'GA-JR', 'Nombre Compañía': 'Compañía de Alarcón', Autores: 'Alarcón y Ramírez' },
    ],
    transacciones: [],
    manejo_de_caja: [{ id: 'm1', ...base, Ingresos: 100 }],
    salarios: [{ id: 's1', ...base }],
    corpus_christi: [{ id: 'cc1', ...base }],
    indicadores: [{ id: 'i1', ...base, 'Categorías': 'Precios' }],
    bibliografia: [{ id: 'b1', Autores: 'Rennert', 'Referencias bibliográficas': 'The Spanish Stage' }],
  };
  estado.isAdmin = false; estado.isReader = false; estado.isEditMode = false;
});
afterEach(cleanup);

interface Pagina {
  nombre: string;
  archivo: string;
  Componente: ComponentType;
  conBuscador: boolean;
  filas: number;
}
const PAGINAS: Pagina[] = [
  { nombre: 'Manejo de Caja', archivo: 'ManejoCaja.tsx', Componente: ManejoCaja, conBuscador: true, filas: 1 },
  { nombre: 'Remuneraciones', archivo: 'Salarios.tsx', Componente: Salarios, conBuscador: true, filas: 1 },
  { nombre: 'Corpus Christi', archivo: 'CorpusChristi.tsx', Componente: CorpusChristi, conBuscador: true, filas: 1 },
  { nombre: 'Indicadores', archivo: 'Indicadores.tsx', Componente: Indicadores, conBuscador: true, filas: 1 },
  { nombre: 'Índice de Compañías', archivo: 'IndiceCompanias.tsx', Componente: IndiceCompanias, conBuscador: false, filas: 1 },
  { nombre: 'Bibliografía', archivo: 'Bibliografia.tsx', Componente: Bibliografia, conBuscador: false, filas: 1 },
];

// Deja a la vista una tabla de datos: en las secciones con buscador, la de resultados.
async function mostrarTabla(p: Pagina): Promise<HTMLElement> {
  render(<p.Componente />);
  if (!p.conBuscador) return (await screen.findAllByRole('table'))[0];
  await screen.findAllByRole('table');
  fireEvent.change(screen.getByRole('combobox', { name: 'Buscar en' }), { target: { value: 'all' } });
  fireEvent.change(screen.getByPlaceholderText('Añadir filtro...'), { target: { value: 'Potosí' } });
  fireEvent.click(screen.getAllByRole('button', { name: 'Buscar' })[0]);
  return screen.findByRole('table', { name: /^Resultados de búsqueda/ });
}

describe.each(PAGINAS)('modo edición en $nombre', (p) => {
  it('un lector con modo edición forzado no ve controles de edición', async () => {
    Object.assign(estado, { isAdmin: false, isReader: true, isEditMode: true });
    const tabla = await mostrarTabla(p);
    for (const nombre of ['Editar', 'Salir de edición', 'Nuevo registro', 'Borrar']) {
      expect(screen.queryByRole('button', { name: nombre }), nombre).toBeNull();
    }
    expect(screen.queryByRole('columnheader', { name: 'Admin' })).toBeNull();
    expect(within(tabla).queryByRole('columnheader', { name: 'Admin' })).toBeNull();
    expect(document.querySelector('.boton-editor, .boton-editor-activo, .boton-borrar')).toBeNull();
  });

  it('un administrador sin modo edición solo ve «Editar»', async () => {
    Object.assign(estado, { isAdmin: true, isEditMode: false });
    await mostrarTabla(p);
    const editar = screen.getAllByRole('button', { name: 'Editar' });
    expect(editar).toHaveLength(1);
    expect(editar[0].classList.contains('boton-editor')).toBe(true);
    expect(screen.queryByRole('button', { name: 'Nuevo registro' })).toBeNull();
    expect(screen.queryByRole('columnheader', { name: 'Admin' })).toBeNull();
  });

  it('un administrador en modo edición ve botón de cierre, alta y columna Admin', async () => {
    Object.assign(estado, { isAdmin: true, isEditMode: true });
    const tabla = await mostrarTabla(p);
    const salir = screen.getByRole('button', { name: 'Salir de edición' });
    expect(salir.classList.contains('boton-editor-activo')).toBe(true);
    const nuevo = screen.getByRole('button', { name: 'Nuevo registro' });
    expect(nuevo.className).toBe('boton boton-editor');
    const admin = within(tabla).getByRole('columnheader', { name: 'Admin' });
    expect(admin.querySelector('.visually-hidden')).toBeNull();
    const editar = within(tabla).getAllByRole('button', { name: 'Editar' });
    const borrar = within(tabla).getAllByRole('button', { name: 'Borrar' });
    expect(editar).toHaveLength(p.filas);
    expect(borrar).toHaveLength(p.filas);
    expect(editar[0].classList.contains('boton-fila') && editar[0].classList.contains('boton-editor')).toBe(true);
    expect(borrar[0].classList.contains('boton-fila') && borrar[0].classList.contains('boton-borrar')).toBe(true);
  });

  it('la cabecera ordena buscador, interruptor y «Nuevo registro»', async () => {
    Object.assign(estado, { isAdmin: true, isEditMode: true });
    await mostrarTabla(p);
    const nuevo = screen.getByRole('button', { name: 'Nuevo registro' });
    const salir = screen.getByRole('button', { name: 'Salir de edición' });
    const cabecera = nuevo.closest('.acciones-cabecera') as HTMLElement;
    expect(cabecera).not.toBeNull();
    expect(cabecera.contains(salir)).toBe(true);
    const sigue = (a: Node, b: Node) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    if (p.conBuscador) {
      expect(sigue(cabecera.querySelector('form') as Node, salir)).toBe(true);
    } else if (cabecera.querySelector('input')) {
      expect(sigue(cabecera.querySelector('input') as Node, salir)).toBe(true);
    }
    expect(sigue(salir, nuevo)).toBe(true);
  });

  it('«Nuevo registro» abre el diálogo de alta', async () => {
    Object.assign(estado, { isAdmin: true, isEditMode: true });
    await mostrarTabla(p);
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo registro' }));
    expect(await screen.findByRole('dialog', { name: /^Nuevo Registro - / })).toBeTruthy();
  });

  it('el código fuente usa useCanEdit y CeldaAdmin, sin restos del esquema anterior', () => {
    const src = readFileSync(join(SRC, 'pages', p.archivo), 'utf8');
    expect(src).not.toContain('isEditMode');
    expect(src).not.toContain('state?.reset');
    expect(src).not.toContain('>Nuevo Registro<');
    expect(src).toContain('useCanEdit()');
    expect(src).toContain('<CeldaAdmin');
  });
});
