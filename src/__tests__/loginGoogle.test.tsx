import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import Login from '../pages/Login';

const navigateMock = vi.hoisted(() => vi.fn());

vi.mock('firebase/app', () => ({ initializeApp: vi.fn(() => ({})) }));
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({})),
  signInWithEmailAndPassword: vi.fn(),
  signInWithPopup: vi.fn(),
  GoogleAuthProvider: vi.fn(function GoogleAuthProvider() {}),
}));
vi.mock('../firebase', () => ({ auth: {}, firebaseConfig: {} }));
vi.mock('react-router', () => ({ useNavigate: () => navigateMock }));

const NO_AUTORIZADA =
  'Esta cuenta de Google no está autorizada en PRETSO. Solicite el acceso a la administración del proyecto.';
const CERRADA = 'Se cerró la ventana de Google antes de terminar. Inténtelo de nuevo.';

let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.mocked(signInWithPopup).mockReset();
  navigateMock.mockReset();
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Login con Google', () => {
  it('éxito: abre el popup una vez y navega a la raíz', async () => {
    vi.mocked(signInWithPopup).mockResolvedValue({} as never);
    render(<Login />);
    fireEvent.click(screen.getByRole('button', { name: 'Continuar con Google' }));
    // Sin await previo: el navegador solo permite el popup si sale del propio clic.
    expect(signInWithPopup).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/', { replace: true }));
    expect(signInWithPopup).toHaveBeenCalledTimes(1);
    const [authArg, provider] = vi.mocked(signInWithPopup).mock.calls[0];
    expect(authArg).toEqual({});
    expect(provider).toBeInstanceOf(GoogleAuthProvider);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('pendiente: ambos botones quedan deshabilitados', async () => {
    vi.mocked(signInWithPopup).mockReturnValue(new Promise(() => undefined));
    render(<Login />);
    fireEvent.click(screen.getByRole('button', { name: 'Continuar con Google' }));
    const google = await screen.findByRole('button', { name: 'Conectando con Google...' });
    expect((google as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Entrar' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('rechazo no autorizado: un alert, registro solo con el código y sin navegar', async () => {
    vi.mocked(signInWithPopup).mockRejectedValue({
      code: 'auth/admin-restricted-operation',
      customData: { email: 'persona@example.com' },
    });
    render(<Login />);
    fireEvent.click(screen.getByRole('button', { name: 'Continuar con Google' }));
    const alerts = await screen.findAllByRole('alert');
    expect(alerts).toHaveLength(1);
    expect(alerts[0].textContent).toBe(NO_AUTORIZADA);
    expect(errorSpy.mock.calls).toEqual([['Error al iniciar sesión con Google:', 'auth/admin-restricted-operation']]);
    expect(navigateMock).not.toHaveBeenCalled();
    expect(document.body.textContent).not.toContain('persona@example.com');
    expect((screen.getByRole('button', { name: 'Continuar con Google' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('popup cerrado: muestra su texto y un segundo clic limpia el alert', async () => {
    vi.mocked(signInWithPopup).mockRejectedValueOnce({ code: 'auth/popup-closed-by-user' });
    vi.mocked(signInWithPopup).mockReturnValueOnce(new Promise(() => undefined));
    render(<Login />);
    fireEvent.click(screen.getByRole('button', { name: 'Continuar con Google' }));
    expect((await screen.findByRole('alert')).textContent).toBe(CERRADA);
    fireEvent.click(screen.getByRole('button', { name: 'Continuar con Google' }));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });

  it('el botón es type="button" y el envío del formulario no abre el popup', () => {
    const { container } = render(<Login />);
    expect(screen.getByRole('button', { name: 'Continuar con Google' }).getAttribute('type')).toBe('button');
    fireEvent.submit(container.querySelector('form') as HTMLFormElement);
    expect(signInWithPopup).not.toHaveBeenCalled();
  });

  it('tiene un solo h1', () => {
    render(<Login />);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });
});
