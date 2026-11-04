import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import CampoBusqueda from '../components/CampoBusqueda';
import { textoAviso } from '../utils/busquedaGuia/avisoTermino';
import { TEXTO_LIBRE } from '../utils/correctorOrtografico';

afterEach(cleanup);

function montar(valorInicial = '') {
  const onBuscar = vi.fn();
  const onLimpiar = vi.fn();
  render(<CampoBusqueda valorInicial={valorInicial} onBuscar={onBuscar} onLimpiar={onLimpiar} />);
  const campo = screen.getByRole('searchbox', { name: 'Buscar en la base de datos' }) as HTMLInputElement;
  return { campo, onBuscar, onLimpiar };
}
const escribir = (campo: HTMLElement, texto: string) => fireEvent.change(campo, { target: { value: texto } });
const enviar = () => fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));

describe('CampoBusqueda', () => {
  it('«ab» muestra el aviso de término corto y no busca', () => {
    const { campo, onBuscar } = montar();
    escribir(campo, 'ab');
    enviar();
    expect(screen.getByRole('alert').textContent).toBe('Escriba al menos 3 letras, o un año de cuatro cifras.');
    expect(onBuscar).not.toHaveBeenCalled();
  });

  it('un envío inválido deja el foco en el campo', () => {
    const { campo } = montar();
    escribir(campo, 'ab');
    enviar();
    expect(document.activeElement).toBe(campo);
  });

  it('«de la» muestra el aviso de conector con la palabra', () => {
    const { campo, onBuscar } = montar();
    escribir(campo, 'de la');
    enviar();
    expect(screen.getByRole('alert').textContent).toBe(textoAviso('conector', 'de la'));
    expect(screen.getByRole('alert').textContent).toContain('«de la»');
    expect(onBuscar).not.toHaveBeenCalled();
  });

  it('«1581» pasa y se envía recortado', () => {
    const { campo, onBuscar } = montar();
    escribir(campo, ' 1581 ');
    enviar();
    expect(onBuscar).toHaveBeenCalledWith('1581');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('un envío vacío equivale a Limpiar', () => {
    const { onBuscar, onLimpiar } = montar();
    enviar();
    expect(onLimpiar).toHaveBeenCalledTimes(1);
    expect(onBuscar).not.toHaveBeenCalled();
  });

  it('el campo tiene etiqueta visible, aria-invalid y aria-describedby hacia el aviso', () => {
    const { campo } = montar();
    expect(campo.getAttribute('aria-invalid')).toBeNull();
    escribir(campo, 'ab');
    enviar();
    expect(campo.getAttribute('aria-invalid')).toBe('true');
    expect(campo.getAttribute('aria-describedby')).toBe(screen.getByRole('alert').id);
    expect(campo.maxLength).toBe(100);
    expect(campo.type).toBe('search');
  });

  it('usa el corrector de TEXTO_LIBRE', () => {
    const { campo } = montar();
    expect(campo.getAttribute('spellcheck')).toBe(String(TEXTO_LIBRE.spellCheck));
    expect(campo.getAttribute('lang')).toBe(TEXTO_LIBRE.lang);
  });

  it('Limpiar vacía el campo, avisa y devuelve el foco', () => {
    const { campo, onLimpiar } = montar('Alberto');
    expect(campo.value).toBe('Alberto');
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar' }));
    expect(onLimpiar).toHaveBeenCalledTimes(1);
    expect(campo.value).toBe('');
    expect(document.activeElement).toBe(campo);
  });

  it('sin texto no ofrece Limpiar', () => {
    montar();
    expect(screen.queryByRole('button', { name: 'Limpiar' })).toBeNull();
  });

  it('un valorInicial inválido muestra el aviso al montar', () => {
    montar('ab');
    expect(screen.getByRole('alert').textContent).toBe('Escriba al menos 3 letras, o un año de cuatro cifras.');
  });

  it('se resincroniza cuando cambia valorInicial', () => {
    const { rerender } = render(<CampoBusqueda valorInicial="" onBuscar={vi.fn()} onLimpiar={vi.fn()} />);
    rerender(<CampoBusqueda valorInicial="Lima" onBuscar={vi.fn()} onLimpiar={vi.fn()} />);
    expect((screen.getByRole('searchbox') as HTMLInputElement).value).toBe('Lima');
  });

  it('acepta una etiqueta propia', () => {
    render(<CampoBusqueda etiqueta="Buscar en esta sección" valorInicial="" onBuscar={vi.fn()} onLimpiar={vi.fn()} />);
    expect(screen.getByRole('searchbox', { name: 'Buscar en esta sección' })).toBeTruthy();
  });
});
