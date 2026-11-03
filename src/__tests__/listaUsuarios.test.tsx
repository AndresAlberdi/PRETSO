import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';

const llamada = vi.hoisted(() => vi.fn());
vi.mock('firebase/functions', () => ({
  getFunctions: vi.fn(() => ({})),
  httpsCallable: vi.fn(() => llamada),
}));
vi.mock('../firebase', () => ({ functions: {}, auth: {}, firebaseConfig: {} }));

import AccountList from '../components/AccountList';
import { parseAccountsResult } from '../utils/accounts';

const cuenta = (extra: Record<string, unknown> = {}) => ({
  email: 'ana@example.com', role: 'admin', providers: ['google'], disabled: false,
  lastSignInTime: '2026-10-01T12:00:00.000Z', ...extra,
});

let errorSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  llamada.mockReset();
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('AccountList', () => {
  it('muestra la tabla con etiquetas en español y «Nunca» sin último acceso', async () => {
    llamada.mockResolvedValue({ data: { truncated: false, accounts: [
      cuenta(),
      cuenta({ email: 'luis@example.com', role: 'reader', providers: ['password'], disabled: true, lastSignInTime: null }),
      cuenta({ email: null, role: 'none', providers: [] }),
    ] } });
    render(<AccountList refreshSignal={0} />);
    const tabla = await screen.findByRole('table', { name: 'Cuentas de acceso' });
    const filas = within(tabla).getAllByRole('row');
    expect(filas).toHaveLength(4);
    expect(within(filas[1]).getByText('Administrador')).toBeTruthy();
    expect(within(filas[1]).getByText('Google')).toBeTruthy();
    expect(within(filas[2]).getByText('Lector')).toBeTruthy();
    expect(within(filas[2]).getByText('Deshabilitada')).toBeTruthy();
    expect(within(filas[2]).getByText('Nunca')).toBeTruthy();
    expect(within(filas[3]).getByText('(sin correo)')).toBeTruthy();
    expect(within(filas[3]).getByText('—')).toBeTruthy();
  });

  it('no muestra campos fuera del contrato (uid)', async () => {
    llamada.mockResolvedValue({ data: { truncated: false, accounts: [cuenta({ uid: 'UID-SECRETO' })] } });
    render(<AccountList refreshSignal={0} />);
    await screen.findByRole('table');
    expect(document.body.textContent).not.toContain('UID-SECRETO');
  });

  it('permiso denegado: texto exacto y registro solo con el código', async () => {
    llamada.mockRejectedValue({ code: 'functions/permission-denied', message: 'ana@example.com' });
    render(<AccountList refreshSignal={0} />);
    expect((await screen.findByRole('alert')).textContent).toBe('Su cuenta no tiene permiso para ver la lista de usuarios.');
    expect(errorSpy.mock.calls).toEqual([['Error al listar usuarios:', 'functions/permission-denied']]);
  });

  it('error interno o respuesta inválida: texto genérico sin el mensaje crudo', async () => {
    llamada.mockRejectedValueOnce({ code: 'functions/internal', message: 'detalle técnico' });
    const { unmount } = render(<AccountList refreshSignal={0} />);
    expect((await screen.findByRole('alert')).textContent).toBe('No se pudo cargar la lista de usuarios. Inténtelo de nuevo.');
    expect(document.body.textContent).not.toContain('detalle técnico');
    unmount();
    llamada.mockResolvedValueOnce({ data: { accounts: 'no', truncated: false } });
    render(<AccountList refreshSignal={0} />);
    expect((await screen.findByRole('alert')).textContent).toBe('No se pudo cargar la lista de usuarios. Inténtelo de nuevo.');
  });

  it('truncado y lista vacía', async () => {
    llamada.mockResolvedValueOnce({ data: { truncated: true, accounts: [cuenta()] } });
    const { unmount } = render(<AccountList refreshSignal={0} />);
    expect(await screen.findByText('Se muestran las primeras 1000 cuentas.')).toBeTruthy();
    unmount();
    llamada.mockResolvedValueOnce({ data: { truncated: false, accounts: [] } });
    render(<AccountList refreshSignal={0} />);
    expect(await screen.findByText('No hay cuentas registradas.')).toBeTruthy();
  });

  it('«Actualizar lista» vuelve a pedir los datos', async () => {
    llamada.mockResolvedValue({ data: { truncated: false, accounts: [cuenta()] } });
    render(<AccountList refreshSignal={0} />);
    await screen.findByRole('table');
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar lista' }));
    await waitFor(() => expect(llamada).toHaveBeenCalledTimes(2));
  });
});

describe('parseAccountsResult', () => {
  it('rechaza formas inválidas', () => {
    const casos: unknown[] = [
      null, 'x', { accounts: {}, truncated: false }, { accounts: [], truncated: 'no' },
      { accounts: [cuenta({ role: 'root' })], truncated: false },
      { accounts: [cuenta({ providers: ['sms'] })], truncated: false },
      { accounts: [cuenta({ disabled: 'no' })], truncated: false },
      { accounts: [cuenta({ email: 3 })], truncated: false },
      { accounts: [null], truncated: false },
    ];
    for (const c of casos) expect(() => parseAccountsResult(c)).toThrow();
  });
});
