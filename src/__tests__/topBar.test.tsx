import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const signOut = vi.fn();
vi.mock('firebase/auth', () => ({ signOut: (...a: unknown[]) => signOut(...a) }));
vi.mock('../firebase', () => ({ auth: {} }));
let usuario: { email: string } | null = { email: 'lectora@example.com' };
let admin: boolean | undefined = false;
vi.mock('../context/AdminContext', () => ({ useAdmin: () => ({ user: usuario, isAdmin: admin }) }));

import { TopBar } from '../components/TopBar';

beforeEach(() => {
  signOut.mockReset();
  usuario = { email: 'lectora@example.com' };
  admin = false;
});
afterEach(cleanup);

const montar = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('TopBar', () => {
  it('con cuenta muestra el correo y «Salir» cierra la sesión', () => {
    montar(<TopBar conCuenta />);
    expect(screen.getByText('lectora@example.com')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Salir' }));
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('sin cuenta no muestra correo ni «Salir»', () => {
    montar(<TopBar />);
    expect(screen.queryByText('lectora@example.com')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Salir' })).toBeNull();
  });

  it('con volver muestra el enlace con su destino', () => {
    montar(<TopBar volver={{ to: '/administracion', texto: 'Atrás' }} />);
    expect(screen.getByRole('link', { name: 'Atrás' }).getAttribute('href')).toBe('/administracion');
  });
});

describe('TopBar: enlace «Agregar transacción»', () => {
  it('un administrador lo ve con conAgregar, en rojo y antes de «Inicio»', () => {
    admin = true;
    montar(<TopBar conAgregar volver={{ to: '/', texto: 'Inicio' }} />);
    const agregar = screen.getByRole('link', { name: 'Agregar transacción' });
    expect(agregar.getAttribute('href')).toBe('/agregar');
    expect(agregar.classList.contains('boton-editor')).toBe(true);
    const inicio = screen.getByRole('link', { name: 'Inicio' });
    expect(agregar.compareDocumentPosition(inicio) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
  it('un no administrador no lo ve', () => {
    admin = false;
    montar(<TopBar conAgregar />);
    expect(screen.queryByRole('link', { name: 'Agregar transacción' })).toBeNull();
  });
  it('con isAdmin indefinido no lo ve', () => {
    admin = undefined;
    montar(<TopBar conAgregar />);
    expect(screen.queryByRole('link', { name: 'Agregar transacción' })).toBeNull();
  });
  it('un administrador no lo ve sin conAgregar', () => {
    admin = true;
    montar(<TopBar />);
    expect(screen.queryByRole('link', { name: 'Agregar transacción' })).toBeNull();
  });
});

describe('menú superior retirado', () => {
  function listar(dir: string): string[] {
    return readdirSync(dir).flatMap((n) => {
      const r = join(dir, n);
      if (statSync(r).isDirectory()) return n === '__tests__' ? [] : listar(r);
      return /\.tsx?$/.test(n) ? [r] : [];
    });
  }
  it('ningún archivo de src importa MainNav', () => {
    const con = listar(resolve(__dirname, '..')).filter((f) => /MainNav/.test(readFileSync(f, 'utf8')));
    expect(con).toEqual([]);
  });
});
