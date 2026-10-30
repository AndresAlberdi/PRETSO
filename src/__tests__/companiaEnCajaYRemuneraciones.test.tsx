import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react';
import ManejoCaja from '../pages/ManejoCaja';
import Salarios from '../pages/Salarios';
import { contarReferenciasACompania } from '../utils/integridadCompanias';

const companias = [
  { id: 'c7', 'Indicador de registro': 7, 'Sigla Compañía': 'GA-JR', 'Nombre Compañía': 'Compañía de Alarcón', Autores: 'Alarcón y Ramírez' },
  { id: 'c12', 'Indicador de registro': 12, 'Sigla Compañía': 'JG', Autores: 'Juan' },
];

let colecciones: Record<string, any[]> = {};
const ubicacion = vi.hoisted(() => ({ search: '' }));
const admin = vi.hoisted(() => ({ isEditMode: false }));

vi.mock('../firebase', () => ({ db: {} }));
vi.mock('../utils/audit', () => ({ logAction: vi.fn() }));
vi.mock('react-router', () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/x', search: ubicacion.search, state: null }),
}));
vi.mock('../context/AdminContext', () => ({ useAdmin: () => ({ isAdmin: true, isEditMode: admin.isEditMode }) }));
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, nombre: string) => nombre,
  query: (nombre: string) => nombre,
  where: vi.fn(), doc: vi.fn(), deleteDoc: vi.fn(), updateDoc: vi.fn(), addDoc: vi.fn(),
  getDocs: async (nombre: string) => ({
    docs: (colecciones[nombre] ?? []).map(d => ({ id: d.id, data: () => d })),
  }),
}));

beforeEach(() => {
  ubicacion.search = '';
  admin.isEditMode = false;
  colecciones = {
    companias,
    transacciones: [],
    manejo_de_caja: [
      { id: 'm1', 'Sigla Compañía': 7, Ciudad: 'Potosí', 'Año': 1600, Ingresos: 100 },
      { id: 'm2', 'Sigla Compañía': 12, Ciudad: 'Lima', 'Año': 1610, Ingresos: 50 },
    ],
    salarios: [
      { id: 's1', 'Sigla Compañía': 7, Ciudad: 'Potosí', 'Año': 1600, 'Beneficiario ': 'Pedro Gómez' },
      { id: 's2', 'Sigla Compañía': 12, Ciudad: 'Lima', 'Año': 1610, 'Beneficiario ': 'Ana Ruiz' },
    ],
  };
});
afterEach(cleanup);

function buscar(categoria: string, texto: string) {
  const selects = screen.getAllByRole('combobox');
  fireEvent.change(selects[0], { target: { value: categoria } });
  fireEvent.change(screen.getByPlaceholderText('Añadir filtro...'), { target: { value: texto } });
  fireEvent.click(screen.getAllByRole('button', { name: 'Buscar' })[0]);
}

describe.each([
  ['Manejo de Caja', ManejoCaja, 'Alarcón', 'Alarcón'],
  ['Remuneraciones', Salarios, 'Alarcón', 'Alarcón'],
])('%s: la compañía se resuelve por número en los resultados y la búsqueda', (_nombre, Pagina, consulta) => {
  it('la búsqueda por persona encuentra el registro con referencia numérica', async () => {
    render(<Pagina />);
    await screen.findByText(/Mostrando \d+ registros/);
    buscar('Autores', consulta);
    expect(await screen.findByText('Resultados de Búsqueda (1 registros)')).toBeTruthy();
  });

  it('los resultados muestran «sigla - nombre completo» y no el número', async () => {
    render(<Pagina />);
    await screen.findByText(/Mostrando \d+ registros/);
    buscar('Autores', consulta);
    expect(await screen.findByText('GA-JR - Compañía de Alarcón')).toBeTruthy();
    const fila = screen.getByText('GA-JR - Compañía de Alarcón').closest('tr') as HTMLElement;
    expect(within(fila).queryByText('7')).toBeNull();
  });

  it('sin nombre completo, los resultados muestran la sigla', async () => {
    render(<Pagina />);
    await screen.findByText(/Mostrando \d+ registros/);
    buscar('Autores', 'Juan');
    expect(await screen.findByText('JG')).toBeTruthy();
    expect(screen.queryByText('12')).toBeNull();
  });

  it('el título de la lista muestra la sigla y no el número', async () => {
    ubicacion.search = '?compania=7';
    render(<Pagina />);
    expect(await screen.findByText(/1 registros para GA-JR/)).toBeTruthy();
    expect(screen.queryByText(/para 7$/)).toBeNull();
  });
});

describe('Remuneraciones: la búsqueda por persona también mira al beneficiario', () => {
  it('encuentra por beneficiario', async () => {
    render(<Salarios />);
    await screen.findByText(/Mostrando \d+ registros/);
    buscar('Autores', 'Ruiz');
    expect(await screen.findByText('Resultados de Búsqueda (1 registros)')).toBeTruthy();
  });
});

