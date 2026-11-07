import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor, cleanup } from '@testing-library/react';

type AuthCb = (u: unknown) => void;
let authCb: AuthCb;
const unsubscribe = vi.fn();
const getIdTokenResult = vi.fn();
const signOut = vi.fn((..._a: unknown[]) => Promise.resolve());

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth: unknown, cb: AuthCb) => {
    authCb = cb;
    return unsubscribe;
  },
  getIdTokenResult: (...args: unknown[]) => getIdTokenResult(...args),
  signOut: (...args: unknown[]) => signOut(...args),
}));
vi.mock('../firebase', () => ({ auth: { currentUser: null } }));

import { AdminProvider, useAdmin } from '../context/AdminContext';

function Probe() {
  const { isAdmin, isReader, isEditMode, setIsEditMode, adminLoading, authNotice, clearAuthNotice } = useAdmin();
  return (
    <div>
      <span data-testid="admin">{String(isAdmin)}</span>
      <span data-testid="reader">{String(isReader)}</span>
      <span data-testid="edit">{String(isEditMode)}</span>
      <span data-testid="loading">{String(adminLoading)}</span>
      <span data-testid="notice">{authNotice ?? ''}</span>
      <button onClick={() => setIsEditMode(true)}>editar</button>
      <button onClick={clearAuthNotice}>limpiar</button>
    </div>
  );
}

const userA = { uid: 'a', email: 'a@example.com' };

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

beforeEach(() => {
  getIdTokenResult.mockReset();
  signOut.mockClear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  render(<AdminProvider><Probe /></AdminProvider>);
});

const AVISO = 'Las cuentas de administración solo pueden entrar con «Continuar con Google». Se cerró la sesión; vuelva a entrar con Google.';

describe('AdminProvider: administración solo por Google', () => {
  it('admin con contraseña: cierra la sesión sin privilegios y deja el aviso', async () => {
    getIdTokenResult.mockResolvedValue({ claims: { admin: true }, signInProvider: 'password' });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await act(async () => { authCb(userA); });
    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('admin').textContent).toBe('false');
    expect(screen.getByTestId('loading').textContent).toBe('true');
    expect(screen.getByTestId('notice').textContent).toBe(AVISO);
    await act(async () => { authCb(null); });
    expect(screen.getByTestId('loading').textContent).toBe('false');
    expect(screen.getByTestId('notice').textContent).toBe(AVISO);
    await act(async () => { screen.getByText('limpiar').click(); });
    expect(screen.getByTestId('notice').textContent).toBe('');
  });

  it('admin sin proveedor conocido (null) también se bloquea', async () => {
    getIdTokenResult.mockResolvedValue({ claims: { admin: true }, signInProvider: null });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await act(async () => { authCb(userA); });
    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
  });

  it('admin y lector con contraseña: se bloquea y no queda lector', async () => {
    getIdTokenResult.mockResolvedValue({ claims: { admin: true, reader: true }, signInProvider: 'password' });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await act(async () => { authCb(userA); });
    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('reader').textContent).toBe('false');
  });

  it('lector con contraseña entra: sin cierre de sesión ni aviso', async () => {
    getIdTokenResult.mockResolvedValue({ claims: { reader: true }, signInProvider: 'password' });
    await act(async () => { authCb(userA); });
    await waitFor(() => expect(screen.getByTestId('reader').textContent).toBe('true'));
    expect(signOut).not.toHaveBeenCalled();
    expect(screen.getByTestId('notice').textContent).toBe('');
  });

  it('admin con Google entra sin cierre de sesión', async () => {
    getIdTokenResult.mockResolvedValue({ claims: { admin: true }, signInProvider: 'google.com' });
    await act(async () => { authCb(userA); });
    await waitFor(() => expect(screen.getByTestId('admin').textContent).toBe('true'));
    expect(signOut).not.toHaveBeenCalled();
  });

  it('si el cierre falla: sin privilegios, sin cargar y registra solo el código', async () => {
    getIdTokenResult.mockResolvedValue({ claims: { admin: true }, signInProvider: 'password' });
    signOut.mockRejectedValueOnce({ code: 'auth/network-request-failed', message: 'a@example.com' });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await act(async () => { authCb(userA); });
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(screen.getByTestId('admin').textContent).toBe('false');
    expect(vi.mocked(console.error).mock.calls).toContainEqual(['No se pudo cerrar la sesión de administración:', 'auth/network-request-failed']);
  });

  it('un resultado viejo de admin con contraseña no cierra la sesión nueva', async () => {
    const first = deferred<{ claims: Record<string, unknown>; signInProvider: string }>();
    getIdTokenResult.mockReturnValueOnce(first.promise);
    await act(async () => { authCb(userA); });
    getIdTokenResult.mockResolvedValueOnce({ claims: { reader: true }, signInProvider: 'password' });
    await act(async () => { authCb({ uid: 'b', email: 'b@example.com' }); });
    await act(async () => { first.resolve({ claims: { admin: true }, signInProvider: 'password' }); });
    expect(signOut).not.toHaveBeenCalled();
    expect(screen.getByTestId('reader').textContent).toBe('true');
  });

  it('una entrada permitida posterior borra el aviso viejo', async () => {
    getIdTokenResult.mockResolvedValueOnce({ claims: { admin: true }, signInProvider: 'password' });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await act(async () => { authCb(userA); });
    await waitFor(() => expect(screen.getByTestId('notice').textContent).toBe(AVISO));
    getIdTokenResult.mockResolvedValueOnce({ claims: { admin: true }, signInProvider: 'google.com' });
    await act(async () => { authCb(userA); });
    await waitFor(() => expect(screen.getByTestId('admin').textContent).toBe('true'));
    expect(screen.getByTestId('notice').textContent).toBe('');
  });

  it('el aviso del registro no incluye el correo', async () => {
    getIdTokenResult.mockResolvedValue({ claims: { admin: true }, signInProvider: 'password' });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await act(async () => { authCb(userA); });
    await waitFor(() => expect(warn).toHaveBeenCalled());
    expect(JSON.stringify(warn.mock.calls)).not.toContain('a@example.com');
  });
});

