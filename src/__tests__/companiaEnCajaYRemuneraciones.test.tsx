import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react';
import ManejoCaja from '../pages/ManejoCaja';
import Salarios from '../pages/Salarios';
import { contarReferenciasACompania } from '../utils/integridadCompanias';
import { invalidarIndice } from '../utils/busquedaGuia/cargaIndice';

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
  invalidarIndice();
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

describe.each([
  ['Manejo de caja', ManejoCaja],
  ['Remuneraciones', Salarios],
])('%s: la compañía se resuelve por número en el listado de la búsqueda', (_nombre, Pagina) => {
  it('el término en un registro con referencia numérica lista a su compañía y no a las demás', async () => {
    ubicacion.search = '?q=Potosí';
    render(<Pagina />);
    const tabla = await screen.findByRole('table');
    expect(within(tabla).getByText('GA-JR / Compañía de Alarcón')).toBeTruthy();
    expect(within(tabla).queryByText('JG')).toBeNull();
  });

  it('el listado muestra «sigla / nombre completo» y no el número', async () => {
    ubicacion.search = '?q=Potosí';
    render(<Pagina />);
    const celda = await screen.findByText('GA-JR / Compañía de Alarcón');
    expect(celda.closest('tr')?.textContent).not.toMatch(/\b7\b/);
  });

  it('la lista maestra de compañías muestra «sigla / nombre completo»', async () => {
    render(<Pagina />);
    await screen.findByText(/Mostrando \d+ registros/);
    expect(await screen.findByText('GA-JR / Compañía de Alarcón')).toBeTruthy();
  });

  it('sin nombre completo, el listado muestra la sigla', async () => {
    ubicacion.search = '?q=Lima';
    render(<Pagina />);
    const tabla = await screen.findByRole('table');
    expect(within(tabla).getByText('JG')).toBeTruthy();
    expect(within(tabla).queryByText('12')).toBeNull();
  });

  it('el título de la lista muestra la sigla y no el número', async () => {
    ubicacion.search = '?compania=7';
    render(<Pagina />);
    expect(await screen.findByText(/1 registros para GA-JR/)).toBeTruthy();
    expect(screen.queryByText(/para 7$/)).toBeNull();
  });
});

describe('Remuneraciones: el término también mira al beneficiario', () => {
  it('encuentra por beneficiario', async () => {
    ubicacion.search = '?q=Ruiz';
    render(<Salarios />);
    const tabla = await screen.findByRole('table');
    expect(within(tabla).getByText('JG')).toBeTruthy();
    expect(within(tabla).queryByText('GA-JR / Compañía de Alarcón')).toBeNull();
  });
});

describe.each([
  ['Manejo de caja', ManejoCaja, 'manejo_de_caja'],
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
  ['Manejo de caja', ManejoCaja],
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

describe('Manejo de caja: el mensaje de borrado dice la sigla', () => {
  it('«registro de caja de GA-JR (1600)» y no el número', async () => {
    admin.isEditMode = true;
    ubicacion.search = '?compania=7';
    render(<ManejoCaja />);
    await screen.findByText(/1 registros para GA-JR/);
    fireEvent.click(screen.getByRole('button', { name: 'Borrar' }));
    expect(await screen.findByText(/eliminar este registro de caja de GA-JR \(1600\)\?/)).toBeTruthy();
    expect(screen.queryByText(/caja de 7 /)).toBeNull();
  });
});
