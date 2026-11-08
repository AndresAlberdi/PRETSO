import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

vi.mock('../firebase', () => ({ db: {}, auth: {} }));
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth: unknown, cb: (u: unknown) => void) => {
    cb(null);
    return () => undefined;
  },
  signOut: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signInWithPopup: vi.fn(),
  GoogleAuthProvider: vi.fn(function GoogleAuthProvider() {}),
}));

const consultas: string[] = [];
let rechazar = false;
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, nombre: string) => nombre,
  query: (nombre: string) => nombre,
  getDocs: async (nombre: string) => {
    consultas.push(nombre);
    if (rechazar) throw { code: 'permission-denied', message: 'detalle técnico interno' };
    return { docs: [] };
  },
}));

type Estado = {
  user: unknown; isAdmin: boolean; isReader: boolean; isEditMode: boolean; adminLoading: boolean;
  authNotice: string | null; clearAuthNotice: () => void; setIsEditMode: () => void;
};
const base = (): Estado => ({
  user: null, isAdmin: false, isReader: false, isEditMode: false, adminLoading: false,
  authNotice: null, clearAuthNotice: () => undefined, setIsEditMode: () => undefined,
});
let estado: Estado = base();
vi.mock('../context/AdminContext', () => ({
  useAdmin: () => estado,
  AdminProvider: ({ children }: { children: React.ReactNode }) => children,
}));

const buscarEnIndice = vi.fn((..._args: unknown[]) => []);
vi.mock('../utils/busquedaGuia/indiceBusqueda', async (original) => ({
  ...(await original<typeof import('../utils/busquedaGuia/indiceBusqueda')>()),
  buscarEnIndice: (...args: unknown[]) => buscarEnIndice(...args),
}));

import App from '../App';
import { invalidarIndice } from '../utils/busquedaGuia/cargaIndice';

function irA(ruta: string) {
  window.history.pushState({}, '', ruta);
  return render(<App />);
}

beforeEach(() => {
  estado = base();
  rechazar = false;
  consultas.length = 0;
  buscarEnIndice.mockClear();
  invalidarIndice();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('visitante sin sesión', () => {
  it('/caja muestra la página y no redirige', async () => {
    irA('/caja');
    expect(window.location.pathname).toBe('/caja');
    await vi.waitFor(() => expect(consultas).toContain('manejo_de_caja'));
    expect(screen.queryByRole('heading', { level: 2, name: 'Iniciar sesión' })).toBeNull();
  });

  it('mientras se resuelve la sesión muestra «Cargando...» y no la página', () => {
    estado = { ...base(), adminLoading: true };
    irA('/caja');
    expect(screen.getByText('Cargando...')).toBeTruthy();
    expect(consultas).toHaveLength(0);
  });

  it('/administracion sin usuario lleva a «/»', async () => {
    irA('/administracion');
    await vi.waitFor(() => expect(window.location.pathname).toBe('/'));
  });

  it('la portada tiene el enlace y el botón de acceso, que abre el formulario', () => {
    irA('/');
    expect(screen.getByRole('link', { name: 'Realizar búsquedas' }).getAttribute('href')).toBe('/buscar');
    const boton = screen.getByRole('button', { name: 'Acceso para administración' });
    expect(boton.getAttribute('aria-expanded')).toBe('false');
    expect(boton.getAttribute('aria-controls')).toBe('acceso-panel');
    expect(screen.queryByRole('heading', { level: 2, name: 'Iniciar sesión' })).toBeNull();
    fireEvent.click(boton);
    expect(boton.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('heading', { level: 2, name: 'Iniciar sesión' })).toBeTruthy();
    expect(document.activeElement).not.toBe(screen.getByRole('heading', { level: 2, name: 'Iniciar sesión' }));
  });

  it('no ve controles de edición ni de administración', async () => {
    irA('/buscar');
    await vi.waitFor(() => expect(consultas.length).toBeGreaterThan(0));
    expect(screen.queryByText('Agregar transacción')).toBeNull();
    expect(screen.queryByText('Editar')).toBeNull();
    expect(screen.queryByText('Administración')).toBeNull();
    cleanup();
    irA('/');
    expect(screen.queryByText('Editar')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Administración' })).toBeNull();
  });

  it('con un aviso de acceso el panel empieza abierto', () => {
    estado = { ...base(), authNotice: 'Aviso de prueba' };
    irA('/');
    expect(screen.getByRole('button', { name: 'Acceso para administración' }).getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('alert').textContent).toBe('Aviso de prueba');
  });

  it('/buscar usa incluirAdmin: false', async () => {
    irA('/buscar?q=lope');
    await vi.waitFor(() => expect(buscarEnIndice).toHaveBeenCalled());
    expect(buscarEnIndice.mock.calls[0][2]).toEqual({ incluirAdmin: false });
  });

  it.each(['/caja', '/salarios', '/corpus', '/indicadores', '/companias', '/bibliografia'])(
    '%s: si Firestore rechaza la lectura muestra un texto útil sin detalle técnico',
    async (ruta) => {
      rechazar = true;
      irA(ruta);
      const aviso = await screen.findByRole('alert');
      expect(aviso.textContent).toBe('No se pudieron cargar los datos. Recargue la página; si el error persiste, avise al equipo técnico.');
      expect(document.body.textContent).not.toContain('permission-denied');
      expect(document.body.textContent).not.toContain('detalle técnico interno');
    },
  );
});
