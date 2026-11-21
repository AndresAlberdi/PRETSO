import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import AccesoForm from '../components/AccesoForm';
import UserManagement from '../pages/UserManagement';

vi.mock('firebase/app', () => ({ initializeApp: vi.fn(() => ({})) }));
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({})),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signInWithPopup: vi.fn(),
  GoogleAuthProvider: vi.fn(function GoogleAuthProvider() {}),
}));
vi.mock('../firebase', () => ({ auth: {}, functions: {}, firebaseConfig: {} }));
vi.mock('firebase/functions', () => ({
  getFunctions: vi.fn(() => ({})),
  httpsCallable: vi.fn(() => vi.fn().mockResolvedValue({ data: { accounts: [], truncated: false } })),
}));
vi.mock('../context/AdminContext', () => ({
  useAdmin: () => ({ authNotice: null, clearAuthNotice: vi.fn() }),
}));

beforeEach(() => {
  vi.mocked(signInWithEmailAndPassword).mockReset();
  vi.mocked(createUserWithEmailAndPassword).mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Acceso (formulario de la portada)', () => {
  it('declara el autocompletado y anuncia cada fallo', async () => {
    vi.mocked(signInWithEmailAndPassword).mockRejectedValue(new Error('fallo'));
    render(<AccesoForm />);
    expect(screen.getByLabelText('Correo electrónico').getAttribute('autocomplete')).toBe('username');
    expect(screen.getByLabelText('Contraseña').getAttribute('autocomplete')).toBe('current-password');
    expect(screen.queryByRole('alert')).toBeNull();
    const form = screen.getByLabelText('Correo electrónico').closest('form') as HTMLFormElement;
    fireEvent.submit(form);
    expect((await screen.findByRole('alert')).textContent).toContain('No se pudo iniciar sesión. Inténtelo de nuevo.');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Entrar' })).toBeTruthy());
    fireEvent.submit(form);
    expect(screen.queryByRole('alert')).toBeNull();
    await waitFor(() => expect(signInWithEmailAndPassword).toHaveBeenCalledTimes(2));
    expect((await screen.findByRole('alert')).textContent).toContain('No se pudo iniciar sesión. Inténtelo de nuevo.');
  });

  it('no revela si la cuenta existe ni registra credenciales', async () => {
    const correo = 'persona.prueba@example.com';
    const clave = 'ClaveSecreta-123';
    const errorSpy = vi.mocked(console.error);
    errorSpy.mockClear();
    vi.mocked(signInWithEmailAndPassword)
      .mockRejectedValueOnce({ code: 'auth/user-not-found', message: 'Firebase: Error (auth/user-not-found).' })
      .mockRejectedValueOnce({ code: 'auth/wrong-password', message: 'Firebase: Error (auth/wrong-password).' });
    render(<AccesoForm />);
    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: correo } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: clave } });
    const form = screen.getByLabelText('Correo electrónico').closest('form') as HTMLFormElement;

    fireEvent.submit(form);
    const primera = (await screen.findByRole('alert')).textContent;
    expect(primera).toBe(
      'Correo o contraseña incorrectos. Si el problema persiste, comuníquese con la administración del proyecto.',
    );
    expect((primera ?? '').includes('auth/')).toBe(false);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Entrar' })).toBeTruthy());

    fireEvent.submit(form);
    await waitFor(() => expect(signInWithEmailAndPassword).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(errorSpy).toHaveBeenCalledTimes(2));
    expect((await screen.findByRole('alert')).textContent).toBe(primera);

    expect(errorSpy.mock.calls).toEqual([
      ['Error al iniciar sesión:', 'auth/user-not-found'],
      ['Error al iniciar sesión:', 'auth/wrong-password'],
    ]);
  });
});

describe('UserManagement', () => {
  it('ya no crea usuarios con contraseña: solo informa y lista las cuentas', async () => {
    render(<UserManagement />);
    expect(screen.getByRole('heading', { level: 1, name: 'Cuentas con acceso' })).toBeTruthy();
    expect(screen.queryByLabelText('Correo electrónico (lector)')).toBeNull();
    expect(screen.queryByRole('button', { name: /crear usuario/i })).toBeNull();
    expect(createUserWithEmailAndPassword).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toBeTruthy());
  });
});
