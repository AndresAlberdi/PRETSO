import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';
import GenericEditModal from '../components/GenericEditModal';
import { MENSAJE_VERIFICACION_SIGLA } from '../utils/siglas';

const companias = [
  { id: 'c1', 'Indicador de registro': 1, 'Sigla Compañía': 'GA-JR', Autores: 'Ana' },
  { id: 'c2', 'Indicador de registro': 2, 'Sigla Compañía': 'GA', Autores: 'Beto' },
  { id: 'c3', 'Indicador de registro': 3, 'Sigla Compañía': 'JG', Autores: 'Carla' },
];

const getDocs = vi.hoisted(() => vi.fn());
vi.mock('../firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, nombre: string) => nombre,
  query: (c: string) => c,
  getDocs: (nombre: string) => getDocs(nombre),
}));

const lecturaNormal = async () => ({ docs: companias.map(d => ({ id: d.id, data: () => d })) });
const lecturasDeCompanias = () => getDocs.mock.calls.filter(c => c[0] === 'companias').length;

beforeEach(() => {
  getDocs.mockReset().mockImplementation(lecturaNormal);
});
afterEach(cleanup);

async function abrir(id: 'c1' | 'c2', onSave = vi.fn().mockResolvedValue(undefined)) {
  const record = companias.find(c => c.id === id)!;
  render(<GenericEditModal collectionName="companias" record={record} onSave={onSave} onClose={vi.fn()} />);
  await screen.findByRole('dialog', { name: /Editar Registro/ });
  return {
    onSave,
    form: document.querySelector('form') as HTMLFormElement,
    sigla: screen.getByLabelText('Compañía') as HTMLInputElement,
  };
}
const escribir = (campo: HTMLElement, valor: string) => fireEvent.change(campo, { target: { value: valor } });

describe('edición de compañías: sigla', () => {
  it('si solo cambia otro campo, no lee las compañías', async () => {
    const { form, onSave } = await abrir('c1');
    escribir(screen.getByLabelText('Autores'), 'Ana María');
    fireEvent.submit(form);
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(lecturasDeCompanias()).toBe(0);
  });

  it('un cambio solo de mayúsculas no lee y guarda tal cual', async () => {
    const { form, sigla, onSave } = await abrir('c1');
    escribir(sigla, 'gA-jR');
    fireEvent.submit(form);
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0]['Sigla Compañía']).toBe('gA-jR');
    expect(lecturasDeCompanias()).toBe(0);
  });

  it('espacios en los extremos se recortan sin leer', async () => {
    const { form, sigla, onSave } = await abrir('c1');
    escribir(sigla, ' GA-JR ');
    fireEvent.submit(form);
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0]['Sigla Compañía']).toBe('GA-JR');
    expect(lecturasDeCompanias()).toBe(0);
  });

  it('bloquea una sigla duplicada y marca el campo', async () => {
    const { form, sigla, onSave } = await abrir('c1');
    escribir(sigla, 'ga');
    fireEvent.submit(form);
    const alerta = await screen.findByRole('alert');
    expect(alerta.textContent).toBe('Ya existe una compañía con la sigla «GA». Use una sigla distinta.');
    expect(sigla.getAttribute('aria-invalid')).toBe('true');
    expect(sigla.getAttribute('aria-describedby')).toBe(alerta.id);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('bloquea una sigla de formato inválido', async () => {
    const { form, sigla, onSave } = await abrir('c1');
    escribir(sigla, 'GA JR');
    fireEvent.submit(form);
    const alerta = await screen.findByRole('alert');
    expect(alerta.textContent).toContain('no puede contener espacios');
    expect(onSave).not.toHaveBeenCalled();
  });

  it('avisa de una sigla parecida y guarda si se acepta', async () => {
    const { form, sigla, onSave } = await abrir('c2');
    escribir(sigla, 'JR-GA');
    fireEvent.submit(form);
    const dialogo = await screen.findByRole('alertdialog', { name: 'Sigla parecida a otra existente' });
    expect(dialogo.textContent).toContain('GA-JR');
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Guardar de todos modos' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0]['Sigla Compañía']).toBe('JR-GA');
  });

  it('al revisar la sigla no guarda y el foco queda en «Guardar Cambios»', async () => {
    const { form, sigla, onSave } = await abrir('c2');
    escribir(sigla, 'JR-GA');
    fireEvent.submit(form);
    const dialogo = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Revisar la sigla' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(onSave).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Guardar Cambios' }));
  });

  it('si falla la lectura no guarda y avisa sin marcar el campo', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { form, sigla, onSave } = await abrir('c1');
    getDocs.mockImplementation(() => Promise.reject(new Error('sin red')));
    escribir(sigla, 'XY');
    fireEvent.submit(form);
    const alerta = await screen.findByRole('alert');
    expect(alerta.textContent).toBe(MENSAJE_VERIFICACION_SIGLA);
    expect(document.querySelectorAll('[aria-invalid="true"]').length).toBe(0);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('un doble envío con la lectura pendiente guarda una sola vez', async () => {
    const { form, sigla, onSave } = await abrir('c1');
    const pendientes: Array<(v: unknown) => void> = [];
    getDocs.mockImplementation(() => new Promise(resolver => { pendientes.push(resolver); }));
    escribir(sigla, 'XY');
    fireEvent.submit(form);
    fireEvent.submit(form);
    await waitFor(() => expect(pendientes.length).toBeGreaterThan(0));
    const lectura = await lecturaNormal();
    pendientes.forEach(liberar => liberar(lectura));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    // Sin la protección habría dos lecturas de 'companias' y dos guardados.
    expect(lecturasDeCompanias()).toBe(1);
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('la aceptación del aviso queda atada a la sigla aceptada', async () => {
    const { form, sigla, onSave } = await abrir('c2');
    escribir(sigla, 'JR-GA');
    fireEvent.submit(form);
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Guardar de todos modos' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    // Mismo valor: no vuelve a preguntar.
    fireEvent.submit(form);
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    // Otra sigla parecida: vuelve a avisar.
    escribir(sigla, 'JR-GA-X');
    fireEvent.submit(form);
    expect(await screen.findByRole('alertdialog')).toBeTruthy();
    expect(onSave).toHaveBeenCalledTimes(2);
  });

  it('un registro con sigla antigua mal formada se guarda al cambiar otro campo', async () => {
    const antiguo = { id: 'c9', 'Indicador de registro': 9, 'Sigla Compañía': 'GA - JR', Autores: 'Dora' };
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<GenericEditModal collectionName="companias" record={antiguo} onSave={onSave} onClose={vi.fn()} />);
    await screen.findByRole('dialog', { name: /Editar Registro/ });
    escribir(screen.getByLabelText('Autores'), 'Dora Ruiz');
    fireEvent.submit(document.querySelector('form') as HTMLFormElement);
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0]['Sigla Compañía']).toBe('GA - JR');
    expect(lecturasDeCompanias()).toBe(0);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
