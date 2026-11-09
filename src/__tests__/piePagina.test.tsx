import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

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
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, nombre: string) => nombre,
  query: (nombre: string) => nombre,
  getDocs: async () => ({ docs: [] }),
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

import App from '../App';
import SinAcceso from '../pages/SinAcceso';
import { MemoryRouter } from 'react-router';
import { PAGINAS_LEGALES, PIE } from '../legal/textosLegales';

function irA(ruta: string) {
  window.history.pushState({}, '', ruta);
  return render(<App />);
}

const ENLACES: Array<[string, string]> = [
  ['Aviso legal', '/aviso-legal'],
  ['Privacidad', '/privacidad'],
  ['Cookies', '/cookies'],
  ['Accesibilidad', '/accesibilidad'],
  ['Créditos', '/creditos'],
];

beforeEach(() => {
  estado = base();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('pie de página legal', () => {
  it.each(['/', '/caja'])('aparece en %s con un solo contentinfo', (ruta) => {
    irA(ruta);
    expect(screen.getAllByRole('contentinfo')).toHaveLength(1);
    expect(screen.getByRole('navigation', { name: 'Información legal' })).toBeTruthy();
  });

  it('aparece en SinAcceso', () => {
    estado = { ...base(), user: { uid: 'a', email: 'a@b.c' } };
    render(<MemoryRouter><SinAcceso /></MemoryRouter>);
    expect(screen.getAllByRole('contentinfo')).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Aviso legal' })).toBeTruthy();
  });

  it.each(ENLACES)('el enlace «%s» lleva a %s', (texto, ruta) => {
    irA('/');
    const enlace = screen.getByRole('navigation', { name: 'Información legal' }).querySelector(`a[href="${ruta}"]`);
    expect(enlace?.textContent).toBe(texto);
  });
});

describe('pie de la portada', () => {
  it('solo la portada muestra titularidad, financiación y recuadro; las demás páginas, solo los enlaces', () => {
    irA('/');
    expect(screen.getByText(PIE.titularidad)).toBeTruthy();
    expect(screen.getByText(PIE.financiacion)).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Sobre PRETSO' }).textContent).toBe('');
    cleanup();
    irA('/caja');
    expect(screen.queryByText(PIE.titularidad)).toBeNull();
    expect(screen.queryByText(PIE.financiacion)).toBeNull();
    expect(screen.queryByRole('region', { name: 'Sobre PRETSO' })).toBeNull();
    expect(screen.queryByRole('button', { name: /README/ })).toBeNull();
    expect(screen.getByRole('navigation', { name: 'Información legal' })).toBeTruthy();
  });

  it('el README se abre en una ventana modal con descarga y se cierra', () => {
    irA('/');
    fireEvent.click(screen.getByRole('button', { name: /README\.md/ }));
    const dialogo = screen.getByRole('dialog');
    expect(dialogo.textContent).toContain('Precios del Teatro del Siglo de Oro');
    expect(screen.getByRole('button', { name: 'Descargar README.md' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('la puerta de publicación trata el recuadro vacío como pendiente', () => {
    expect(PIE.explicacion).toBe('');
  });
});

describe('páginas legales sin sesión', () => {
  it.each(Object.entries(PAGINAS_LEGALES))('%s es accesible y tiene un único h1', (ruta, pagina) => {
    irA(ruta);
    expect(window.location.pathname).toBe(ruta);
    const h1 = screen.getAllByRole('heading', { level: 1 });
    expect(h1).toHaveLength(1);
    expect(h1[0].textContent).toBe(pagina.titulo);
    expect(screen.getAllByRole('heading', { level: 2 }).length).toBe(pagina.secciones.length);
    expect(screen.getByRole('link', { name: 'Inicio' })).toBeTruthy();
    expect(screen.getAllByRole('contentinfo')).toHaveLength(1);
  });
});
