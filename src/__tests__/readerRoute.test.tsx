import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';

const signOut = vi.fn();
vi.mock('firebase/auth', () => ({ signOut: (...a: unknown[]) => signOut(...a) }));
vi.mock('../firebase', () => ({ auth: { id: 'auth-simulada' } }));

let estado = { isAdmin: false, isReader: false, adminLoading: false };
vi.mock('../context/AdminContext', () => ({ useAdmin: () => estado }));

import ReaderRoute from '../components/ReaderRoute';
import RouteEffects from '../components/RouteEffects';

beforeEach(() => {
  signOut.mockReset();
});
afterEach(cleanup);

function montar() {
  render(<ReaderRoute><p>contenido protegido</p></ReaderRoute>);
}

describe('ReaderRoute', () => {
  it('muestra «Cargando...» mientras se resuelve el claim', () => {
    estado = { isAdmin: false, isReader: false, adminLoading: true };
    montar();
    expect(screen.getByText('Cargando...')).toBeTruthy();
    expect(screen.queryByText('contenido protegido')).toBeNull();
  });

  it('sin claims muestra «Acceso pendiente» y «Salir» cierra la sesión', () => {
    estado = { isAdmin: false, isReader: false, adminLoading: false };
    montar();
    expect(screen.getByRole('heading', { level: 1, name: 'Acceso pendiente' })).toBeTruthy();
    expect(screen.queryByText('contenido protegido')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Salir' }));
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('el lector ve los hijos', () => {
    estado = { isAdmin: false, isReader: true, adminLoading: false };
    montar();
    expect(screen.getByText('contenido protegido')).toBeTruthy();
  });

  it('el administrador ve los hijos', () => {
    estado = { isAdmin: true, isReader: false, adminLoading: false };
    montar();
    expect(screen.getByText('contenido protegido')).toBeTruthy();
  });

  it('sin claims el título del documento es «Acceso pendiente — PRETSO», aun con RouteEffects antes de las rutas', () => {
    estado = { isAdmin: false, isReader: false, adminLoading: false };
    render(
      <MemoryRouter initialEntries={['/caja']}>
        <RouteEffects />
        <Routes>
          <Route path="/caja" element={<ReaderRoute><p>contenido protegido</p></ReaderRoute>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(document.title).toBe('Acceso pendiente — PRETSO');
  });
});
