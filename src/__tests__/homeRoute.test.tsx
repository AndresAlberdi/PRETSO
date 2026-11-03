import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

let estado: { user: unknown; adminLoading: boolean; authNotice?: string | null } = { user: null, adminLoading: false };
vi.mock('../context/AdminContext', () => ({ useAdmin: () => estado }));

import HomeRoute from '../components/HomeRoute';

const salida = <main id="contenido" tabIndex={-1}>acceso</main>;
const entrada = <main id="contenido" tabIndex={-1}>portada</main>;

afterEach(() => {
  cleanup();
  estado = { user: null, adminLoading: false };
});

describe('HomeRoute', () => {
  it('mientras carga no monta ninguna vista', () => {
    estado = { user: null, adminLoading: true };
    render(<HomeRoute signedOut={salida} signedIn={entrada} />);
    expect(screen.getByText('Cargando...')).toBeTruthy();
    expect(screen.queryByText('acceso')).toBeNull();
    expect(screen.queryByText('portada')).toBeNull();
  });

  it('sin usuario muestra el acceso; con usuario, la portada', () => {
    const { rerender } = render(<HomeRoute signedOut={salida} signedIn={entrada} />);
    expect(screen.getByText('acceso')).toBeTruthy();
    estado = { user: { uid: 'a' }, adminLoading: false };
    rerender(<HomeRoute signedOut={salida} signedIn={entrada} />);
    expect(screen.getByText('portada')).toBeTruthy();
    expect(screen.queryByText('acceso')).toBeNull();
  });

  it('al cambiar de vista lleva el foco al contenido; en la primera carga no', () => {
    const { rerender } = render(<HomeRoute signedOut={salida} signedIn={entrada} />);
    expect(document.activeElement).toBe(document.body);
    estado = { user: { uid: 'a' }, adminLoading: false };
    rerender(<HomeRoute signedOut={salida} signedIn={entrada} />);
    expect(document.activeElement?.id).toBe('contenido');
  });

  it('con un aviso pendiente no le quita el foco al aviso', () => {
    const { rerender } = render(<HomeRoute signedOut={salida} signedIn={entrada} />);
    estado = { user: { uid: 'a' }, adminLoading: false };
    rerender(<HomeRoute signedOut={salida} signedIn={entrada} />);
    (document.activeElement as HTMLElement | null)?.blur();
    estado = { user: null, adminLoading: false, authNotice: 'aviso' };
    rerender(<HomeRoute signedOut={salida} signedIn={entrada} />);
    expect(document.activeElement?.id).not.toBe('contenido');
  });
});
