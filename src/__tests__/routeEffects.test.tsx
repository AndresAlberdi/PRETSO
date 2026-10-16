import { describe, it, expect, vi, afterEach } from 'vitest';
import { useEffect } from 'react';
import { render, screen, act, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Navigate, useNavigate } from 'react-router';
import type { NavigateFunction } from 'react-router';

vi.mock('firebase/auth', () => ({ signOut: vi.fn() }));
vi.mock('../firebase', () => ({ auth: {} }));
vi.mock('../context/AdminContext', () => ({
  useAdmin: () => ({ isAdmin: false, isEditMode: false, setIsEditMode: vi.fn(), user: null }),
}));

import RouteEffects from '../components/RouteEffects';
import { MainNav, SkipLink } from '../components/MainNav';

let navegar: NavigateFunction;
function Capturador() {
  const navigate = useNavigate();
  useEffect(() => {
    navegar = navigate;
  }, [navigate]);
  return null;
}

function Shell({ conMain = true }: { conMain?: boolean }) {
  return (
    <>
      <SkipLink />
      <MainNav />
      {conMain && <main id="contenido" tabIndex={-1}>contenido</main>}
      <Capturador />
      <RouteEffects />
    </>
  );
}

afterEach(() => {
  cleanup();
  document.title = '';
});

describe('RouteEffects', () => {
  it('en la primera carga no mueve el foco al contenido', () => {
    render(<MemoryRouter initialEntries={['/caja']}><Shell /></MemoryRouter>);
    expect(document.activeElement).not.toBe(document.getElementById('contenido'));
  });

  it('al navegar a otra ruta lleva el foco a main#contenido', () => {
    render(<MemoryRouter initialEntries={['/']}><Shell /></MemoryRouter>);
    act(() => { navegar('/caja'); });
    expect(document.activeElement).toBe(document.getElementById('contenido'));
  });

  it('el título del documento cambia según la ruta', () => {
    render(<MemoryRouter initialEntries={['/']}><Shell /></MemoryRouter>);
    expect(document.title).toBe('Inicio — PRETSO');
    act(() => { navegar('/caja'); });
    expect(document.title).toBe('Manejo de Caja — PRETSO');
  });

  it('un cambio de ruta con REPLACE no mueve el foco', () => {
    render(<MemoryRouter initialEntries={['/']}><Shell /></MemoryRouter>);
    act(() => { navegar('/caja', { replace: true }); });
    expect(document.title).toBe('Manejo de Caja — PRETSO');
    expect(document.activeElement).not.toBe(document.getElementById('contenido'));
  });

  it('una redirección con <Navigate replace> en la primera carga no roba el foco', () => {
    render(
      <MemoryRouter initialEntries={['/desconocida']}>
        <Routes>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Shell />
      </MemoryRouter>,
    );
    expect(document.activeElement).not.toBe(document.getElementById('contenido'));
  });

  it('no lanza si no existe #contenido', () => {
    render(<MemoryRouter initialEntries={['/']}><Shell conMain={false} /></MemoryRouter>);
    expect(() => act(() => { navegar('/caja'); })).not.toThrow();
  });
});

describe('MainNav y SkipLink', () => {
  it('marca solo la sección actual con aria-current', () => {
    render(<MemoryRouter initialEntries={['/caja']}><Shell /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Inicio' }).getAttribute('aria-current')).toBeNull();
    expect(screen.getByRole('link', { name: 'Manejo de Caja' }).getAttribute('aria-current')).toBe('page');
  });

  it('incluye el enlace para saltar al contenido', () => {
    const { container } = render(<MemoryRouter initialEntries={['/']}><Shell /></MemoryRouter>);
    const enlace = container.querySelector('a.skip-link');
    expect(enlace?.getAttribute('href')).toBe('#contenido');
  });
});
