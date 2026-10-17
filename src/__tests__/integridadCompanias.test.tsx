import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import IndiceCompanias from '../pages/IndiceCompanias';

const companias = [
  { id: 'c0', 'Indicador de registro': 0, 'Sigla Compañía': 'CERO', Autores: 'Cero' },
  { id: 'c7', 'Indicador de registro': 7, 'Sigla Compañía': 'GA-JR', Autores: 'Alarcón' },
  { id: 'c12', 'Indicador de registro': 12, 'Sigla Compañía': 'JG', Autores: 'Juan' },
];

let colecciones: Record<string, any[]> = {};
const deleteDoc = vi.hoisted(() => vi.fn());
const fallo = vi.hoisted(() => ({ coleccion: null as string | null }));

vi.mock('../firebase', () => ({ db: {} }));
vi.mock('../utils/audit', () => ({ logAction: vi.fn() }));
vi.mock('react-router', () => ({ useNavigate: () => vi.fn() }));
vi.mock('../context/AdminContext', () => ({ useAdmin: () => ({ isEditMode: true }) }));
// Firestore simulado: igualdad estricta por campo, como las consultas `==` reales
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, nombre: string) => nombre,
  where: (campo: string, op: string, valor: unknown) => ({ campo, op, valor }),
  query: (nombre: string, ...filtros: any[]) => ({ nombre, filtros }),
  doc: (_db: unknown, nombre: string, id: string) => ({ nombre, id }),
  deleteDoc: (...a: unknown[]) => deleteDoc(...a),
  updateDoc: vi.fn(),
  addDoc: vi.fn(),
  getDocs: async (q: string | { nombre: string; filtros: any[] }) => {
    const nombre = typeof q === 'string' ? q : q.nombre;
    if (fallo.coleccion === nombre) throw new Error('fallo simulado de lectura');
    const filtros = typeof q === 'string' ? [] : q.filtros;
    const docs = (colecciones[nombre] ?? []).filter(d => filtros.every(f => d[f.campo] === f.valor));
    return { empty: docs.length === 0, size: docs.length, docs: docs.map(d => ({ id: d.id, data: () => d })) };
  },
}));

beforeEach(() => {
  deleteDoc.mockReset().mockResolvedValue(undefined);
  fallo.coleccion = null;
  colecciones = { companias, manejo_de_caja: [], salarios: [], corpus_christi: [], indicadores: [] };
});
afterEach(cleanup);

async function intentarBorrar(sigla: string) {
  render(<IndiceCompanias />);
  const fila = (await screen.findByText(sigla)).closest('tr') as HTMLElement;
  fireEvent.click(Array.from(fila.querySelectorAll('button')).find(b => b.textContent === 'Borrar')!);
}

describe('borrado de compañías: integridad referencial', () => {
  it('una compañía sin referencias se puede borrar (pide confirmación)', async () => {
    await intentarBorrar('GA-JR');
    expect(await screen.findByText('Confirmar Borrado', {}, { timeout: 4000 })).toBeTruthy();
  });

  it('referenciada solo desde Corpus (campo Cmp2) NO se puede borrar', async () => {
    colecciones.corpus_christi = [{ id: 'k1', Cmp2: 7.0 }];
    await intentarBorrar('GA-JR');
    expect(await screen.findByText(/vinculada a 1 registro\(s\) \(1 en Corpus Christi\)/, {}, { timeout: 4000 })).toBeTruthy();
    expect(screen.queryByText('Confirmar Borrado')).toBeNull();
  });

  it('referenciada solo desde Corpus (Compañía10) por sigla heredada NO se puede borrar', async () => {
    colecciones.corpus_christi = [{ id: 'k1', 'Compañía10': 'GA-JR' }];
    await intentarBorrar('GA-JR');
    expect(await screen.findByText(/1 en Corpus Christi/, {}, { timeout: 4000 })).toBeTruthy();
  });

  it.each([
    ['manejo_de_caja', 'Caja'],
    ['salarios', 'Remuneraciones'],
    ['indicadores', 'Indicadores'],
  ])('referenciada solo desde %s NO se puede borrar', async (coleccion, etiqueta) => {
    colecciones[coleccion] = [{ id: 'r1', 'Sigla Compañía': 12 }];
    await intentarBorrar('JG');
    expect(await screen.findByText(new RegExp(`1 en ${etiqueta}`), {}, { timeout: 4000 })).toBeTruthy();
    expect(screen.queryByText('Confirmar Borrado')).toBeNull();
  });

  it('referencia por el texto del número (dato heredado) también bloquea', async () => {
    colecciones.salarios = [{ id: 'r1', 'Sigla Compañía': '12' }];
    await intentarBorrar('JG');
    expect(await screen.findByText(/1 en Remuneraciones/, {}, { timeout: 4000 })).toBeTruthy();
  });

  it('el número de registro 0 se respeta: bloquea si está referenciado y no si no', async () => {
    colecciones.manejo_de_caja = [{ id: 'r1', 'Sigla Compañía': 0 }];
    await intentarBorrar('CERO');
    expect(await screen.findByText(/1 en Caja/, {}, { timeout: 4000 })).toBeTruthy();
    cleanup();
    colecciones.manejo_de_caja = [{ id: 'r1', 'Sigla Compañía': 7 }];
    await intentarBorrar('CERO');
    expect(await screen.findByText('Confirmar Borrado', {}, { timeout: 4000 })).toBeTruthy();
  });

  it('un mismo registro con varios campos hacia la compañía cuenta una sola vez', async () => {
    colecciones.corpus_christi = [{ id: 'k1', 'Compañía': 7, Cmp: 7 }];
    await intentarBorrar('GA-JR');
    expect(await screen.findByText(/vinculada a 1 registro\(s\)/, {}, { timeout: 4000 })).toBeTruthy();
  });

  it.each([
    ['ga-jr', 'sigla heredada en minúsculas'],
    ['GA-JR ', 'sigla heredada con espacio'],
    ['7.0', 'número en texto'],
  ])('referencia heredada %j (%s) bloquea el borrado', async (valor) => {
    colecciones.salarios = [{ id: 'r1', 'Sigla Compañía': valor }];
    await intentarBorrar('GA-JR');
    expect(await screen.findByText(/1 en Remuneraciones/, {}, { timeout: 4000 })).toBeTruthy();
    expect(screen.queryByText('Confirmar Borrado')).toBeNull();
  });

  it('una compañía sin referencias no se confunde con otra distinta referenciada', async () => {
    colecciones.manejo_de_caja = [{ id: 'r1', 'Sigla Compañía': 12 }, { id: 'r2', 'Sigla Compañía': 'jg' }];
    colecciones.corpus_christi = [{ id: 'k1', Cmp2: 12, 'Compañía10': 'JG' }];
    await intentarBorrar('GA-JR');
    expect(await screen.findByText('Confirmar Borrado', {}, { timeout: 4000 })).toBeTruthy();
    expect(screen.queryByText(/vinculada/)).toBeNull();
  });

  it('si una lectura falla: avisa, no pide confirmación, no borra y cierra la capa de análisis', async () => {
    fallo.coleccion = 'corpus_christi';
    await intentarBorrar('GA-JR');
    expect(await screen.findByText(/No se pudo verificar si la compañía tiene registros vinculados; no se borró/, {}, { timeout: 4000 })).toBeTruthy();
    expect(screen.queryByText('Confirmar Borrado')).toBeNull();
    expect(deleteDoc).not.toHaveBeenCalled();
    expect(screen.queryByText(/analizando/i)).toBeNull();
  });
});
