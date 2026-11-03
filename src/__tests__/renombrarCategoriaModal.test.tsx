import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

const renombrar = vi.fn();
vi.mock('../utils/renombrarCategoria', async (orig) => ({
  ...(await orig<typeof import('../utils/renombrarCategoria')>()),
  renombrarCategoria: (...a: unknown[]) => renombrar(...a),
}));
vi.mock('../firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({}));
vi.mock('../utils/audit', () => ({ logAction: vi.fn() }));

import RenombrarCategoriaModal from '../components/RenombrarCategoriaModal';
import { RenombreParcialError } from '../utils/renombrarCategoria';

const onClose = vi.fn();
const onRenombrada = vi.fn();
const onParcial = vi.fn();
const montar = () => render(
  <RenombrarCategoriaModal categoria="Pan" existentes={['Pan', 'Vino']} cantidad={3} onClose={onClose} onRenombrada={onRenombrada} onParcial={onParcial} />,
);

beforeEach(() => { renombrar.mockReset(); onClose.mockReset(); onRenombrada.mockReset(); onParcial.mockReset(); });
afterEach(cleanup);

describe('RenombrarCategoriaModal', () => {
  it('enfoca el campo, tiene etiqueta y muestra la cantidad', () => {
    montar();
    const campo = screen.getByLabelText('Nombre nuevo');
    expect(document.activeElement).toBe(campo);
    expect(screen.getByText('Se cambiará la categoría en 3 registros.')).toBeTruthy();
  });
  it('Escape cierra', () => {
    montar();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
  it('bloquea un nombre duplicado con mensaje y sin escribir', async () => {
    montar();
    fireEvent.change(screen.getByLabelText('Nombre nuevo'), { target: { value: 'vino' } });
    fireEvent.click(screen.getByRole('button', { name: 'Renombrar' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Ya existe');
    expect(renombrar).not.toHaveBeenCalled();
  });
  it('renombra, avisa y cierra', async () => {
    renombrar.mockResolvedValue(3);
    montar();
    fireEvent.change(screen.getByLabelText('Nombre nuevo'), { target: { value: 'Panes' } });
    fireEvent.click(screen.getByRole('button', { name: 'Renombrar' }));
    await waitFor(() => expect(onRenombrada).toHaveBeenCalledWith('Pan', 'Panes'));
    expect(onClose).toHaveBeenCalled();
  });
  it('ignora el doble envío', async () => {
    let fin: (n: number) => void = () => {};
    renombrar.mockReturnValue(new Promise<number>(r => { fin = r; }));
    montar();
    fireEvent.change(screen.getByLabelText('Nombre nuevo'), { target: { value: 'Panes' } });
    const boton = screen.getByRole('button', { name: 'Renombrar' });
    fireEvent.click(boton);
    fireEvent.click(boton);
    expect(renombrar).toHaveBeenCalledTimes(1);
    fin(3);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
  it('muestra el error parcial y el genérico', async () => {
    renombrar.mockRejectedValueOnce(new RenombreParcialError(['a', 'b'], new Error('x')));
    montar();
    fireEvent.change(screen.getByLabelText('Nombre nuevo'), { target: { value: 'Panes' } });
    fireEvent.click(screen.getByRole('button', { name: 'Renombrar' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Se renombraron 2 de 3 registros. Vuelva a intentarlo ahora, sin cerrar esta ventana');
    expect(onParcial).toHaveBeenCalledWith(['a', 'b'], 'Panes');
    renombrar.mockRejectedValueOnce(new Error('x'));
    fireEvent.click(await screen.findByRole('button', { name: 'Renombrar' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('No se pudo renombrar'));
    expect(onClose).not.toHaveBeenCalled();
  });
  it('Escape no cierra mientras está ocupado', async () => {
    let fin: (n: number) => void = () => {};
    renombrar.mockReturnValue(new Promise<number>(r => { fin = r; }));
    montar();
    fireEvent.change(screen.getByLabelText('Nombre nuevo'), { target: { value: 'Panes' } });
    fireEvent.click(screen.getByRole('button', { name: 'Renombrar' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
    fin(3);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
  it('tras un fallo parcial permite reintentar con el mismo nombre aunque ya exista', async () => {
    renombrar.mockRejectedValueOnce(new RenombreParcialError(['a'], new Error('x')));
    const { rerender } = montar();
    fireEvent.change(screen.getByLabelText('Nombre nuevo'), { target: { value: 'Panes' } });
    fireEvent.click(screen.getByRole('button', { name: 'Renombrar' }));
    await screen.findByRole('alert');
    rerender(<RenombrarCategoriaModal categoria="Pan" existentes={['Pan', 'Panes', 'Vino']} cantidad={2} onClose={onClose} onRenombrada={onRenombrada} onParcial={onParcial} />);
    renombrar.mockResolvedValueOnce(2);
    fireEvent.click(screen.getByRole('button', { name: 'Renombrar' }));
    await waitFor(() => expect(onRenombrada).toHaveBeenCalledWith('Pan', 'Panes'));
  });
});
