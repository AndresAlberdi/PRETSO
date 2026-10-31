import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';
import GenericCreateModal from '../components/GenericCreateModal';
import { MENSAJE_VERIFICACION_SIGLA } from '../utils/siglas';

const colecciones: Record<string, any[]> = {
  bibliografia: [], documentos: [], transacciones: [], manejo_de_caja: [], salarios: [], indicadores: [], corpus_christi: [],
  companias: [],
};
const base = () => [
  { id: 'c1', 'Indicador de registro': 7, 'Sigla Compañía': 'GA-JR' },
  { id: 'c2', 'Indicador de registro': 8, 'Sigla Compañía': 'GA' },
];

const setDoc = vi.hoisted(() => vi.fn());
const getDocs = vi.hoisted(() => vi.fn());
const logAction = vi.hoisted(() => vi.fn());
vi.mock('../firebase', () => ({ db: {} }));
vi.mock('../utils/audit', () => ({ logAction: (...a: unknown[]) => logAction(...a) }));
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, nombre: string) => nombre,
  query: (c: string) => c,
  doc: (coleccion: string) => ({ id: 'nuevo', coleccion }),
  setDoc: (...a: unknown[]) => setDoc(...a),
  getDocs: (nombre: string) => getDocs(nombre),
}));

const lecturaNormal = async (nombre: string) => ({
  docs: colecciones[nombre].map(d => ({ id: d.id, data: () => d })),
});

beforeEach(() => {
  colecciones.companias = base();
  setDoc.mockReset().mockResolvedValue(undefined);
  getDocs.mockReset().mockImplementation(lecturaNormal);
  logAction.mockReset().mockResolvedValue(undefined);
});
afterEach(cleanup);

async function abrir(onCreated = vi.fn()) {
  render(<GenericCreateModal collectionName="companias" onClose={() => undefined} onCreated={onCreated} />);
  await waitFor(() => expect(screen.queryByText('Cargando opciones...')).toBeNull());
  return { form: document.querySelector('form') as HTMLFormElement, campo: screen.getByPlaceholderText('Ej: GA-JR'), onCreated };
}
const escribir = (campo: HTMLElement, valor: string) => fireEvent.change(campo, { target: { value: valor } });

describe('alta de compañías: sigla', () => {
  it('bloquea una sigla duplicada y marca el campo', async () => {
    const { form, campo } = await abrir();
    escribir(campo, 'ga-jr ');
    fireEvent.submit(form);
    const alerta = await screen.findByRole('alert');
    expect(alerta.textContent).toBe('Ya existe una compañía con la sigla «GA-JR». Use una sigla distinta.');
    expect(campo.getAttribute('aria-invalid')).toBe('true');
    expect(campo.getAttribute('aria-describedby')).toBe(alerta.id);
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('bloquea una sigla de formato inválido', async () => {
    const { form, campo } = await abrir();
    escribir(campo, 'GA--JR');
    fireEvent.submit(form);
    const alerta = await screen.findByRole('alert');
    expect(alerta.textContent).toBe('Una las partes de la sigla con un solo guion, no con varios seguidos.');
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('avisa de una sigla parecida y guarda si se acepta', async () => {
    const { form, campo, onCreated } = await abrir();
    escribir(campo, 'JR-GA');
    fireEvent.submit(form);
    const dialogo = await screen.findByRole('alertdialog', { name: 'Sigla parecida a otra existente' });
    expect(dialogo.textContent).toContain('GA-JR');
    expect(setDoc).not.toHaveBeenCalled();
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Guardar de todos modos' }));
    await waitFor(() => expect(setDoc).toHaveBeenCalledTimes(1));
    expect(setDoc.mock.calls[0][1]['Sigla Compañía']).toBe('JR-GA');
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
  });

  it('al revisar la sigla se cierra el aviso, no guarda y devuelve el foco al botón', async () => {
    const { form, campo } = await abrir();
    escribir(campo, 'JR-GA');
    fireEvent.submit(form);
    const dialogo = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Revisar la sigla' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(setDoc).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Crear Registro' }));
  });

  it('la aceptación queda atada a la sigla aceptada', async () => {
    setDoc.mockRejectedValueOnce(new Error('sin red'));
    const { form, campo } = await abrir();
    escribir(campo, 'JR-GA');
    fireEvent.submit(form);
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Guardar de todos modos' }));
    await screen.findByRole('alert');
    expect(setDoc).toHaveBeenCalledTimes(1);
    escribir(campo, 'MR-GA');
    fireEvent.submit(form);
    expect(await screen.findByRole('alertdialog')).toBeTruthy();
    expect(setDoc).toHaveBeenCalledTimes(1);
  });

  it('si falla la lectura no guarda y no marca campos', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { form, campo } = await abrir();
    getDocs.mockImplementation(() => Promise.reject(new Error('sin red')));
    escribir(campo, 'XY');
    fireEvent.submit(form);
    const alerta = await screen.findByRole('alert');
    expect(alerta.textContent).toBe(MENSAJE_VERIFICACION_SIGLA);
    expect(document.querySelectorAll('[aria-invalid="true"]').length).toBe(0);
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('el reintento tras un fallo de escritura no choca consigo mismo', async () => {
    setDoc.mockRejectedValueOnce(new Error('sin red'));
    const { form, campo } = await abrir();
    escribir(campo, 'XY');
    fireEvent.submit(form);
    await screen.findByRole('alert');
    colecciones.companias = [...base(), { id: 'nuevo', 'Sigla Compañía': 'XY' }];
    fireEvent.submit(form);
    await waitFor(() => expect(setDoc).toHaveBeenCalledTimes(2));
    expect(setDoc.mock.calls[1][0].id).toBe(setDoc.mock.calls[0][0].id);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('un doble envío con la lectura pendiente guarda una sola vez', async () => {
    const { form, campo } = await abrir();
    let liberar: (v: unknown) => void = () => undefined;
    getDocs.mockImplementation(() => new Promise(resolver => { liberar = resolver; }));
    escribir(campo, 'XY');
    fireEvent.submit(form);
    fireEvent.submit(form);
    await waitFor(() => expect(getDocs).toHaveBeenCalled());
    liberar(await lecturaNormal('companias'));
    await waitFor(() => expect(setDoc).toHaveBeenCalledTimes(1));
  });

  it('guarda la sigla sin espacios en los extremos', async () => {
    const { form, campo } = await abrir();
    escribir(campo, 'XY ');
    fireEvent.submit(form);
    await waitFor(() => expect(setDoc).toHaveBeenCalledTimes(1));
    expect(setDoc.mock.calls[0][1]['Sigla Compañía']).toBe('XY');
  });
});
