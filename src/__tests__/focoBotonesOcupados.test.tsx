import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { signInWithEmailAndPassword, signInWithPopup, createUserWithEmailAndPassword } from 'firebase/auth';
import AccesoForm from '../components/AccesoForm';
import UserManagement from '../pages/UserManagement';
import Administracion from '../pages/Administracion';
import { generateDatabaseXml } from '../utils/backup';
import { generateDatabaseXlsx } from '../utils/xlsxExport';
import { leerDatosDataset } from '../utils/dataset/leerDatos';

vi.mock('firebase/app', () => ({ initializeApp: vi.fn(() => ({})) }));
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({})),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signInWithPopup: vi.fn(),
  GoogleAuthProvider: vi.fn(function GoogleAuthProvider() {}),
}));
vi.mock('../firebase', () => ({ auth: {}, db: {}, functions: {}, firebaseConfig: {} }));
vi.mock('firebase/functions', () => ({
  getFunctions: vi.fn(() => ({})),
  httpsCallable: vi.fn(() => vi.fn().mockResolvedValue({ data: { accounts: [], truncated: false } })),
}));
vi.mock('../context/AdminContext', () => ({
  useAdmin: () => ({ authNotice: null, clearAuthNotice: vi.fn() }),
}));
vi.mock('../utils/backup', () => ({
  generateDatabaseXml: vi.fn(), downloadXml: vi.fn(), generateZipBlob: vi.fn(), uploadToGoogleDrive: vi.fn(),
}));
vi.mock('../utils/xlsxExport', () => ({ generateDatabaseXlsx: vi.fn(), downloadXlsx: vi.fn() }));
vi.mock('../utils/dataset/leerDatos', () => ({ leerDatosDataset: vi.fn() }));
vi.mock('../utils/dataset/generarDataset', () => ({ generarDatasetZip: vi.fn() }));
vi.mock('react-router', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
}));

beforeEach(() => {
  localStorage.clear();
  vi.mocked(signInWithEmailAndPassword).mockReset();
  vi.mocked(signInWithPopup).mockReset();
  vi.mocked(createUserWithEmailAndPassword).mockReset();
  vi.mocked(generateDatabaseXml).mockReset();
  vi.mocked(generateDatabaseXlsx).mockReset();
  vi.mocked(leerDatosDataset).mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// Pulsa el botón con la acción pendiente y comprueba que conserva el foco y que otro clic no repite la llamada.
async function pulsarDosVeces(boton: HTMLElement, llamadas: { mock: { calls: unknown[] } }) {
  boton.focus();
  fireEvent.click(boton);
  await waitFor(() => expect(boton.getAttribute('aria-disabled')).toBe('true'));
  expect(boton.hasAttribute('disabled')).toBe(false);
  expect(document.activeElement).toBe(boton);
  fireEvent.click(boton);
  expect(llamadas.mock.calls).toHaveLength(1);
  expect(document.activeElement).toBe(boton);
}

describe('botones ocupados conservan el foco', () => {
  it('Entrar', async () => {
    vi.mocked(signInWithEmailAndPassword).mockReturnValue(new Promise(() => undefined));
    render(<AccesoForm />);
    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'a@example.com' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'x' } });
    await pulsarDosVeces(screen.getByRole('button', { name: 'Entrar' }), vi.mocked(signInWithEmailAndPassword));
  });

  it('con Google pendiente, enviar el formulario no inicia sesión con correo', async () => {
    vi.mocked(signInWithPopup).mockReturnValue(new Promise(() => undefined));
    const { container } = render(<AccesoForm />);
    fireEvent.click(screen.getByRole('button', { name: 'Continuar con Google' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Conectando con Google...' })).toBeTruthy());
    fireEvent.submit(container.querySelector('form') as HTMLFormElement);
    expect(signInWithEmailAndPassword).not.toHaveBeenCalled();
  });

  it('Continuar con Google', async () => {
    vi.mocked(signInWithPopup).mockReturnValue(new Promise(() => undefined));
    render(<AccesoForm />);
    await pulsarDosVeces(screen.getByRole('button', { name: 'Continuar con Google' }), vi.mocked(signInWithPopup));
  });

  it('Crear usuario lector', async () => {
    vi.mocked(createUserWithEmailAndPassword).mockReturnValue(new Promise(() => undefined));
    render(<UserManagement />);
    fireEvent.change(screen.getByLabelText('Correo electrónico (lector)'), { target: { value: 'l@example.com' } });
    fireEvent.change(screen.getByLabelText(/Contraseña/), { target: { value: 'ClaveSegura-1' } });
    await pulsarDosVeces(screen.getByRole('button', { name: 'Crear usuario lector' }), vi.mocked(createUserWithEmailAndPassword));
  });

  it.each([
    ['Descargar base de datos (XML)', generateDatabaseXml],
    ['Descargar base de datos (XLSX)', generateDatabaseXlsx],
    ['Descargar dataset (ZIP)', leerDatosDataset],
  ])('%s', async (nombre, accion) => {
    vi.mocked(accion as () => Promise<unknown>).mockReturnValue(new Promise(() => undefined));
    render(<Administracion />);
    await pulsarDosVeces(screen.getByRole('button', { name: nombre }), vi.mocked(accion));
    // Los demás botones de respaldo tampoco se pueden activar mientras tanto.
    expect(screen.getByRole('button', { name: 'Copia a Google Drive' }).getAttribute('aria-disabled')).toBe('true');
  });
});
