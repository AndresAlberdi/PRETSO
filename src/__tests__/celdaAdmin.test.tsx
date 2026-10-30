import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import CeldaAdmin from '../components/CeldaAdmin';

function montar() {
  const onEditar = vi.fn();
  const onBorrar = vi.fn();
  render(
    <table>
      <caption className="visually-hidden">Prueba</caption>
      <tbody>
        <tr><CeldaAdmin onEditar={onEditar} onBorrar={onBorrar} /></tr>
      </tbody>
    </table>,
  );
  return { onEditar, onBorrar };
}

describe('CeldaAdmin', () => {
  afterEach(cleanup);

  it('muestra Editar y Borrar con las clases del diseño', () => {
    montar();
    const editar = screen.getByRole('button', { name: 'Editar' });
    const borrar = screen.getByRole('button', { name: 'Borrar' });
    expect(editar.textContent).toBe('Editar');
    expect(borrar.textContent).toBe('Borrar');
    expect(editar.className).toBe('boton boton-editor boton-fila');
    expect(borrar.className).toBe('boton boton-borrar boton-fila');
    expect(editar.getAttribute('type')).toBe('button');
    expect(borrar.getAttribute('type')).toBe('button');
  });

  it('cada clic llama a su función una sola vez', () => {
    const { onEditar, onBorrar } = montar();
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    expect(onEditar).toHaveBeenCalledTimes(1);
    expect(onBorrar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Borrar' }));
    expect(onBorrar).toHaveBeenCalledTimes(1);
    expect(onEditar).toHaveBeenCalledTimes(1);
  });

  it('la celda no se oculta por sí sola y agrupa las acciones', () => {
    montar();
    const td = screen.getByRole('cell');
    expect((td as HTMLElement).style.display).toBe('');
    expect(td.querySelector('.acciones-celda')).not.toBeNull();
  });
});
