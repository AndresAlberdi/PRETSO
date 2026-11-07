import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import Administracion from '../pages/Administracion';
import { downloadXlsx } from '../utils/xlsxExport';
import { leerDatosDataset } from '../utils/dataset/leerDatos';
import { generarDatasetZip } from '../utils/dataset/generarDataset';

vi.mock('../firebase', () => ({ db: {}, auth: {} }));
vi.mock('../utils/backup', () => ({
  generateDatabaseXml: vi.fn(), downloadXml: vi.fn(), generateZipBlob: vi.fn(), uploadToGoogleDrive: vi.fn(),
}));
vi.mock('../utils/xlsxExport', () => ({ generateDatabaseXlsx: vi.fn(), downloadXlsx: vi.fn() }));
vi.mock('../utils/dataset/leerDatos', () => ({ leerDatosDataset: vi.fn() }));
vi.mock('../utils/dataset/generarDataset', () => ({ generarDatasetZip: vi.fn() }));
vi.mock('react-router', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
}));

const BOTON = /Descargar dataset \(ZIP\)/;

beforeEach(() => {
  localStorage.clear();
  vi.mocked(downloadXlsx).mockReset();
  vi.mocked(leerDatosDataset).mockReset();
  vi.mocked(generarDatasetZip).mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(cleanup);

describe('descarga del dataset', () => {
  it('descarga el ZIP y anuncia el éxito', async () => {
    vi.mocked(leerDatosDataset).mockResolvedValue({} as never);
    vi.mocked(generarDatasetZip).mockResolvedValue({ nombre: 'PRETSO_dataset_2026-11-06.zip', blob: new Blob(['x'], { type: 'application/zip' }), resumen: {} as never });
    render(<Administracion />);
    fireEvent.click(screen.getByRole('button', { name: BOTON }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('¡Dataset descargado exitosamente!'));
    const [blob, nombre] = vi.mocked(downloadXlsx).mock.calls[0];
    expect((blob as Blob).type).toBe('application/zip');
    expect(nombre).toBe('PRETSO_dataset_2026-11-06.zip');
  });

  it('un fallo muestra un texto genérico sin el detalle técnico', async () => {
    vi.mocked(leerDatosDataset).mockRejectedValue(new Error('boom'));
    render(<Administracion />);
    fireEvent.click(screen.getByRole('button', { name: BOTON }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('No se pudo generar el dataset.'));
    expect(screen.getByRole('alert').textContent).not.toContain('boom');
    expect(downloadXlsx).not.toHaveBeenCalled();
  });

  it('mientras carga, los botones de exportación quedan deshabilitados', async () => {
    vi.mocked(leerDatosDataset).mockReturnValue(new Promise(() => undefined));
    render(<Administracion />);
    fireEvent.click(screen.getByRole('button', { name: BOTON }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Generando el dataset'));
    for (const nombre of [BOTON, /\(XML\)/, /\(XLSX\)/, /Google Drive/]) {
      expect(screen.getByRole('button', { name: nombre }).getAttribute('aria-disabled')).toBe('true');
    }
  });
});

describe('reposo tras un éxito anterior', () => {
  it('iniciar el dataset dentro de los 3 s mantiene los botones deshabilitados', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      vi.mocked(leerDatosDataset).mockResolvedValueOnce({} as never);
      vi.mocked(generarDatasetZip).mockResolvedValueOnce({ nombre: 'a.zip', blob: new Blob(['x']), resumen: {} as never });
      render(<Administracion />);
      fireEvent.click(screen.getByRole('button', { name: BOTON }));
      await waitFor(() => expect(screen.getByRole('status').textContent).toContain('descargado exitosamente'));
      vi.mocked(leerDatosDataset).mockReturnValue(new Promise(() => undefined));
      fireEvent.click(screen.getByRole('button', { name: BOTON }));
      await vi.advanceTimersByTimeAsync(3500);
      expect(screen.getByRole('button', { name: BOTON }).getAttribute('aria-disabled')).toBe('true');
    } finally {
      vi.useRealTimers();
    }
  });
});
