import { describe, it, expect, vi, beforeEach } from 'vitest';

// Función simple (no vi.fn) para que el rechazo simulado no genere un rechazo sin atender en el espía.
const estado = vi.hoisted(() => ({
  lecturas: [] as string[],
  respuesta: (): Promise<unknown> => Promise.resolve({ docs: [] }),
}));
vi.mock('../firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, nombre: string) => nombre,
  getDocs: (nombre: string) => {
    estado.lecturas.push(nombre);
    return estado.respuesta();
  },
}));

import { leerSiglasCompanias } from '../utils/integridadCompanias';

beforeEach(() => {
  estado.lecturas = [];
});

describe('leerSiglasCompanias', () => {
  it('devuelve el id y la sigla de cada compañía', async () => {
    estado.respuesta = async () => ({
      docs: [
        { id: 'c1', data: () => ({ 'Sigla Compañía': 'GA-JR', Autores: 'x' }) },
        { id: 'c2', data: () => ({}) },
      ],
    });
    expect(await leerSiglasCompanias()).toEqual([
      { id: 'c1', 'Sigla Compañía': 'GA-JR' },
      { id: 'c2', 'Sigla Compañía': undefined },
    ]);
    expect(estado.lecturas).toEqual(['companias']);
  });

  it('si la lectura falla, rechaza', async () => {
    const error = new Error('sin red');
    estado.respuesta = () => Promise.reject(error);
    await expect(leerSiglasCompanias()).rejects.toBe(error);
  });
});
