import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react';

const ubicacion = vi.hoisted(() => ({ search: '' }));
const navegar = vi.hoisted(() => vi.fn());
const getDocsSimulado = vi.hoisted(() => vi.fn());
const permiso = vi.hoisted(() => ({ canEdit: false }));
let colecciones: Record<string, Array<Record<string, unknown> & { id: string }>> = {};

vi.mock('../firebase', () => ({ db: {} }));
vi.mock('../utils/audit', () => ({ logAction: vi.fn() }));
vi.mock('../hooks/useCanEdit', () => ({ useCanEdit: () => permiso.canEdit }));
vi.mock('../utils/renombrarCategoria', async (orig) => ({
  ...(await orig<typeof import('../utils/renombrarCategoria')>()),
  renombrarCategoria: vi.fn().mockResolvedValue(2),
}));
vi.mock('react-router', () => ({
  useNavigate: () => navegar,
  useLocation: () => ({ pathname: '/x', search: ubicacion.search, hash: '', state: null }),
}));
vi.mock('../context/AdminContext', () => ({ useAdmin: () => ({ isEditMode: false }) }));
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, nombre: string) => nombre,
  query: (nombre: string) => nombre,
  where: vi.fn(), doc: vi.fn(), deleteDoc: vi.fn(), updateDoc: vi.fn(), addDoc: vi.fn(), writeBatch: vi.fn(),
  getDocs: (nombre: string) => getDocsSimulado(nombre),
}));

import CorpusChristi from '../pages/CorpusChristi';
import Indicadores from '../pages/Indicadores';
import ListaSiglasCompania from '../components/ListaSiglasCompania';
import { invalidarIndice } from '../utils/busquedaGuia/cargaIndice';

const subrayados = (raiz: ParentNode = document) => Array.from(raiz.querySelectorAll('mark.coincidencia')).map(m => m.textContent);

beforeEach(() => {
  invalidarIndice();
  ubicacion.search = '';
  navegar.mockReset();
  getDocsSimulado.mockReset();
  getDocsSimulado.mockImplementation(async (nombre: string) => ({ docs: (colecciones[nombre] ?? []).map(d => ({ id: d.id, data: () => d })) }));
  permiso.canEdit = false;
  colecciones = {
    companias: [{ id: 'c7', 'Indicador de registro': 7, 'Sigla Compañía': 'GA-JR', 'Nombre Compañía': 'Compañía de Alarcón' }],
    transacciones: [{ id: 't7', Num: 7, Noticia: 'Pago a Alberto', Doc3: 3 }],
    documentos: [],
    corpus_christi: [
      { id: 'a', 'Indicador de registro': 1, Ciudad: 'Lima', 'Año': 1600, 'Encargado ': 'Alberto Pérez', Encargo: 'Danzas' },
      { id: 'b', 'Indicador de registro': 2, Ciudad: 'Potosí', 'Año': 1600, 'Encargado ': 'Luis', Encargo: 'Carros' },
      { id: 'c', 'Indicador de registro': 3, Ciudad: 'Lima', 'Año': 1610, 'Encargado ': 'Marta', Encargo: 'Música', 'Transacción': 7 },
    ],
    indicadores: [
      { id: 'i1', 'Indicador de registro': 1, 'Categorías': 'Pan', Ciudad: 'Potosí', 'Años': 'de 1580 (mayo) a 1582', Concepto: 'Trigo', 'Sigla Compañía': 7 },
      { id: 'i2', 'Indicador de registro': 2, 'Categorías': 'Vino', Ciudad: 'Lima', 'Años': '1600', Concepto: 'Uva' },
    ],
    manejo_de_caja: [], salarios: [], bibliografia: [],
  };
});
afterEach(cleanup);

