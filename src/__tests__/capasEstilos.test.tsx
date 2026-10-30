import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import Bibliografia from '../pages/Bibliografia';
import Administracion from '../pages/Administracion';

vi.mock('../firebase', () => ({ db: {}, auth: {} }));
vi.mock('../utils/audit', () => ({ logAction: vi.fn() }));
vi.mock('../utils/backup', () => ({
  generateDatabaseXml: vi.fn(), downloadXml: vi.fn(), generateZipBlob: vi.fn(), uploadToGoogleDrive: vi.fn(),
}));
vi.mock('../utils/xlsxExport', () => ({ generateDatabaseXlsx: vi.fn(), downloadXlsx: vi.fn() }));
vi.mock('react-router', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
  useNavigate: () => vi.fn(),
}));
vi.mock('../context/AdminContext', () => ({ useAdmin: () => ({ isAdmin: true, isEditMode: true }) }));
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, nombre: string) => nombre,
  query: (c: string) => c,
  doc: vi.fn(), deleteDoc: vi.fn(), updateDoc: vi.fn(), addDoc: vi.fn(),
  getDocs: async () => ({ docs: [{ id: 'b1', data: () => ({ Autores: 'Autor' }) }] }),
}));

afterEach(cleanup);

// Sube desde el texto hasta el fondo (position: fixed) y devuelve el fondo y el panel.
function capas(texto: string) {
  let panel: HTMLElement = screen.getByText(texto);
  while (panel.parentElement && panel.parentElement.style.position !== 'fixed') {
    panel = panel.parentElement;
  }
  const overlay = panel.parentElement as HTMLElement;
  expect(overlay.style.position).toBe('fixed');
  return { overlay: overlay.style.cssText, panel: panel.style.cssText };
}

describe('caracterización de los estilos de las capas de espera y del diálogo del Client ID', () => {
  it('capa de espera (Bibliografía): fondo, panel, título y mensaje', async () => {
    render(<Bibliografia />);
    fireEvent.click(await screen.findByRole('button', { name: 'Borrar' }));
    expect(capas('Por favor espere')).toMatchInlineSnapshot(`
      {
        "overlay": "position: fixed; top: 0px; left: 0px; right: 0px; bottom: 0px; background-color: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center; z-index: 1000;",
        "panel": "background: var(--bg-card); padding: 2rem; border-radius: 8px; max-width: 400px; width: 90%; box-shadow: 0 4px 12px rgba(0,0,0,0.15); text-align: center;",
      }
    `);
    expect(screen.getByText('Por favor espere').style.cssText).toMatchInlineSnapshot(`"margin-top: 0px; color: var(--primary-color);"`);
    expect(screen.getByText('Analizando registros...').style.cssText).toMatchInlineSnapshot(`"margin: 1.5rem 0px; font-weight: bold;"`);
  });

  it('diálogo del Client ID (Administración): fondo, panel, título, texto y campo', () => {
    render(<Administracion />);
    fireEvent.click(screen.getByRole('button', { name: /Configurar Client ID de Google/ }));
    expect(capas('Configurar Google Client ID')).toMatchInlineSnapshot(`
      {
        "overlay": "position: fixed; top: 0px; left: 0px; right: 0px; bottom: 0px; background: rgba(0, 0, 0, 0.8); display: flex; align-items: center; justify-content: center; z-index: 1000;",
        "panel": "background: var(--bg-card); padding: 2rem; border-radius: 8px; max-width: 500px; width: 90%;",
      }
    `);
    expect(screen.getByText('Configurar Google Client ID').style.cssText).toMatchInlineSnapshot(`""`);
    expect(screen.getByRole('textbox').style.cssText).toMatchInlineSnapshot(`"width: 100%; padding: 0.8rem; margin-bottom: 1.5rem; background: var(--bg-body, #222); border: 1px solid var(--input-border); color: var(--text-primary); border-radius: 4px;"`);
  });
});
