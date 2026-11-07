import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const ubicacion = vi.hoisted(() => ({ pathname: '/caja', search: '' }));
const navigate = vi.hoisted(() => vi.fn());
vi.mock('react-router', () => ({
  useNavigate: () => navigate,
  useLocation: () => ({ pathname: ubicacion.pathname, search: ubicacion.search, state: null }),
}));

import { useTerminoBusqueda, useNavegacionGuia, LONGITUD_MAXIMA_TERMINO } from '../../hooks/useTerminoBusqueda';

beforeEach(() => {
  ubicacion.search = '';
  navigate.mockReset();
});

describe('useTerminoBusqueda', () => {
  it('lee q y lo normaliza como término', () => {
    ubicacion.search = '?q=Garc%C3%ADa';
    const { result } = renderHook(() => useTerminoBusqueda());
    expect(result.current.crudo).toBe('García');
    expect(result.current.termino).toBe('garcia');
  });

  it('recorta q a 100 caracteres', () => {
    ubicacion.search = `?q=${'a'.repeat(300)}`;
    const { result } = renderHook(() => useTerminoBusqueda());
    expect(result.current.crudo).toHaveLength(LONGITUD_MAXIMA_TERMINO);
  });

  it('un q inválido da termino null', () => {
    ubicacion.search = '?q=ab';
    const { result } = renderHook(() => useTerminoBusqueda());
    expect(result.current.crudo).toBe('ab');
    expect(result.current.termino).toBeNull();
  });

  it('sin q devuelve vacío', () => {
    const { result } = renderHook(() => useTerminoBusqueda());
    expect(result.current.crudo).toBe('');
    expect(result.current.termino).toBeNull();
  });

  it('fijar borra los parámetros de unidad y conserva los demás', () => {
    ubicacion.search = '?compania=7&ciudad=Lima&anio=1600&categoria=Pan&otro=1';
    const { result } = renderHook(() => useTerminoBusqueda());
    act(() => result.current.fijar('Alberto'));
    expect(navigate).toHaveBeenCalledWith('/caja?otro=1&q=Alberto', { replace: true });
    expect(result.current.crudo).toBe('Alberto');
  });

  it('el término con & y « vuelve intacto', () => {
    const { result, rerender } = renderHook(() => useTerminoBusqueda());
    act(() => result.current.fijar('Pérez & «Hijos»'));
    const destino = navigate.mock.calls[0][0] as string;
    ubicacion.search = destino.slice(destino.indexOf('?'));
    rerender();
    expect(result.current.crudo).toBe('Pérez & «Hijos»');
  });

  it('quitar borra q y conserva compania', () => {
    ubicacion.search = '?q=Alberto&compania=7';
    const { result } = renderHook(() => useTerminoBusqueda());
    act(() => result.current.quitar());
    expect(navigate).toHaveBeenCalledWith('/caja?compania=7', { replace: true });
    expect(result.current.crudo).toBe('');
  });

  it('se resincroniza cuando cambia la URL', () => {
    const { result, rerender } = renderHook(() => useTerminoBusqueda());
    ubicacion.search = '?q=Lima';
    rerender();
    expect(result.current.crudo).toBe('Lima');
  });
});

describe('useNavegacionGuia', () => {
  it('irA hace push por omisión, conserva q y null borra la clave', () => {
    ubicacion.search = '?q=Alberto&compania=7';
    const { result } = renderHook(() => useNavegacionGuia());
    act(() => result.current.irA({ compania: null, ciudad: 'Lima' }));
    expect(navigate).toHaveBeenCalledWith('/caja?q=Alberto&ciudad=Lima', { replace: false });
  });

  it('con reemplazar hace replace', () => {
    const { result } = renderHook(() => useNavegacionGuia());
    act(() => result.current.irA({ categoria: 'Pan' }, { reemplazar: true }));
    expect(navigate).toHaveBeenCalledWith('/caja?categoria=Pan', { replace: true });
  });

  it('sin parámetros resultantes navega a la ruta sola', () => {
    ubicacion.search = '?compania=7';
    const { result } = renderHook(() => useNavegacionGuia());
    act(() => result.current.irA({ compania: null }));
    expect(navigate).toHaveBeenCalledWith('/caja', { replace: false });
  });
});