describe('Corpus Christi: niveles 2 y 3', () => {
  it('sin q, todo igual: lista todos los grupos y no hay campo de resultados', async () => {
    render(<CorpusChristi />);
    await screen.findByText('Mostrando 3 registros');
    expect(screen.getAllByRole('button', { name: 'TRATO' })).toHaveLength(3);
    expect(screen.queryByText(/No se encontró/)).toBeNull();
  });

  it('sin q solo consulta las colecciones propias, companias y transacciones', async () => {
    render(<CorpusChristi />);
    await screen.findByText('Mostrando 3 registros');
    cleanup();
    render(<Indicadores />);
    await screen.findByText('Mostrando 2 categorías');
    const consultadas = new Set(getDocsSimulado.mock.calls.map(c => c[0]));
    expect(consultadas).toEqual(new Set(['corpus_christi', 'indicadores', 'companias', 'transacciones']));
  });

  it('nivel 2: Lima 1600 aparece solo si contiene el término', async () => {
    ubicacion.search = '?q=Alberto';
    render(<CorpusChristi />);
    // Lima 1600 (encargado) y Lima 1610 (noticia de la transacción); Potosí 1600 no.
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'TRATO' })).toHaveLength(2));
    const filas = screen.getAllByRole('row').map(f => f.textContent);
    expect(filas.some(t => t?.includes('Potosí'))).toBe(false);
  });

  it('nivel 2: sin coincidencias muestra el mensaje', async () => {
    ubicacion.search = '?q=Zaragoza';
    render(<CorpusChristi />);
    expect(await screen.findByText('No se encontró «Zaragoza» en Corpus Christi.')).toBeTruthy();
  });

  it('nivel 3: ?q=Alberto&ciudad=Lima&anio=1600 subraya el encargado y marca la fila', async () => {
    ubicacion.search = '?q=Alberto&ciudad=Lima&anio=1600';
    render(<CorpusChristi />);
    await waitFor(() => expect(subrayados()).toEqual(['Alberto']));
    expect(document.querySelectorAll('tr.fila-con-coincidencia')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Volver a los resultados' })).toBeTruthy();
  });

  it('nivel 3: coincidencia anidada resalta el botón «Transacción»', async () => {
    ubicacion.search = '?q=Alberto&ciudad=Lima&anio=1610';
    render(<CorpusChristi />);
    const boton = await waitFor(() => {
      const b = document.querySelector('button.boton-con-coincidencia');
      expect(b).not.toBeNull();
      return b as HTMLElement;
    });
    expect(boton.textContent).toContain('Transacción');
    expect(boton.textContent).toContain('(contiene «Alberto»)');
  });

  it('TRATO y Volver actualizan la URL conservando q', async () => {
    ubicacion.search = '?q=Alberto';
    render(<CorpusChristi />);
    fireEvent.click((await screen.findAllByRole('button', { name: 'TRATO' }))[0]);
    expect(navegar).toHaveBeenLastCalledWith('/x?q=Alberto&ciudad=Lima&anio=1600', { replace: false });
    fireEvent.click(screen.getByRole('button', { name: 'Volver a los resultados' }));
    expect(navegar).toHaveBeenLastCalledWith('/x?q=Alberto', { replace: false });
  });

  it('un término nuevo desde el nivel 3 borra la unidad', async () => {
    ubicacion.search = '?q=Alberto&ciudad=Lima&anio=1600';
    render(<CorpusChristi />);
    const campo = await screen.findByLabelText('Buscar en esta sección');
    fireEvent.change(campo, { target: { value: 'Marta' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    expect(navegar).toHaveBeenLastCalledWith('/x?q=Marta', { replace: true });
  });

  it('nivel 3: resalta «Doc. 3» y no «Doc. 1»', async () => {
    colecciones.corpus_christi = [
      { id: 'd', 'Indicador de registro': 4, Ciudad: 'Lima', 'Año': 1620, 'Encargado ': 'Pedro', Encargo: 'Toros', 'Transacción': 8 },
    ];
    colecciones.transacciones = [{ id: 't8', Num: 8, Noticia: 'Pago de toros', Doc1: 1, Doc3: 3 }];
    colecciones.documentos = [
      { id: 'd1', Doc: 1, Documento: 'Recibo de tela' },
      { id: 'd3', Doc: 3, Documento: 'Carta de Zorrilla' },
    ];
    ubicacion.search = '?q=Zorrilla&ciudad=Lima&anio=1620';
    render(<CorpusChristi />);
    await waitFor(() => expect(document.querySelector('button.boton-con-coincidencia')).not.toBeNull());
    expect(screen.getByRole('button', { name: /^Doc\. 3/ }).classList.contains('boton-con-coincidencia')).toBe(true);
    expect(screen.getByRole('button', { name: /^Doc\. 1/ }).classList.contains('boton-con-coincidencia')).toBe(false);
  });

  it('nivel 2: un grupo con espacios o año como cadena no se pierde', async () => {
    colecciones.corpus_christi = [
      { id: 'e', 'Indicador de registro': 1, Ciudad: 'Quito ', 'Año': ' 1650', 'Encargado ': 'Pedro de Quito' },
    ];
    ubicacion.search = '?q=Pedro';
    render(<CorpusChristi />);
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'TRATO' })).toHaveLength(1));
    expect(subrayados()).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'TRATO' }));
    ubicacion.search = '?q=Pedro&ciudad=Quito+&anio=+1650';
    cleanup();
    render(<CorpusChristi />);
    await waitFor(() => expect(subrayados()).toEqual(['Pedro']));
  });

  it('un ciudad sin anio se ignora', async () => {
    ubicacion.search = '?ciudad=Lima';
    render(<CorpusChristi />);
    await screen.findByText('Mostrando 3 registros');
    expect(screen.queryByRole('button', { name: /Volver/ })).toBeNull();
  });
});

