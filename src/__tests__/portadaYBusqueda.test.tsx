import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, cleanup, act, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

vi.mock('../firebase', () => ({ db: {}, auth: {} }));
vi.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: vi.fn(),
  signInWithPopup: vi.fn(),
  GoogleAuthProvider: vi.fn(function GoogleAuthProvider() {}),
}));
let estado: { isAdmin: boolean; adminLoading: boolean; authNotice?: string | null; clearAuthNotice?: () => void } = { isAdmin: false, adminLoading: false, authNotice: null, clearAuthNotice: () => undefined };
vi.mock('../context/AdminContext', () => ({ useAdmin: () => estado }));

const consultadas: string[] = [];
let fallar = false;
let retener: Promise<void> | null = null;
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, nombre: string) => nombre,
  query: (nombre: string) => nombre,
  getDocs: async (nombre: string) => {
    consultadas.push(nombre);
    if (retener) await retener;
    if (fallar) throw { code: 'permission-denied' };
    return { docs: [] };
  },
}));

import Portada from '../pages/Portada';
import Busqueda from '../pages/Busqueda';
import { SECCIONES } from '../utils/secciones';
import { invalidarIndice } from '../utils/busquedaGuia/cargaIndice';

beforeEach(() => {
  consultadas.length = 0;
  invalidarIndice();
  fallar = false;
  retener = null;
  estado = { isAdmin: false, adminLoading: false, authNotice: null, clearAuthNotice: () => undefined };
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const enRouter = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('Portada', () => {
  it('el lector ve el título, los tres logos y solo «Realizar búsquedas»', () => {
    enRouter(<Portada />);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('PRETSO');
    const alts = screen.getAllByRole('img').map((i) => i.getAttribute('alt'));
    expect(alts).toEqual([
      'Logo del proyecto THIS: Theater in Imperial Spain',
      "Università Ca' Foscari Venezia, Departamento de Lingüística y Estudios Culturales Comparados",
      'Funded by the European Union',
    ]);
    expect(screen.getByRole('link', { name: 'Realizar búsquedas' }).getAttribute('href')).toBe('/buscar');
    expect(screen.queryByRole('link', { name: 'Editar' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Administración' })).toBeNull();
  });

  it('el administrador ve «Editar» y «Administración» como botones de editor', () => {
    estado = { isAdmin: true, adminLoading: false };
    enRouter(<Portada />);
    const editar = screen.getByRole('link', { name: 'Editar' });
    const admin = screen.getByRole('link', { name: 'Administración' });
    expect(editar.getAttribute('href')).toBe('/buscar');
    expect(admin.getAttribute('href')).toBe('/administracion');
    expect(editar.classList.contains('boton-editor')).toBe(true);
    expect(admin.classList.contains('boton-editor')).toBe(true);
  });
});

describe('Portada con acceso (sin sesión)', () => {
  it('muestra título, logos y el acceso, sin botones de la aplicación', () => {
    enRouter(<Portada acceso />);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('PRETSO');
    expect(screen.getAllByRole('img')).toHaveLength(3);
    expect(screen.getByRole('heading', { level: 2, name: 'Iniciar sesión' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continuar con Google' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Realizar búsquedas' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Editar' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Administración' })).toBeNull();
  });
});

describe('Búsqueda general', () => {
  it('lista las seis secciones en orden con sus rutas', async () => {
    enRouter(<Busqueda />);
    const nav = screen.getByRole('navigation', { name: 'Secciones de la base de datos' });
    const enlaces = within(nav).getAllByRole('link');
    expect(enlaces).toHaveLength(6);
    enlaces.forEach((e, i) => {
      expect(e.getAttribute('href')).toBe(SECCIONES[i].ruta);
      expect(e.textContent).toContain(SECCIONES[i].nombre);
    });
    await vi.waitFor(() => expect(consultadas.length).toBe(8));
  });

  it('el lector sí consulta transacciones y documentos para subir la coincidencia a su caja', async () => {
    enRouter(<Busqueda />);
    await vi.waitFor(() => expect(consultadas.length).toBe(8));
    expect(consultadas).toContain('transacciones');
    expect(consultadas).toContain('documentos');
  });

  it('el administrador consulta las mismas ocho colecciones', async () => {
    estado = { isAdmin: true, adminLoading: false };
    enRouter(<Busqueda />);
    await vi.waitFor(() => expect(consultadas.length).toBe(8));
    expect(consultadas).toContain('transacciones');
    expect(consultadas).toContain('documentos');
  });

  it('si la carga falla muestra el aviso y deja de cargar', async () => {
    fallar = true;
    enRouter(<Busqueda />);
    const alerta = await screen.findByRole('alert');
    expect(alerta.textContent).toBe('No se pudo cargar la base de datos para la búsqueda. Inténtelo de nuevo más tarde.');
    expect(screen.queryByText(/Buscando en la base de datos/)).toBeNull();
  });

  it('«Reintentar» vuelve a cargar y, si ahora funciona, quita el aviso', async () => {
    fallar = true;
    enRouter(<Busqueda />);
    await screen.findByRole('alert');
    fallar = false;
    consultadas.length = 0;
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await vi.waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(consultadas.length).toBe(8);
  });

  it('si se desmonta antes de resolver getDocs no actualiza estado ni registra error', async () => {
    let liberar!: () => void;
    retener = new Promise<void>((r) => { liberar = r; });
    const { unmount } = enRouter(<Busqueda />);
    await vi.waitFor(() => expect(consultadas.length).toBe(8));
    unmount();
    await act(async () => {
      liberar();
      await Promise.resolve();
    });
    expect(console.error).not.toHaveBeenCalled();
  });

  it('si se desmonta y la carga falla después, tampoco registra error', async () => {
    fallar = true;
    let liberar!: () => void;
    retener = new Promise<void>((r) => { liberar = r; });
    const { unmount } = enRouter(<Busqueda />);
    await vi.waitFor(() => expect(consultadas.length).toBe(8));
    unmount();
    await act(async () => {
      liberar();
      await Promise.resolve();
    });
    expect(console.error).not.toHaveBeenCalled();
  });
});
