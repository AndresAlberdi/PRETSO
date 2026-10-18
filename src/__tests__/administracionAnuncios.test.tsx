import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import Administracion from '../pages/Administracion';
import { generateDatabaseXml } from '../utils/backup';

vi.mock('../firebase', () => ({ db: {}, auth: {} }));
vi.mock('../utils/backup', () => ({
  generateDatabaseXml: vi.fn(), downloadXml: vi.fn(), generateZipBlob: vi.fn(), uploadToGoogleDrive: vi.fn(),
}));
vi.mock('../utils/xlsxExport', () => ({ generateDatabaseXlsx: vi.fn(), downloadXlsx: vi.fn() }));
vi.mock('react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
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
    fireEvent.click(screen.getByRole('button', { name: /Descargar Base de Datos \(XML\)/ }));
    await waitFor(() => expect(alerta.textContent).toContain('Error al generar XML: boom'));
    expect(screen.getByRole('alert')).toBe(alerta);
  });

  it('un éxito se escribe en la región de estado ya montada', async () => {
    vi.mocked(generateDatabaseXml).mockResolvedValue('<x/>');
    render(<Administracion />);
    const estado = screen.getByRole('status');
    fireEvent.click(screen.getByRole('button', { name: /Descargar Base de Datos \(XML\)/ }));
    await waitFor(() => expect(estado.textContent).toContain('¡Volcado XML descargado exitosamente!'));
    expect(screen.getByRole('status')).toBe(estado);
  });
});