describe('Identificación de indicadores: niveles 2 y 3', () => {
  it('sin q, todo igual', async () => {
    render(<Indicadores />);
    await screen.findByText('Mostrando 2 categorías');
  });

  it('«1581» lista la categoría con «de 1580 (mayo) a 1582» y subraya el rango', async () => {
    ubicacion.search = '?q=1581';
    render(<Indicadores />);
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'LISTA' })).toHaveLength(1));
    expect(screen.getByRole('cell', { name: 'Pan' })).toBeTruthy();
    cleanup();
    ubicacion.search = '?q=1581&categoria=Pan';
    render(<Indicadores />);
    await waitFor(() => expect(subrayados()).toEqual(['de 1580 (mayo) a 1582']));
  });

  it('LISTA lleva la categoría a la URL', async () => {
    ubicacion.search = '?q=1581';
    render(<Indicadores />);
    fireEvent.click(await screen.findByRole('button', { name: 'LISTA' }));
    expect(navegar).toHaveBeenLastCalledWith('/x?q=1581&categoria=Pan', { replace: false });
  });

  it('Volver conserva q', async () => {
    ubicacion.search = '?q=1581&categoria=Pan';
    render(<Indicadores />);
    fireEvent.click(await screen.findByRole('button', { name: 'Volver a los resultados' }));
    expect(navegar).toHaveBeenLastCalledWith('/x?q=1581', { replace: false });
  });

  it('renombrar con la categoría abierta en la URL reemplaza la URL', async () => {
    // Escenario: el modal «Renombrar» sigue abierto y el lector usa Atrás/Adelante, de modo que la
    // URL pasa a tener la categoría que se está renombrando. Al terminar, la URL debe apuntar al nombre nuevo.
    permiso.canEdit = true;
    const { rerender } = render(<Indicadores />);
    fireEvent.click(await screen.findByRole('button', { name: 'Renombrar la categoría Pan' }));
    ubicacion.search = '?categoria=Pan';
    rerender(<Indicadores />);
    fireEvent.change(await screen.findByLabelText('Nombre nuevo'), { target: { value: 'Panes' } });
    fireEvent.click(screen.getByRole('button', { name: 'Renombrar', hidden: true }));
    await waitFor(() => expect(navegar).toHaveBeenCalledWith('/x?categoria=Panes', { replace: true }));
  });
});

describe('«Reintentar» tras un fallo del índice', () => {
  it.each([
    { nombre: 'Corpus Christi', Pagina: CorpusChristi, q: 'Danzas', boton: 'TRATO' },
    { nombre: 'Identificación de indicadores', Pagina: Indicadores, q: '1581', boton: 'LISTA' },
  ])('$nombre vuelve a cargar y muestra resultados', async ({ Pagina, q, boton }) => {
    ubicacion.search = `?q=${q}`;
    const normal = getDocsSimulado.getMockImplementation()!;
    getDocsSimulado.mockImplementation(async (nombre: string) => {
      if (nombre === 'bibliografia') throw new Error('fallo simulado');
      return normal(nombre);
    });
    render(<Pagina />);
    await screen.findByRole('button', { name: 'Reintentar' });
    getDocsSimulado.mockImplementation(normal);
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findAllByRole('button', { name: boton })).toHaveLength(1);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull();
  });
});

describe('ListaSiglasCompania: término', () => {
  const companias = [{ id: 'c7', 'Indicador de registro': 7, 'Sigla Compañía': 'GA-JR' }];
  it('subraya la sigla que contiene el término', () => {
    render(<ListaSiglasCompania referencias={[7]} companias={companias} onAbrir={() => {}} termino="ga-jr" />);
    expect(subrayados(within(document.body).getByRole('button'))).toEqual(['GA-JR']);
  });
  it('sin término no subraya', () => {
    render(<ListaSiglasCompania referencias={[7]} companias={companias} onAbrir={() => {}} />);
    expect(subrayados()).toEqual([]);
  });
});
