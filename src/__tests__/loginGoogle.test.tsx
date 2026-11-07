import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import AccesoForm from '../components/AccesoForm';

const avisoMock = vi.hoisted(() => ({ aviso: null as string | null, limpiar: vi.fn() }));

vi.mock('firebase/app', () => ({ initializeApp: vi.fn(() => ({})) }));
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({})),
  signInWithEmailAndPassword: vi.fn(),
  signInWithPopup: vi.fn(),
  GoogleAuthProvider: vi.fn(function GoogleAuthProvider() {}),
}));
vi.mock('../firebase', () => ({ auth: {}, firebaseConfig: {} }));
vi.mock('../context/AdminContext', () => ({
  useAdmin: () => ({ authNotice: avisoMock.aviso, clearAuthNotice: avisoMock.limpiar }),
}));

const NO_AUTORIZADA =
  'Esta cuenta de Google no está autorizada en PRETSO. Solicite el acceso a la administración del proyecto.';
const CERRADA = 'Se cerró la ventana de Google antes de terminar. Inténtelo de nuevo.';

let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.mocked(signInWithPopup).mockReset();
  avisoMock.aviso = null;
  avisoMock.limpiar.mockReset();
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Login con Google', () => {
  it('éxito: abre el popup una vez, sin navegar ni mostrar alertas', async () => {
    vi.mocked(signInWithPopup).mockResolvedValue({} as never);
    render(<AccesoForm />);
    fireEvent.click(screen.getByRole('button', { name: 'Continuar con Google' }));
    // Sin await previo: el navegador solo permite el popup si sale del propio clic.
    expect(signInWithPopup).toHaveBeenCalledTimes(1);
    await waitFor(() => expect((screen.getByRole('button', { name: 'Continuar con Google' }) as HTMLButtonElement).disabled).toBe(false));
    expect(signInWithPopup).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).toBeNull();
    const [authArg, provider] = vi.mocked(signInWithPopup).mock.calls[0];
    expect(authArg).toEqual({});
    expect(provider).toBeInstanceOf(GoogleAuthProvider);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('pendiente: ambos botones quedan deshabilitados', async () => {
    vi.mocked(signInWithPopup).mockReturnValue(new Promise(() => undefined));
    render(<AccesoForm />);
    fireEvent.click(screen.getByRole('button', { name: 'Continuar con Google' }));
    const google = await screen.findByRole('button', { name: 'Conectando con Google...' });
    expect(google.getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByRole('button', { name: 'Entrar' }).getAttribute('aria-disabled')).toBe('true');
  });

  it('rechazo no autorizado: un alert, registro solo con el código y sin navegar', async () => {
    vi.mocked(signInWithPopup).mockRejectedValue({
      code: 'auth/admin-restricted-operation',
      customData: { email: 'persona@example.com' },
    });
    render(<AccesoForm />);
    fireEvent.click(screen.getByRole('button', { name: 'Continuar con Google' }));
    const alerts = await screen.findAllByRole('alert');
    expect(alerts).toHaveLength(1);
    expect(alerts[0].textContent).toBe(NO_AUTORIZADA);
    expect(errorSpy.mock.calls).toEqual([['Error al iniciar sesión con Google:', 'auth/admin-restricted-operation']]);
    expect(document.body.textContent).not.toContain('persona@example.com');
    expect((screen.getByRole('button', { name: 'Continuar con Google' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('popup cerrado: muestra su texto y un segundo clic limpia el alert', async () => {
    vi.mocked(signInWithPopup).mockRejectedValueOnce({ code: 'auth/popup-closed-by-user' });
    vi.mocked(signInWithPopup).mockReturnValueOnce(new Promise(() => undefined));
    render(<AccesoForm />);
    fireEvent.click(screen.getByRole('button', { name: 'Continuar con Google' }));
    expect((await screen.findByRole('alert')).textContent).toBe(CERRADA);
    fireEvent.click(screen.getByRole('button', { name: 'Continuar con Google' }));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });

  it('el botón es type="button" y el envío del formulario no abre el popup', () => {
    const { container } = render(<AccesoForm />);
    expect(screen.getByRole('button', { name: 'Continuar con Google' }).getAttribute('type')).toBe('button');
    fireEvent.submit(container.querySelector('form') as HTMLFormElement);
    expect(signInWithPopup).not.toHaveBeenCalled();
  });

  it('no tiene h1 (lo pone la portada) y sí el h2 «Iniciar sesión»', () => {
    render(<AccesoForm />);
    expect(screen.queryAllByRole('heading', { level: 1 })).toHaveLength(0);
    expect(screen.getByRole('heading', { level: 2, name: 'Iniciar sesión' })).toBeTruthy();
  });

  it('con aviso de la administración: un alert con el texto y el foco en él', () => {
    avisoMock.aviso = 'Aviso de prueba';
    render(<AccesoForm />);
    const alerta = screen.getByRole('alert');
    expect(alerta.textContent).toBe('Aviso de prueba');
    expect(document.activeElement).toBe(alerta);
  });

  it('un intento nuevo (Google o formulario) limpia el aviso', async () => {
    vi.mocked(signInWithPopup).mockResolvedValue({} as never);
    const { container } = render(<AccesoForm />);
    fireEvent.click(screen.getByRole('button', { name: 'Continuar con Google' }));
    expect(avisoMock.limpiar).toHaveBeenCalledTimes(1);
    // El intento previo debe terminar: con una acción en curso se ignoran los nuevos intentos.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Continuar con Google' })).toBeTruthy());
    fireEvent.submit(container.querySelector('form') as HTMLFormElement);
    expect(avisoMock.limpiar).toHaveBeenCalledTimes(2);
  });

  it('el marcador del correo no sugiere una cuenta de administración', () => {
    render(<AccesoForm />);
    expect(screen.getByLabelText('Correo electrónico').getAttribute('placeholder')).toBe('nombre@example.com');
  });
});
