import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, cleanup, act } from '@testing-library/react';

let colecciones: Record<string, Array<Record<string, unknown> & { id: string }>> = {};
const getDocs = vi.hoisted(() => vi.fn());
vi.mock('../../firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, nombre: string) => nombre,
  query: (nombre: string) => nombre,
  getDocs: (n: string) => getDocs(n),
}));

import { useIndiceBusqueda, useCoincidenciasSeccion } from '../../hooks/useIndiceBusqueda';
import { invalidarIndice } from '../../utils/busquedaGuia/cargaIndice';

afterEach(cleanup);

beforeEach(() => {
  invalidarIndice();
  colecciones = {
    companias: [{ id: 'c7', 'Indicador de registro': 7, 'Sigla Compañía': 'GA-JR', 'Nombre Compañía': 'Compañía de Alarcón' }],
    manejo_de_caja: [
      { id: 'm1', 'Sigla Compañía': 7, Ciudad: 'Potosí', 'Año': 1600, Transacción: 5, Ingresos: 100 },
      { id: 'm2', 'Sigla Compañía': 7, Ciudad: 'Lima', 'Año': 1601, Ingresos: 50 },
    ],
    transacciones: [{ id: 't5', Num: 5, Noticia: 'Pago a Alberto', Doc1: 5 }],
    documentos: [{ id: 'd5', Doc: 5, Documento: 'Carta de Alberto' }],
  };
  getDocs.mockReset();
  getDocs.mockImplementation(async (n: string) => ({ docs: (colecciones[n] ?? []).map(d => ({ id: d.id, data: () => d })) }));
});

describe('useIndiceBusqueda', () => {
  it('inactivo no llama a getDocs', () => {
    const { result } = renderHook(() => useIndiceBusqueda(false));
    expect(result.current).toMatchObject({ estado: 'inactivo', indice: null });
    expect(getDocs).not.toHaveBeenCalled();
  });

  it('activo pasa de cargando a listo', async () => {
    const { result } = renderHook(() => useIndiceBusqueda(true));
    expect(result.current.estado).toBe('cargando');
    await waitFor(() => expect(result.current.estado).toBe('listo'));
    expect(result.current.indice).not.toBeNull();
  });

  it('desmontar antes de resolver no actualiza el estado', async () => {
    const errores = vi.spyOn(console, 'error').mockImplementation(() => {});
    let liberar: () => void = () => {};
    const pausa = new Promise<void>(r => { liberar = r; });
    getDocs.mockImplementation(async () => { await pausa; return { docs: [] }; });
    const { unmount } = renderHook(() => useIndiceBusqueda(true));
    unmount();
    liberar();
    await new Promise(r => setTimeout(r, 0));
    expect(errores).not.toHaveBeenCalled();
    errores.mockRestore();
  });

  it('montado, recarga tras invalidarIndice y conserva el último índice mientras tanto', async () => {
    const { result } = renderHook(() => useIndiceBusqueda(true));
    await waitFor(() => expect(result.current.estado).toBe('listo'));
    const primero = result.current.indice;
    const llamadas = getDocs.mock.calls.length;
    act(() => invalidarIndice());
    expect(result.current.estado).toBe('cargando');
    expect(result.current.indice).toBe(primero);
    await waitFor(() => expect(result.current.estado).toBe('listo'));
    expect(getDocs.mock.calls.length).toBeGreaterThan(llamadas);
    expect(result.current.indice).not.toBe(primero);
  });

  it('tras un error permite reintentar', async () => {
    getDocs.mockRejectedValue(new Error('sin red'));
    const { result } = renderHook(() => useIndiceBusqueda(true));
    await waitFor(() => expect(result.current.estado).toBe('error'));
    getDocs.mockImplementation(async () => ({ docs: [] }));
    act(() => result.current.reintentar());
    expect(result.current.estado).toBe('cargando');
    await waitFor(() => expect(result.current.estado).toBe('listo'));
  });

  it('desactivar y reactivar tras un error vuelve a cargar', async () => {
    getDocs.mockRejectedValue(new Error('sin red'));
    const { result, rerender } = renderHook(({ a }) => useIndiceBusqueda(a), { initialProps: { a: true } });
    await waitFor(() => expect(result.current.estado).toBe('error'));
    rerender({ a: false });
    getDocs.mockImplementation(async () => ({ docs: [] }));
    rerender({ a: true });
    await waitFor(() => expect(result.current.estado).toBe('listo'));
  });

  it('un error de carga da el estado error', async () => {
    getDocs.mockRejectedValue(new Error('sin red'));
    const { result } = renderHook(() => useIndiceBusqueda(true));
    await waitFor(() => expect(result.current.estado).toBe('error'));
  });
});

describe('useCoincidenciasSeccion', () => {
  it('correlaciona por id y expone la coincidencia anidada', async () => {
    const { result } = renderHook(() => useCoincidenciasSeccion('manejo_de_caja', 'alberto'));
    await waitFor(() => expect(result.current.estado).toBe('listo'));
    expect([...result.current.porId.keys()]).toEqual(['m1']);
    const r = result.current.porId.get('m1');
    expect(r?.transaccion).toBe(true);
    expect(r?.documentos).toEqual([5]);
    expect(result.current.unidades).toHaveLength(1);
  });

  it('sin término no lee nada', () => {
    const { result } = renderHook(() => useCoincidenciasSeccion('manejo_de_caja', null));
    expect(result.current.estado).toBe('inactivo');
    expect(result.current.porId.size).toBe(0);
    expect(getDocs).not.toHaveBeenCalled();
  });
});
