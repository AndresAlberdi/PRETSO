import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import CorpusChristi from '../pages/CorpusChristi';
import Indicadores from '../pages/Indicadores';
import CompaniaModal from '../components/CompaniaModal';

const companias = [
  { id: 'c7', 'Indicador de registro': 7, 'Sigla Compañía': 'GA-JR', 'Nombre Compañía': 'Compañía de Alarcón', Autores: 'Alarcón' },
  { id: 'c12', 'Indicador de registro': 12, 'Sigla Compañía': 'JG', Autores: 'Juan' },
];

let colecciones: Record<string, any[]> = {};
const lecturas = vi.hoisted(() => ({ lista: [] as string[] }));

vi.mock('../firebase', () => ({ db: {} }));
vi.mock('../utils/audit', () => ({ logAction: vi.fn() }));
vi.mock('react-router', () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/x', search: '', state: null }),
}));
vi.mock('../context/AdminContext', () => ({ useAdmin: () => ({ isEditMode: false }) }));
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, nombre: string) => nombre,
  where: (campo: string, op: string, valor: unknown) => ({ campo, op, valor }),
  query: (nombre: string, ...filtros: any[]) => ({ nombre, filtros }),
  doc: vi.fn(), deleteDoc: vi.fn(), updateDoc: vi.fn(), addDoc: vi.fn(),
  getDocs: async (q: { nombre: string; filtros: any[] }) => {
    lecturas.lista.push(q.nombre);
    const docs = (colecciones[q.nombre] ?? []).filter(d => q.filtros.every(f => d[f.campo] === f.valor));
    return { empty: docs.length === 0, docs: docs.map(d => ({ id: d.id, data: () => d })) };
  },
}));

beforeEach(() => {
  lecturas.lista = [];
  colecciones = { companias, transacciones: [], corpus_christi: [], indicadores: [] };
});
afterEach(cleanup);

async function abrirTratoCorpus() {
  render(<CorpusChristi />);
  fireEvent.click(await screen.findByRole('button', { name: 'TRATO' }));
}

describe('Corpus Christi: sigla en vez de número de registro', () => {
  beforeEach(() => {
    colecciones.corpus_christi = [{ id: 'k1', Ciudad: 'Potosí', 'Año': 1600, 'Encargado ': 'Pedro', 'Compañía': 7, Cmp: 7.0, 'Compañía2': 12 }];
  });

  it('el botón muestra la sigla y no el número; una compañía repetida (Compañía y Cmp) sale una vez', async () => {
    await abrirTratoCorpus();
    expect(await screen.findAllByRole('button', { name: 'GA-JR' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'JG' })).toHaveLength(1);
    expect(screen.queryByText('7')).toBeNull();
    expect(screen.queryByText('12')).toBeNull();
  });

  it('un clic abre la ventana con los detalles, sin consultas, y sin «Indicador de registro»', async () => {
    await abrirTratoCorpus();
    const boton = await screen.findByRole('button', { name: 'GA-JR' });
    const antes = lecturas.lista.length;
    fireEvent.click(boton);
    expect(screen.getByText('Detalle de Compañía')).toBeTruthy();
    expect(screen.getByText('Compañía de Alarcón')).toBeTruthy();
    expect(screen.queryByText('Indicador de registro')).toBeNull();
    expect(lecturas.lista.length).toBe(antes);
  });

  it('un valor sin resolver se muestra como texto atenuado, sin botón', async () => {
    colecciones.corpus_christi[0]['Compañía3'] = 99;
    await abrirTratoCorpus();
    await screen.findByRole('button', { name: 'GA-JR' });
    expect(screen.getByText('99')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '99' })).toBeNull();
  });
});

describe('Indicadores: sigla en vez de número de registro', () => {
  beforeEach(() => {
    colecciones.indicadores = [
      { id: 'i1', Ciudad: 'Lima', 'Años': 1650, Concepto: 'Pan', 'Categorías': 'Alimentos', 'Sigla Compañía': 12 },
      { id: 'i2', Ciudad: 'Lima', 'Años': 1651, Concepto: 'Vino', 'Categorías': 'Alimentos', 'Sigla Compañía': 55 },
      { id: 'i3', Ciudad: 'Lima', 'Años': 1652, Concepto: 'Sal', 'Categorías': 'Alimentos', 'Sigla Compañía': null },
    ];
  });

  async function abrirLista() {
    render(<Indicadores />);
    fireEvent.click(await screen.findByRole('button', { name: 'LISTA' }));
  }

  it('el botón muestra la sigla y no el número, y abre los detalles sin consultas', async () => {
    await abrirLista();
    const boton = await screen.findByRole('button', { name: 'JG' });
    expect(screen.queryByText('12')).toBeNull();
    const antes = lecturas.lista.length;
    fireEvent.click(boton);
    expect(screen.getByText('Detalle de Compañía')).toBeTruthy();
    expect(screen.getByText('Juan')).toBeTruthy();
    expect(screen.queryByText('Indicador de registro')).toBeNull();
    expect(lecturas.lista.length).toBe(antes);
  });

  it('un valor sin resolver se muestra como texto sin botón y la referencia vacía no muestra nada', async () => {
    await abrirLista();
    await screen.findByRole('button', { name: 'JG' });
    expect(screen.getByText('55')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '55' })).toBeNull();
    expect(screen.queryByText('null')).toBeNull();
  });
});

describe('CompaniaModal sin la prop compania', () => {
  it('conserva la consulta por número y no muestra «Indicador de registro»', async () => {
    render(<CompaniaModal sigla="12" onClose={vi.fn()} />);
    expect(await screen.findByText('Juan')).toBeTruthy();
    expect(lecturas.lista).toContain('companias');
    expect(screen.queryByText('Indicador de registro')).toBeNull();
  });
});
