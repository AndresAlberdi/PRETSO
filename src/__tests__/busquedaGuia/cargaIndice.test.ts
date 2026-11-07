import { describe, it, expect, vi, beforeEach } from 'vitest';

const getDocs = vi.hoisted(() => vi.fn());
vi.mock('../../firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, nombre: string) => nombre,
  query: (nombre: string) => nombre,
  getDocs: (...a: unknown[]) => getDocs(...a),
}));

import { cargarIndice, invalidarIndice, versionIndice, suscribirIndice, COLECCIONES_INDICE, VIGENCIA_INDICE_MS } from '../../utils/busquedaGuia/cargaIndice';

beforeEach(() => {
  invalidarIndice();
  getDocs.mockReset();
  getDocs.mockImplementation(async () => ({ docs: [{ id: 'x1', data: () => ({ Ciudad: 'Lima' }) }] }));
});

describe('cargarIndice', () => {
  it('dos llamadas comparten una sola carga de las 8 colecciones', async () => {
    const [a, b] = await Promise.all([cargarIndice(), cargarIndice()]);
    expect(a).toBe(b);
    expect(getDocs).toHaveBeenCalledTimes(COLECCIONES_INDICE.length);
    expect(COLECCIONES_INDICE).toHaveLength(8);
  });

  it('recarga después de 15 minutos', async () => {
    let t = 1_000;
    await cargarIndice(() => t);
    t += VIGENCIA_INDICE_MS - 1;
    await cargarIndice(() => t);
    expect(getDocs).toHaveBeenCalledTimes(8);
    t += 2;
    await cargarIndice(() => t);
    expect(getDocs).toHaveBeenCalledTimes(16);
  });

  it('invalidarIndice provoca recarga, sube la versión y avisa a los suscriptores', async () => {
    await cargarIndice();
    const aviso = vi.fn();
    const baja = suscribirIndice(aviso);
    const v = versionIndice();
    invalidarIndice();
    expect(versionIndice()).toBe(v + 1);
    expect(aviso).toHaveBeenCalledTimes(1);
    await cargarIndice();
    expect(getDocs).toHaveBeenCalledTimes(16);
    baja();
    invalidarIndice();
    expect(aviso).toHaveBeenCalledTimes(1);
  });

  it('un rechazo no queda en caché', async () => {
    getDocs.mockRejectedValue(new Error('sin red'));
    await expect(cargarIndice()).rejects.toThrow('sin red');
    getDocs.mockImplementation(async () => ({ docs: [] }));
    await expect(cargarIndice()).resolves.toBeTruthy();
  });
});