describe.each([
  ['Manejo de Caja', ManejoCaja, 'manejo_de_caja'],
  ['Remuneraciones', Salarios, 'salarios'],
])('%s: el filtro ?compania= muestra lo mismo que cuenta el índice de compañías', (_nombre, Pagina, coleccion) => {
  it('incluye número, variante heredada «7.0», número en texto y sigla heredada; excluye otras compañías', async () => {
    colecciones[coleccion] = [
      { id: 'a', 'Sigla Compañía': 7, Ciudad: 'Potosí', 'Año': 1600 },
      { id: 'b', 'Sigla Compañía': '7.0', Ciudad: 'Oruro', 'Año': 1601 },
      { id: 'c', 'Sigla Compañía': '7', Ciudad: 'Cuzco', 'Año': 1602 },
      { id: 'd', 'Sigla Compañía': ' ga-jr ', Ciudad: 'Quito', 'Año': 1603 },
      { id: 'e', 'Sigla Compañía': 12, Ciudad: 'Lima', 'Año': 1610 },
    ];
    const contados = await contarReferenciasACompania(coleccion, companias[0]);
    expect(contados).toBe(4);
    ubicacion.search = '?compania=7';
    render(<Pagina />);
    expect(await screen.findByText(`${contados} registros para GA-JR`)).toBeTruthy();
    for (const ciudad of ['Potosí', 'Oruro', 'Cuzco', 'Quito']) expect(screen.getByText(ciudad)).toBeTruthy();
    expect(screen.queryByText('Lima')).toBeNull();
  });

  it('la lista de compañías incluye a la que solo tiene referencias heredadas', async () => {
    colecciones[coleccion] = [{ id: 'b', 'Sigla Compañía': '7.0', Ciudad: 'Oruro', 'Año': 1601 }];
    render(<Pagina />);
    expect(await screen.findByText('Compañía de Alarcón', { exact: false })).toBeTruthy();
  });
});

describe.each([
  ['Manejo de Caja', ManejoCaja, 'manejo_de_caja'],
  ['Remuneraciones', Salarios, 'salarios'],
])('%s: la columna «Compañía» de los resultados ordena por sigla', (_nombre, Pagina, coleccion) => {
  it('ordena alfabéticamente por sigla y no por número guardado, en ambos sentidos', async () => {
    // Número y sigla en orden contrario: 7 -> ZZ, 12 -> AA.
    colecciones.companias = [
      { id: 'c7', 'Indicador de registro': 7, 'Sigla Compañía': 'ZZ', Autores: 'Z' },
      { id: 'c12', 'Indicador de registro': 12, 'Sigla Compañía': 'AA', Autores: 'A' },
      { id: 'c30', 'Indicador de registro': 30, 'Sigla Compañía': 'mm', Autores: 'M' },
    ];
    colecciones[coleccion] = [
      { id: 'a', 'Sigla Compañía': 7, Ciudad: 'Potosí', 'Año': 1600 },
      { id: 'b', 'Sigla Compañía': 12, Ciudad: 'Lima', 'Año': 1610 },
      { id: 'c', 'Sigla Compañía': 30, Ciudad: 'Quito', 'Año': 1620 },
    ];
    render(<Pagina />);
    await screen.findByText(/Mostrando \d+ registros/);
    buscar('Año', '16');
    await screen.findByText('Resultados de Búsqueda (3 registros)');
    const columna = () => screen.getAllByRole('row').slice(1).map(r => within(r).getAllByRole('cell')[0].textContent);
    const encabezado = () => screen.getByRole('columnheader', { name: /Compañía/ });
    fireEvent.click(screen.getByRole('button', { name: /Compañía/ }));
    expect(columna()).toEqual(['AA', 'mm', 'ZZ']);
    expect(encabezado().getAttribute('aria-sort')).toBe('ascending');
    fireEvent.click(screen.getByRole('button', { name: /Compañía/ }));
    expect(columna()).toEqual(['ZZ', 'mm', 'AA']);
    expect(encabezado().getAttribute('aria-sort')).toBe('descending');
  });

  it('el campo derivado de orden no llega al registro que se edita', async () => {
    admin.isEditMode = true;
    render(<Pagina />);
    await screen.findByText(/Mostrando \d+ registros/);
    buscar('Ciudad', 'Lima');
    await screen.findByText('Resultados de Búsqueda (1 registros)');
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    expect(document.body.innerHTML).not.toContain('__sigla');
  });
});

describe.each([
  ['Manejo de Caja', ManejoCaja],
  ['Remuneraciones', Salarios],
])('%s: enlace con una compañía inexistente', (_nombre, Pagina) => {
  it('muestra «Compañía no encontrada» y no «0 registros para 99»', async () => {
    ubicacion.search = '?compania=99';
    render(<Pagina />);
    expect(await screen.findByText('Compañía no encontrada')).toBeTruthy();
    expect(screen.queryByText(/registros para/)).toBeNull();
    expect(screen.queryByText(/99/)).toBeNull();
  });
});

describe('Manejo de Caja: el mensaje de borrado dice la sigla', () => {
  it('«registro de caja de GA-JR (1600)» y no el número', async () => {
    admin.isEditMode = true;
    render(<ManejoCaja />);
    await screen.findByText(/Mostrando \d+ registros/);
    buscar('Ciudad', 'Potosí');
    await screen.findByText('Resultados de Búsqueda (1 registros)');
    fireEvent.click(screen.getByRole('button', { name: 'Borrar' }));
    expect(await screen.findByText(/eliminar este registro de caja de GA-JR \(1600\)\?/)).toBeTruthy();
    expect(screen.queryByText(/caja de 7 /)).toBeNull();
  });
});
