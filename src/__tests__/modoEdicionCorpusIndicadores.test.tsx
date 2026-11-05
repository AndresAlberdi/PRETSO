import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { screen, fireEvent, within, cleanup } from '@testing-library/react';
import { PAGINAS, mostrarDetalle, crearColecciones } from './ayudas/paginasSeccion';
import type { ColeccionesPrueba, Pagina } from './ayudas/paginasSeccion';

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

let colecciones: ColeccionesPrueba = {};
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, nombre: string) => nombre,
  query: (nombre: string) => nombre,
  where: vi.fn(), doc: vi.fn(), deleteDoc: vi.fn(), updateDoc: vi.fn(), addDoc: vi.fn(),
  getDocs: async (nombre: string) => ({
    docs: (colecciones[nombre] ?? []).map(d => ({ id: d.id, data: () => d })),
  }),
}));

beforeEach(() => {
  colecciones = crearColecciones();
  estado.isAdmin = false; estado.isReader = false; estado.isEditMode = false;
});
afterEach(cleanup);

// Desaparece la tabla de «Resultados de búsqueda»: la tabla con columna Admin es ahora la de detalle,
// y cada página conserva un solo <CeldaAdmin>.
const PAGINAS_SECCION = PAGINAS
  .filter(p => p.nombre === 'Corpus Christi' || p.nombre === 'Indicadores')
  .map(p => ({ ...p, celdas: 1 }));

async function mostrarTabla(p: Pagina): Promise<HTMLElement> {
  if (!p.detalle) throw new Error('La página debe tener tabla de detalle');
  return mostrarDetalle({ ...p, detalle: p.detalle });
}
it('selecciona las secciones esperadas', () => { expect(PAGINAS_SECCION).toHaveLength(2); });

describe.each(PAGINAS_SECCION)('modo edición en $nombre', (p) => {
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
    expect(nuevo.classList.contains('boton')).toBe(true);
    expect(nuevo.classList.contains('boton-editor')).toBe(true);
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
    if (p.buscador === 'SearchBar' || p.buscador === 'barra') {
      expect(sigue(cabecera.querySelector('form') as Node, salir)).toBe(true);
    } else if (p.buscador === 'campo') {
      expect(sigue(screen.getByRole('textbox', { name: 'Buscar por nombre o autores' }), salir)).toBe(true);
    } else {
      expect(cabecera.querySelector('input, form')).toBeNull();
    }
    expect(sigue(salir, nuevo)).toBe(true);
  });

  it('«Nuevo registro» abre el diálogo de alta', async () => {
    Object.assign(estado, { isAdmin: true, isEditMode: true });
    await mostrarTabla(p);
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo registro' }));
    expect(await screen.findByRole('dialog', { name: /^Nuevo registro: / })).toBeTruthy();
  });

  it('el código fuente usa useCanEdit y CeldaAdmin, sin restos del esquema anterior', () => {
    const src = readFileSync(join(SRC, 'pages', p.archivo), 'utf8');
    expect(src).not.toContain('isEditMode');
    expect(src).not.toContain('state?.reset');
    expect(src).not.toContain('>Nuevo Registro<');
    expect(src).toContain('useCanEdit()');
    expect(src).toContain('<CeldaAdmin');
    expect((src.match(/<CeldaAdmin\b/g) ?? []).length).toBe(p.celdas);
  });
});

describe.each(PAGINAS_SECCION.filter((p): p is Pagina & { detalle: NonNullable<Pagina['detalle']> } => Boolean(p.detalle)))('tabla de detalle en $nombre', (p) => {
  it('un lector con modo edición forzado no ve controles de edición', async () => {
    Object.assign(estado, { isAdmin: false, isReader: true, isEditMode: true });
    const tabla = await mostrarDetalle(p);
    expect(within(tabla).queryByRole('columnheader', { name: 'Admin' })).toBeNull();
    expect(within(tabla).queryByRole('button', { name: 'Editar' })).toBeNull();
    expect(within(tabla).queryByRole('button', { name: 'Borrar' })).toBeNull();
    expect(document.querySelector('.boton-borrar')).toBeNull();
    expect(document.querySelector('.boton-editor')).toBeNull();
  });

  it('un administrador sin modo edición no ve la columna Admin', async () => {
    Object.assign(estado, { isAdmin: true, isEditMode: false });
    const tabla = await mostrarDetalle(p);
    expect(within(tabla).queryByRole('columnheader', { name: 'Admin' })).toBeNull();
    expect(within(tabla).queryByRole('button', { name: 'Editar' })).toBeNull();
    expect(within(tabla).queryByRole('button', { name: 'Borrar' })).toBeNull();
  });

  it('un administrador en modo edición ve Editar y Borrar en cada fila', async () => {
    Object.assign(estado, { isAdmin: true, isEditMode: true });
    const tabla = await mostrarDetalle(p);
    expect(within(tabla).getByRole('columnheader', { name: 'Admin' })).toBeTruthy();
    const editar = within(tabla).getAllByRole('button', { name: 'Editar' });
    const borrar = within(tabla).getAllByRole('button', { name: 'Borrar' });
    expect(editar).toHaveLength(p.filas);
    expect(borrar).toHaveLength(p.filas);
    expect(editar[0].classList.contains('boton-fila') && editar[0].classList.contains('boton-editor')).toBe(true);
    expect(borrar[0].classList.contains('boton-fila') && borrar[0].classList.contains('boton-borrar')).toBe(true);
    fireEvent.click(editar[0]);
    expect(await screen.findByRole('dialog')).toBeTruthy();
  });
});

