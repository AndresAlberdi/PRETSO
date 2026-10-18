import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { StrictMode } from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import Administracion from '../pages/Administracion';
import { GOOGLE_CLIENT_ID_STORAGE_KEY } from '../utils/googleClientId';

vi.mock('../firebase', () => ({ db: {}, auth: {} }));
vi.mock('../utils/backup', () => ({
  generateDatabaseXml: vi.fn(), downloadXml: vi.fn(), generateZipBlob: vi.fn(), uploadToGoogleDrive: vi.fn(),
}));
vi.mock('../utils/xlsxExport', () => ({ generateDatabaseXlsx: vi.fn(), downloadXlsx: vi.fn() }));
vi.mock('react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('diálogo del Client ID de Google', () => {
  function abrir() {
    render(<StrictMode><Administracion /></StrictMode>);
    const abrirBtn = screen.getByRole('button', { name: /Configurar Client ID de Google/ });
    abrirBtn.focus();
    fireEvent.click(abrirBtn);
    return { abrirBtn, campo: screen.getByRole('textbox') as HTMLInputElement };
  }

  it('es un diálogo con nombre y descripción, y el foco inicial va al campo', () => {
    const { campo } = abrir();
    const d = screen.getByRole('dialog', { name: 'Configurar Google Client ID' });
    expect(d.getAttribute('aria-describedby')).toBeTruthy();
    expect(document.activeElement).toBe(campo);
  });

  it('el campo tiene etiqueta visible y recibe el foco al abrir', () => {
    abrir();
    expect(document.activeElement).toBe(screen.getByLabelText('Client ID de Google'));
  });

  it('«Guardar» usa el valor del campo y cierra', () => {
    const { campo } = abrir();
    fireEvent.change(campo, { target: { value: '  mi-id.apps.googleusercontent.com ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(localStorage.getItem(GOOGLE_CLIENT_ID_STORAGE_KEY)).toBe('mi-id.apps.googleusercontent.com');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Enter en el campo guarda y cierra, y el evento queda prevenido para no reactivar el botón de origen', () => {
    const { campo } = abrir();
    fireEvent.change(campo, { target: { value: 'otro-id' } });
    // fireEvent devuelve false si el evento fue cancelado con preventDefault. Sin esa cancelación, el foco que
    // vuelve al botón de origen durante este keydown haría que el navegador lo activara y reabriera el diálogo.
    const noCancelado = fireEvent.keyDown(campo, { key: 'Enter' });
    expect(noCancelado).toBe(false);
    expect(localStorage.getItem(GOOGLE_CLIENT_ID_STORAGE_KEY)).toBe('otro-id');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('el botón de origen solo abre: pulsarlo otra vez no alterna el diálogo', () => {
    const { abrirBtn } = abrir();
    // El diálogo está abierto y el botón de origen queda inerte; si se activara de nuevo no debe cerrarlo.
    fireEvent.click(abrirBtn);
    expect(screen.getByRole('dialog', { name: 'Configurar Google Client ID' })).toBeTruthy();
  });

  it('«Guardar» con el campo vacío o solo con espacios borra el Client ID guardado', () => {
    localStorage.setItem(GOOGLE_CLIENT_ID_STORAGE_KEY, 'viejo-id');
    const { campo } = abrir();
    fireEvent.change(campo, { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(localStorage.getItem(GOOGLE_CLIENT_ID_STORAGE_KEY)).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('«Cancelar» cierra sin guardar y devuelve el foco al botón de origen', () => {
    const { abrirBtn, campo } = abrir();
    fireEvent.change(campo, { target: { value: 'no-guardar' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(localStorage.getItem(GOOGLE_CLIENT_ID_STORAGE_KEY)).toBeNull();
    expect(document.activeElement).toBe(abrirBtn);
  });

  it('Escape cierra sin guardar y devuelve el foco al botón de origen', () => {
    const { abrirBtn, campo } = abrir();
    fireEvent.change(campo, { target: { value: 'no-guardar' } });
    fireEvent.keyDown(campo, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(localStorage.getItem(GOOGLE_CLIENT_ID_STORAGE_KEY)).toBeNull();
    expect(document.activeElement).toBe(abrirBtn);
  });
});
