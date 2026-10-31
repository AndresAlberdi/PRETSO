import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import Busqueda from '../pages/Busqueda';

let colecciones: Record<string, any[]> = {};
const estado = vi.hoisted(() => ({ isAdmin: false }));

vi.mock('../firebase', () => ({ db: {} }));
vi.mock('react-router', () => ({
  useNavigate: () => vi.fn(),
  Link: ({ to, children, ...r }: any) => <a href={String(to)} {...r}>{children}</a>,
}));
vi.mock('../context/AdminContext', () => ({
  useAdmin: () => ({ isAdmin: estado.isAdmin, adminLoading: false }),
}));
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, nombre: string) => nombre,
  query: (nombre: string) => nombre,
  getDocs: async (nombre: string) => ({
    docs: (colecciones[nombre] ?? []).map(d => ({ id: d.id, data: () => d })),
  }),
}));

beforeEach(() => {
  estado.isAdmin = false;
  colecciones = {
    companias: [
      { id: 'c7', 'Indicador de registro': 7, 'Sigla Compañía': 'GA-JR', 'Nombre Compañía': 'Compañía de Alarcón' },
      { id: 'c12', 'Indicador de registro': 12, 'Sigla Compañía': '', 'Nombre Compañía': 'Compañía de Vargas' },
    ],
    manejo_de_caja: [{ id: 'm1', 'Sigla Compañía': 7, Ciudad: 'Potosí', 'Año': 1600 }],
    salarios: [], indicadores: [], bibliografia: [], documentos: [],
    corpus_christi: [],
    transacciones: [{ id: 't1', Num: 12, Noticia: 'Potosí' }],
  };
});
afterEach(cleanup);

function buscar(categoria: string, texto: string) {
  const selects = screen.getAllByRole('combobox');
  fireEvent.change(selects[0], { target: { value: categoria } });
  fireEvent.change(screen.getByPlaceholderText('Añadir filtro...'), { target: { value: texto } });
  fireEvent.click(screen.getAllByRole('button', { name: 'Buscar' })[0]);
}

async function abrir(texto: string) {
  render(<Busqueda />);
  await screen.findByRole('heading', { name: 'Búsqueda general' });
  await vi.waitFor(() => expect(screen.queryByText(/Cargando base de datos/)).toBeNull());
  buscar('all', texto);
  await screen.findByText(/Resultados de Búsqueda/);
}

const region = () => document.querySelector('output.visually-hidden') as HTMLElement;

describe('Búsqueda general: texto de los resultados', () => {
  it('lector: sigla de la compañía y sin números de registro ni «Num»', async () => {
    await abrir('Potosí');
    expect(screen.getByText('Compañía: GA-JR | Ciudad: Potosí | Año: 1600')).toBeTruthy();
    const cuerpo = document.body.textContent ?? '';
    expect(cuerpo).not.toContain('Sigla Compañía:');
    expect(cuerpo).not.toContain('Indicador de registro');
    expect(cuerpo).not.toContain('Num:');
    expect(screen.queryByText('Transacciones')).toBeNull();
    expect(cuerpo).not.toContain('Nro.:');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(region().textContent).toBe('Búsqueda: 1 resultado');
  });

  it('administrador: «Nro.» en lugar de «Num»', async () => {
    estado.isAdmin = true;
    await abrir('Potosí');
    expect(screen.getByText(/Nro\.: 12/)).toBeTruthy();
    expect(document.body.textContent).not.toContain('Num: 12');
  });

  it('Corpus: compañía inexistente y compañía sin sigla', async () => {
    colecciones.manejo_de_caja = [];
    colecciones.corpus_christi = [{ id: 'k1', 'Compañía': 99, 'Compañía2': 12, Ciudad: 'Zzz' }];
    await abrir('Zzz');
    const texto = screen.getByText(/Compañía no encontrada/).textContent ?? '';
    expect(texto).toContain('Compañía: Compañía no encontrada');
    expect(texto).toContain('Compañía2: Compañía de Vargas');
  });
});
