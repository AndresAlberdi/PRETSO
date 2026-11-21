import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
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
