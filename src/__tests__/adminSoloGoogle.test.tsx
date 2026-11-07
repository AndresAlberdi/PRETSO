import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor, cleanup } from '@testing-library/react';

type AuthCb = (u: unknown) => void;
let authCb: AuthCb;
const getIdTokenResult = vi.fn();
const signOut = vi.fn(() => {
  authCb(null);
  return Promise.resolve();
});

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth: unknown, cb: AuthCb) => {
    authCb = cb;
    return () => undefined;
  },
  getIdTokenResult: (...args: unknown[]) => getIdTokenResult(...args),
  signOut: () => signOut(),
  signInWithEmailAndPassword: vi.fn(),
  signInWithPopup: vi.fn(),
  GoogleAuthProvider: vi.fn(function GoogleAuthProvider() {}),
}));
vi.mock('../firebase', () => ({ auth: {} }));

import { AdminProvider } from '../context/AdminContext';
import HomeRoute from '../components/HomeRoute';
import ReaderRoute from '../components/ReaderRoute';
import Portada from '../pages/Portada';
import { MemoryRouter } from 'react-router';

const protegido = vi.fn();
function Protegido() {
  protegido();
  return <main id="contenido" tabIndex={-1}>datos protegidos</main>;
}

function Inicio() {
  return (
    <AdminProvider>
      <HomeRoute
        signedOut={<main id="contenido" tabIndex={-1}><MemoryRouter><Portada modo="visitante" /></MemoryRouter></main>}
        signedIn={<ReaderRoute><Protegido /></ReaderRoute>}
      />
    </AdminProvider>
  );
}

const usuario = { uid: 'a', email: 'a@example.com' };

beforeEach(() => {
  getIdTokenResult.mockReset();
  signOut.mockClear();
  protegido.mockClear();
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('administración solo por Google (integración)', () => {
  it('admin con contraseña: nunca monta contenido protegido y ve el aviso con el foco', async () => {
    getIdTokenResult.mockResolvedValue({ claims: { admin: true }, signInProvider: 'password' });
    render(<Inicio />);
    await act(async () => { authCb(null); });
    const boton = screen.getByRole('button', { name: 'Acceso para administración' });
    expect(boton.getAttribute('aria-expanded')).toBe('false');
    await act(async () => { authCb(usuario); });
    const alerta = await screen.findByRole('alert');
    expect(alerta.textContent).toContain('solo pueden entrar con «Continuar con Google»');
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(protegido).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Acceso para administración' }).getAttribute('aria-expanded')).toBe('true');
    await waitFor(() => expect(document.activeElement).toBe(alerta));
  });

  it('admin con Google: entra a lo protegido', async () => {
    getIdTokenResult.mockResolvedValue({ claims: { admin: true }, signInProvider: 'google.com' });
    render(<Inicio />);
    await act(async () => { authCb(usuario); });
    expect(await screen.findByText('datos protegidos')).toBeTruthy();
    expect(signOut).not.toHaveBeenCalled();
  });

  it('lector con contraseña: entra a lo protegido', async () => {
    getIdTokenResult.mockResolvedValue({ claims: { reader: true }, signInProvider: 'password' });
    render(<Inicio />);
    await act(async () => { authCb(usuario); });
    expect(await screen.findByText('datos protegidos')).toBeTruthy();
    expect(signOut).not.toHaveBeenCalled();
  });
});
