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
}));
vi.mock('../firebase', () => ({ auth: {}, firebaseConfig: {} }));
vi.mock('react-router', () => ({ useNavigate: () => vi.fn() }));

beforeEach(() => {
  vi.mocked(signInWithEmailAndPassword).mockReset();
  vi.mocked(createUserWithEmailAndPassword).mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(cleanup);

describe('Login', () => {
  it('declara el autocompletado y anuncia cada fallo', async () => {
    vi.mocked(signInWithEmailAndPassword).mockRejectedValue(new Error('fallo'));
    render(<Login />);
    expect(screen.getByLabelText('Correo Electrónico').getAttribute('autocomplete')).toBe('username');
    expect(screen.getByLabelText('Contraseña').getAttribute('autocomplete')).toBe('current-password');
    expect(screen.queryByRole('alert')).toBeNull();
    const form = screen.getByLabelText('Correo Electrónico').closest('form') as HTMLFormElement;
    fireEvent.submit(form);
    expect((await screen.findByRole('alert')).textContent).toContain('fallo');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Entrar' })).toBeTruthy());
    fireEvent.submit(form);
    await waitFor(() => expect(signInWithEmailAndPassword).toHaveBeenCalledTimes(2));
    expect((await screen.findByRole('alert')).textContent).toContain('fallo');
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
});