describe('AdminProvider', () => {
  it('fuerza el refresco del token y concede isAdmin con el claim', async () => {
    getIdTokenResult.mockResolvedValue({ claims: { admin: true }, signInProvider: 'google.com' });
    await act(async () => { authCb(userA); });
    expect(getIdTokenResult).toHaveBeenCalledWith(userA, true);
    await waitFor(() => expect(screen.getByTestId('admin').textContent).toBe('true'));
    expect(screen.getByTestId('loading').textContent).toBe('false');
  });

  it('no concede isAdmin sin claim o con claim no booleano', async () => {
    getIdTokenResult.mockResolvedValue({ claims: { admin: 'true' } });
    await act(async () => { authCb(userA); });
    expect(screen.getByTestId('admin').textContent).toBe('false');
  });

  it('un error al leer el claim deja isAdmin en falso', async () => {
    getIdTokenResult.mockRejectedValue({ code: 'auth/network-request-failed' });
    await act(async () => { authCb(userA); });
    expect(screen.getByTestId('admin').textContent).toBe('false');
    expect(screen.getByTestId('loading').textContent).toBe('false');
  });

  it('descarta el resultado obsoleto en la secuencia A -> null -> A', async () => {
    const first = deferred<{ claims: Record<string, unknown>; signInProvider?: string }>();
    const second = deferred<{ claims: Record<string, unknown> }>();
    getIdTokenResult.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    await act(async () => { authCb(userA); });
    await act(async () => { authCb(null); });
    await act(async () => { authCb(userA); });
    // La primera resolución (obsoleta) concede admin: debe ignorarse.
    await act(async () => { first.resolve({ claims: { admin: true }, signInProvider: 'google.com' }); });
    expect(screen.getByTestId('admin').textContent).toBe('false');
    expect(screen.getByTestId('loading').textContent).toBe('true');
    await act(async () => { second.resolve({ claims: {} }); });
    expect(screen.getByTestId('admin').textContent).toBe('false');
    expect(screen.getByTestId('loading').textContent).toBe('false');
  });

  it('al cerrar sesión isAdmin e isEditMode quedan en falso', async () => {
    getIdTokenResult.mockResolvedValue({ claims: { admin: true }, signInProvider: 'google.com' });
    await act(async () => { authCb(userA); });
    await act(async () => { screen.getByText('editar').click(); });
    expect(screen.getByTestId('edit').textContent).toBe('true');
    await act(async () => { authCb(null); });
    expect(screen.getByTestId('admin').textContent).toBe('false');
    expect(screen.getByTestId('edit').textContent).toBe('false');
  });

  it('concede isReader con reader:true y no isAdmin', async () => {
    getIdTokenResult.mockResolvedValue({ claims: { reader: true } });
    await act(async () => { authCb(userA); });
    await waitFor(() => expect(screen.getByTestId('reader').textContent).toBe('true'));
    expect(screen.getByTestId('admin').textContent).toBe('false');
  });

  it('no concede isReader con reader no booleano', async () => {
    getIdTokenResult.mockResolvedValue({ claims: { reader: 'true' } });
    await act(async () => { authCb(userA); });
    expect(screen.getByTestId('reader').textContent).toBe('false');
  });

  it('al cerrar sesión isReader queda en falso', async () => {
    getIdTokenResult.mockResolvedValue({ claims: { reader: true } });
    await act(async () => { authCb(userA); });
    expect(screen.getByTestId('reader').textContent).toBe('true');
    await act(async () => { authCb(null); });
    expect(screen.getByTestId('reader').textContent).toBe('false');
  });
});
