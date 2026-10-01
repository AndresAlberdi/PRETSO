import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor, cleanup } from '@testing-library/react';

type AuthCb = (u: unknown) => void;
let authCb: AuthCb;
const unsubscribe = vi.fn();
const getIdTokenResult = vi.fn();

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth: unknown, cb: AuthCb) => {
    authCb = cb;
    return unsubscribe;
  },
  getIdTokenResult: (...args: unknown[]) => getIdTokenResult(...args),
}));
vi.mock('../firebase', () => ({ auth: { currentUser: null } }));

import { AdminProvider, useAdmin } from '../context/AdminContext';

function Probe() {
  const { isAdmin, isEditMode, setIsEditMode, adminLoading } = useAdmin();
  return (
    <div>
      <span data-testid="admin">{String(isAdmin)}</span>
      <span data-testid="edit">{String(isEditMode)}</span>
      <span data-testid="loading">{String(adminLoading)}</span>
      <button onClick={() => setIsEditMode(true)}>editar</button>
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
  vi.spyOn(console, 'error').mockImplementation(() => {});
  render(<AdminProvider><Probe /></AdminProvider>);
});

describe('AdminProvider', () => {
  it('fuerza el refresco del token y concede isAdmin con el claim', async () => {
    getIdTokenResult.mockResolvedValue({ claims: { admin: true } });
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
    const first = deferred<{ claims: Record<string, unknown> }>();
    const second = deferred<{ claims: Record<string, unknown> }>();
    getIdTokenResult.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    await act(async () => { authCb(userA); });
    await act(async () => { authCb(null); });
    await act(async () => { authCb(userA); });
    // La primera resolución (obsoleta) concede admin: debe ignorarse.
    await act(async () => { first.resolve({ claims: { admin: true } }); });
    expect(screen.getByTestId('admin').textContent).toBe('false');
    expect(screen.getByTestId('loading').textContent).toBe('true');
    await act(async () => { second.resolve({ claims: {} }); });
    expect(screen.getByTestId('admin').textContent).toBe('false');
    expect(screen.getByTestId('loading').textContent).toBe('false');
  });

  it('al cerrar sesión isAdmin e isEditMode quedan en falso', async () => {
    getIdTokenResult.mockResolvedValue({ claims: { admin: true } });
    await act(async () => { authCb(userA); });
    await act(async () => { screen.getByText('editar').click(); });
    expect(screen.getByTestId('edit').textContent).toBe('true');
    await act(async () => { authCb(null); });
    expect(screen.getByTestId('admin').textContent).toBe('false');
    expect(screen.getByTestId('edit').textContent).toBe('false');
  });
});
