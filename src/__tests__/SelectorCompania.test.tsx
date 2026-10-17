import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import SelectorCompania from '../components/SelectorCompania';

const companias = [
  { id: 'a', 'Indicador de registro': 7, 'Sigla Compañía': 'GA-JR', Autores: 'Alarcón' },
  { id: 'b', 'Indicador de registro': 0, 'Sigla Compañía': 'CERO', Autores: 'Cero' },
  { id: 'c', 'Sigla Compañía': 'SIN', Autores: 'Sin número' },
  { id: 'd', 'Indicador de registro': '', 'Sigla Compañía': 'VAC', Autores: 'Vacío' },
];

afterEach(cleanup);

function montar(value: unknown, extra: Record<string, unknown> = {}) {
  const onChange = vi.fn();
  render(<SelectorCompania companias={companias} value={value} onChange={onChange} ariaLabel="Compañía" {...extra} />);
  return { onChange, selector: screen.getByLabelText('Compañía') as HTMLSelectElement };
}

describe('SelectorCompania', () => {
  it('excluye las compañías sin número de registro y conserva el 0', () => {
    const { selector } = montar(null);
    const textos = Array.from(selector.options).map(o => o.text);
    expect(textos).toEqual(['Ninguna', 'GA-JR - Alarcón', 'CERO - Cero']);
    expect(Array.from(selector.options).some(o => o.value === '' && o.text !== 'Ninguna')).toBe(false);
  });

  it('al volver a elegir «(sin resolver: X)» devuelve el valor original con su tipo', () => {
    const { onChange, selector } = montar(' ZZ ');
    expect(screen.getByRole('option', { name: '(sin resolver: ZZ)' })).toBeTruthy();
    fireEvent.change(selector, { target: { value: '7' } });
    fireEvent.change(selector, { target: { value: 'ZZ' } });
    expect(onChange).toHaveBeenLastCalledWith(' ZZ ');
  });

  it('un valor sin resolver numérico se devuelve como número, no como texto', () => {
    const { onChange, selector } = montar(99.0);
    fireEvent.change(selector, { target: { value: '7' } });
    fireEvent.change(selector, { target: { value: '99' } });
    expect(onChange).toHaveBeenLastCalledWith(99.0);
    expect(typeof onChange.mock.lastCall![0]).toBe('number');
  });

  it('muestra «Cargando…» y no «sin resolver» mientras las compañías no llegan', () => {
    const { selector } = montar(7, { cargando: true, companias: [] });
    expect(screen.getByRole('option', { name: 'Cargando…' })).toBeTruthy();
    expect(screen.queryByText(/sin resolver/)).toBeNull();
    expect(selector.value).toBe('7');
  });

  it('una sigla en texto que resuelve se muestra «(por sigla: …)» y no marca el número', () => {
    const { onChange, selector } = montar('GA-JR');
    expect(screen.getByRole('option', { name: '(por sigla: GA-JR)' })).toBeTruthy();
    expect(selector.value).toBe('GA-JR');
    expect(selector.value).not.toBe('7');
    // Si el usuario la vuelve a elegir, se conserva tal cual
    fireEvent.change(selector, { target: { value: '0' } });
    fireEvent.change(selector, { target: { value: 'GA-JR' } });
    expect(onChange).toHaveBeenLastCalledWith('GA-JR');
  });

  it('un número guardado se marca como el número (no «por sigla»)', () => {
    const { selector } = montar(7.0);
    expect(selector.value).toBe('7');
    expect(screen.queryByText(/por sigla/)).toBeNull();
  });
});
