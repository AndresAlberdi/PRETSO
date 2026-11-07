import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import Administracion from '../pages/Administracion';
import { generateDatabaseXml } from '../utils/backup';

vi.mock('../firebase', () => ({ db: {}, auth: {} }));
vi.mock('../utils/backup', () => ({
  generateDatabaseXml: vi.fn(), downloadXml: vi.fn(), generateZipBlob: vi.fn(), uploadToGoogleDrive: vi.fn(),
}));
vi.mock('../utils/xlsxExport', () => ({ generateDatabaseXlsx: vi.fn(), downloadXlsx: vi.fn() }));
vi.mock('react-router', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
}));

beforeEach(() => {
  localStorage.clear();
  vi.mocked(generateDatabaseXml).mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(cleanup);

describe('anuncios del estado del respaldo', () => {
  it('en reposo existen las regiones de estado y de alerta, vacías', () => {
    render(<Administracion />);
    expect(screen.getByRole('status').textContent).toBe('');
    expect(screen.getByRole('alert').textContent).toBe('');
  });

  it('un fallo se escribe en la región de alerta ya montada', async () => {
    vi.mocked(generateDatabaseXml).mockRejectedValue(new Error('boom'));
    render(<Administracion />);
    const alerta = screen.getByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: /Descargar base de datos \(XML\)/ }));
    await waitFor(() => expect(alerta.textContent).toContain('No se pudo generar el volcado XML.'));
    // Texto fijo: el mensaje técnico de la excepción no llega a la pantalla.
    expect(alerta.textContent).not.toContain('boom');
    expect(screen.getByRole('alert')).toBe(alerta);
  });

  it('un éxito se escribe en la región de estado ya montada', async () => {
    vi.mocked(generateDatabaseXml).mockResolvedValue('<x/>');
    render(<Administracion />);
    const estado = screen.getByRole('status');
    fireEvent.click(screen.getByRole('button', { name: /Descargar base de datos \(XML\)/ }));
    await waitFor(() => expect(estado.textContent).toContain('¡Volcado XML descargado exitosamente!'));
    expect(screen.getByRole('status')).toBe(estado);
  });

  describe('autorización de Google Drive', () => {
    type Config = { callback: (r: unknown) => void; error_callback: (e: unknown) => void };
    let config: Config;
    beforeEach(() => {
      localStorage.setItem('google_client_id', 'cliente-de-prueba');
      (window as unknown as { google: unknown }).google = {
        accounts: { oauth2: { initTokenClient: (c: Config) => { config = c; return { requestAccessToken: vi.fn() }; } } },
      };
    });
    afterEach(() => { delete (window as unknown as { google?: unknown }).google; });

    it('un rechazo muestra texto fijo, sin el detalle de Google', async () => {
      render(<Administracion />);
      fireEvent.click(screen.getByRole('button', { name: /Copia a Google Drive/ }));
      await act(async () => { await config.callback({ error: 'access_denied', error_description: 'x-detalle' }); });
      const alerta = screen.getByRole('alert');
      expect(alerta.textContent).toContain('No se autorizó el acceso a Google Drive.');
      expect(document.body.textContent).not.toContain('x-detalle');
    });

    it('cerrar la ventana de Google no deja los botones bloqueados', () => {
      render(<Administracion />);
      const boton = screen.getByRole('button', { name: /Copia a Google Drive/ });
      fireEvent.click(boton);
      expect(boton.getAttribute('aria-disabled')).toBe('true');
      act(() => config.error_callback({ type: 'popup_closed' }));
      expect(boton.getAttribute('aria-disabled')).toBeNull();
      expect(screen.getByRole('alert').textContent).toContain('No se completó la autorización');
    });
  });
});
