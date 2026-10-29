import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import Login from '../pages/Login';
import UserManagement from '../pages/UserManagement';

vi.mock('firebase/app', () => ({ initializeApp: vi.fn(() => ({})) }));
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({})),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signInWithPopup: vi.fn(),
  GoogleAuthProvider: vi.fn(function GoogleAuthProvider() {}),
}));
vi.mock('../firebase', () => ({ auth: {}, firebaseConfig: {} }));
vi.mock('react-router', () => ({ useNavigate: () => vi.fn() }));

beforeEach(() => {
  vi.mocked(signInWithEmailAndPassword).mockReset();
  vi.mocked(createUserWithEmailAndPassword).mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Login', () => {
  it('declara el autocompletado y anuncia cada fallo', async () => {
    vi.mocked(signInWithEmailAndPassword).mockRejectedValue(new Error('fallo'));
    render(<Login />);
    expect(screen.getByLabelText('Correo Electrónico').getAttribute('autocomplete')).toBe('username');
    expect(screen.getByLabelText('Contraseña').getAttribute('autocomplete')).toBe('current-password');
    expect(screen.queryByRole('alert')).toBeNull();
    const form = screen.getByLabelText('Correo Electrónico').closest('form') as HTMLFormElement;
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
    render(<Login />);
    fireEvent.change(screen.getByLabelText('Correo Electrónico'), { target: { value: correo } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: clave } });
    const form = screen.getByLabelText('Correo Electrónico').closest('form') as HTMLFormElement;

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
  it('asocia etiquetas, no autocompleta el correo ajeno y anuncia el resultado', async () => {
    render(<UserManagement />);
    const correo = screen.getByLabelText('Correo Electrónico (Lector)') as HTMLInputElement;
    const clave = screen.getByLabelText('Contraseña') as HTMLInputElement;
    expect(correo.type).toBe('email');
    expect(correo.getAttribute('autocomplete')).toBe('off');
    expect(clave.getAttribute('autocomplete')).toBe('new-password');

    vi.mocked(createUserWithEmailAndPassword).mockRejectedValueOnce(new Error('ya existe'));
    fireEvent.change(correo, { target: { value: 'a@b.co' } });
    fireEvent.change(clave, { target: { value: '123456' } });
    fireEvent.submit(correo.closest('form') as HTMLFormElement);
    expect((await screen.findByRole('alert')).textContent).toContain('Error al crear usuario:');

    vi.mocked(createUserWithEmailAndPassword).mockResolvedValueOnce({} as never);
    fireEvent.submit(correo.closest('form') as HTMLFormElement);
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('creado exitosamente como lector'));
  });

  it('no registra el correo ni muestra textos crudos al fallar el alta', async () => {
    const errorSpy = vi.mocked(console.error);
    errorSpy.mockClear();
    vi.mocked(createUserWithEmailAndPassword)
      .mockRejectedValueOnce({
        code: 'auth/email-already-in-use',
        message: 'Firebase: Error (auth/email-already-in-use).',
        customData: { email: 'persona@example.com' },
      })
      .mockRejectedValueOnce({ code: 'auth/weak-password', message: 'Firebase: Error (auth/weak-password).' });
    render(<UserManagement />);
    const correo = screen.getByLabelText('Correo Electrónico (Lector)') as HTMLInputElement;
    fireEvent.change(correo, { target: { value: 'persona@example.com' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: '123456' } });
    const form = correo.closest('form') as HTMLFormElement;

    fireEvent.submit(form);
    const primera = (await screen.findByRole('alert')).textContent ?? '';
    expect(primera).toBe('Error al crear usuario: Ya existe un usuario con ese correo.');
    expect(primera.includes('auth/')).toBe(false);
    expect(primera.includes('Firebase')).toBe(false);
    await waitFor(() => expect(errorSpy).toHaveBeenCalledTimes(1));
    expect(errorSpy.mock.calls).toEqual([['Error al crear usuario:', 'auth/email-already-in-use']]);

    await waitFor(() => expect(screen.getByRole('button', { name: /crear/i })).toBeTruthy());
    fireEvent.submit(form);
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe(
        'Error al crear usuario: La contraseña es demasiado débil; use al menos 6 caracteres.',
      ),
    );
    await waitFor(() => expect(errorSpy).toHaveBeenCalledTimes(2));
    expect(errorSpy.mock.calls).toEqual([
      ['Error al crear usuario:', 'auth/email-already-in-use'],
      ['Error al crear usuario:', 'auth/weak-password'],
    ]);
  });
});
