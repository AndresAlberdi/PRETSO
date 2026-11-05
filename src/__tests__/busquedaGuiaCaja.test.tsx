import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react';
import ManejoCaja from '../pages/ManejoCaja';
import Salarios from '../pages/Salarios';
import { invalidarIndice } from '../utils/busquedaGuia/cargaIndice';
import { CLASE_BOTON_COINCIDENCIA, CLASE_FILA_COINCIDENCIA } from '../components/Resaltado';

type Fila = { id: string } & Record<string, unknown>;

let colecciones: Record<string, Fila[]> = {};
const ubicacion = vi.hoisted(() => ({ search: '' }));
const navegar = vi.hoisted(() => vi.fn());
const consultadas = vi.hoisted(() => ({ nombres: [] as string[], fallar: false, retener: false }));

vi.mock('../firebase', () => ({ db: {} }));
vi.mock('../utils/audit', () => ({ logAction: vi.fn() }));
vi.mock('react-router', () => ({
  useNavigate: () => navegar,
  useLocation: () => ({ pathname: '/x', search: ubicacion.search, hash: '', state: null }),
}));
vi.mock('../context/AdminContext', () => ({ useAdmin: () => ({ isEditMode: false }) }));
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, nombre: string) => nombre,
  query: (nombre: string) => nombre,
  where: vi.fn(), doc: vi.fn(), deleteDoc: vi.fn(), updateDoc: vi.fn(), addDoc: vi.fn(),
  getDocs: async (nombre: string) => {
    consultadas.nombres.push(nombre);
    // Solo el índice lee «bibliografia»: permite simular su fallo o su demora sin afectar a la página.
    if (nombre === 'bibliografia' && consultadas.fallar) throw new Error('fallo simulado');
    if (nombre === 'bibliografia' && consultadas.retener) await new Promise(() => {});
    return { docs: (colecciones[nombre] ?? []).map(d => ({ id: d.id, data: () => d })) };
  },
}));

beforeEach(() => {
  invalidarIndice();
  navegar.mockClear();
  consultadas.nombres = [];
  consultadas.fallar = false;
  consultadas.retener = false;
  ubicacion.search = '';
  colecciones = {};
});
afterEach(cleanup);

const PAGINAS = [
  { nombre: 'Manejo de caja', Pagina: ManejoCaja, coleccion: 'manejo_de_caja', campo: 'Ingresos' },
  { nombre: 'Remuneraciones', Pagina: Salarios, coleccion: 'salarios', campo: 'Beneficiario ' },
];

function datos(coleccion: string, _campo: string, filas: Fila[]) {
  colecciones = {
    companias: [
      { id: 'c7', 'Indicador de registro': 7, 'Sigla Compañía': 'GA-JR', 'Nombre Compañía': 'Compañía de Alarcón', 'Ámbito': 'Local' },
      { id: 'c12', 'Indicador de registro': 12, 'Sigla Compañía': 'JG', 'Ámbito': 'Local' },
      { id: 'c20', 'Indicador de registro': 20, 'Sigla Compañía': 'ZZ', 'Ámbito': 'Regional' },
    ],
    transacciones: [
      { id: 't1', Num: 1, Noticia: 'Pago a Alberto', Doc1: 1 },
      { id: 't2', Num: 2, Noticia: 'Compra de tela', Doc1: 1, Doc3: 3 },
    ],
    documentos: [
      { id: 'd1', Doc: 1, Documento: 'Carta común' },
      { id: 'd3', Doc: 3, Documento: 'Recibo de Alberto' },
    ],
    [coleccion]: filas,
  };
}

const base = (campo: string): Fila[] => [
  { id: 'r1', 'Sigla Compañía': 7, Ciudad: 'Potosí', 'Año': 1600, [campo]: 'Pedro' },
  { id: 'r2', 'Sigla Compañía': 12, Ciudad: 'Lima', 'Año': 1610, [campo]: 'cobra Alberto' },
  { id: 'r3', 'Sigla Compañía': 12, Ciudad: 'Cuzco', 'Año': 1611, [campo]: 'Ana' },
  { id: 'r4', 'Sigla Compañía': 20, Ciudad: 'Quito', 'Año': 1620, [campo]: 'Alberto Díaz' },
];

describe.each(PAGINAS)('$nombre: búsqueda guiada', ({ Pagina, coleccion, campo, nombre }) => {
  it('nivel 2: solo quedan las compañías con coincidencia y los desplegables se combinan', async () => {
    datos(coleccion, campo, base(campo));
    ubicacion.search = '?q=Alberto';
    render(<Pagina />);
    const tabla = await screen.findByRole('table');
    expect(within(tabla).getByText('JG')).toBeTruthy();
    expect(within(tabla).getByText('ZZ')).toBeTruthy();
    expect(within(tabla).queryByText(/GA-JR/)).toBeNull();
    fireEvent.change(screen.getByRole('combobox', { name: 'Filtrar por ámbito' }), { target: { value: 'Regional' } });
    expect(within(screen.getByRole('table')).queryByText('JG')).toBeNull();
    expect(within(screen.getByRole('table')).getByText('ZZ')).toBeTruthy();
  });

  it('nivel 2: sin coincidencias muestra el mensaje con el término', async () => {
    datos(coleccion, campo, base(campo));
    ubicacion.search = '?q=Zorrilla';
    render(<Pagina />);
    expect(await screen.findByText(`No se encontró «Zorrilla» en ${nombre}.`)).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('nivel 3: subraya la celda y marca solo la fila con el término, sin ocultar las demás', async () => {
    datos(coleccion, campo, base(campo));
    ubicacion.search = '?q=Alberto&compania=12';
    render(<Pagina />);
    const marca = await screen.findByText('Alberto', { selector: 'mark.coincidencia' });
    const fila = marca.closest('tr') as HTMLElement;
    expect(fila.classList.contains(CLASE_FILA_COINCIDENCIA)).toBe(true);
    const otra = screen.getByText('Cuzco').closest('tr') as HTMLElement;
    expect(otra.classList.contains(CLASE_FILA_COINCIDENCIA)).toBe(false);
    expect(screen.getByText(/2 registros para JG/)).toBeTruthy();
    expect(document.querySelector('output.visually-hidden')?.textContent).toBe('Detalle de JG: 2 registros, 1 con «Alberto»');
  });

  it('término solo en la Noticia: la compañía se lista y «Transacción» lleva la clase y el texto oculto', async () => {
    datos(coleccion, campo, [{ id: 'r1', 'Sigla Compañía': 7, Ciudad: 'Potosí', 'Año': 1600, 'Transacción': 1, [campo]: 'Pedro' }]);
    ubicacion.search = '?q=Alberto';
    const { rerender } = render(<Pagina />);
    expect(await within(await screen.findByRole('table')).findByText(/GA-JR/)).toBeTruthy();
    ubicacion.search = '?q=Alberto&compania=7';
    rerender(<Pagina />);
    const boton = await screen.findByRole('button', { name: /^Transacción/ });
    await vi.waitFor(() => expect(boton.classList.contains(CLASE_BOTON_COINCIDENCIA)).toBe(true));
    expect(boton.querySelector('.visually-hidden')?.textContent).toBe(' (contiene «Alberto»)');
  });

  it('término solo en el Doc3: se resalta «Doc. 3» y no «Doc. 1»', async () => {
    datos(coleccion, campo, [{ id: 'r1', 'Sigla Compañía': 7, Ciudad: 'Potosí', 'Año': 1600, 'Transacción': 2, [campo]: 'Pedro' }]);
    ubicacion.search = '?q=Alberto&compania=7';
    render(<Pagina />);
    const doc3 = await screen.findByRole('button', { name: /^Doc\. 3/ });
    await vi.waitFor(() => expect(doc3.classList.contains(CLASE_BOTON_COINCIDENCIA)).toBe(true));
    expect(screen.getByRole('button', { name: /^Doc\. 1/ }).classList.contains(CLASE_BOTON_COINCIDENCIA)).toBe(false);
    expect(screen.getByRole('button', { name: /^Transacción/ }).classList.contains(CLASE_BOTON_COINCIDENCIA)).toBe(false);
  });

  it('enlace roto: sin resaltado de botones y sin error', async () => {
    datos(coleccion, campo, [{ id: 'r1', 'Sigla Compañía': 7, Ciudad: 'Potosí', 'Año': 1600, 'Transacción': 999, [campo]: 'Pedro' }]);
    ubicacion.search = '?q=Potosí&compania=7';
    render(<Pagina />);
    expect(await screen.findByRole('button', { name: 'Enlace roto' })).toBeTruthy();
    await screen.findByText('Potosí', { selector: 'mark.coincidencia' });
    expect(document.querySelector(`.${CLASE_BOTON_COINCIDENCIA}`)).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('«Volver a los resultados» conserva q y quita solo la compañía', async () => {
    datos(coleccion, campo, base(campo));
    ubicacion.search = '?q=Alberto&compania=12';
    render(<Pagina />);
    fireEvent.click(await screen.findByRole('button', { name: 'Volver a los resultados' }));
    expect(navegar).toHaveBeenCalledWith('/x?q=Alberto', { replace: false });
  });

  it('un término nuevo borra la unidad y vuelve al nivel 2', async () => {
    datos(coleccion, campo, base(campo));
    ubicacion.search = '?q=Alberto&compania=12';
    render(<Pagina />);
    await screen.findByRole('button', { name: 'Volver a los resultados' });
    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar en esta sección' }), { target: { value: 'Potosí' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    const [url, opciones] = navegar.mock.calls[navegar.mock.calls.length - 1];
    expect(url).toContain('q=Potos');
    expect(url).not.toContain('compania');
    expect(opciones).toEqual({ replace: true });
    expect(screen.queryByRole('button', { name: 'Volver a los resultados' })).toBeNull();
  });

  it('nivel 2: el nombre de la compañía hace coincidir a sus registros', async () => {
    datos(coleccion, campo, base(campo));
    ubicacion.search = '?q=Alarcón';
    render(<Pagina />);
    const tabla = await screen.findByRole('table');
    expect(within(tabla).getByText(/GA-JR/)).toBeTruthy();
    expect(within(tabla).queryByText('JG')).toBeNull();
    expect(screen.getByText('Alarcón', { selector: 'mark.coincidencia' })).toBeTruthy();
  });

  it('nivel 2: si la lista queda vacía por un desplegable, no dice «No se encontró»', async () => {
    datos(coleccion, campo, base(campo));
    ubicacion.search = '?q=Alberto';
    render(<Pagina />);
    await screen.findByRole('table');
    fireEvent.change(screen.getByRole('combobox', { name: 'Filtrar por compañía' }), { target: { value: '7' } });
    expect(screen.queryByText(/No se encontró/)).toBeNull();
    expect(screen.getByText('Mostrando 0 registros')).toBeTruthy();
  });

  it('nivel 2: sin coincidencias no muestra «Mostrando 0 registros»', async () => {
    datos(coleccion, campo, base(campo));
    ubicacion.search = '?q=Zorrilla';
    render(<Pagina />);
    await screen.findByText(`No se encontró «Zorrilla» en ${nombre}.`);
    expect(screen.queryByText(/Mostrando/)).toBeNull();
  });

  it('mientras carga el índice: «Buscando…» visible y anunciado', async () => {
    datos(coleccion, campo, base(campo));
    consultadas.retener = true;
    ubicacion.search = '?q=Alberto';
    render(<Pagina />);
    expect(await screen.findByText('Buscando…', { selector: 'p' })).toBeTruthy();
    expect(screen.queryByText(/Mostrando/)).toBeNull();
    expect(document.querySelector('output.visually-hidden')?.textContent).toBe('Buscando…');
  });

  it('si el índice falla: mensaje visible y anunciado, no «No se encontró»', async () => {
    datos(coleccion, campo, base(campo));
    consultadas.fallar = true;
    ubicacion.search = '?q=Alberto';
    render(<Pagina />);
    expect(await screen.findByText('No se pudo realizar la búsqueda.', { selector: 'p' })).toBeTruthy();
    expect(screen.queryByText(/No se encontró/)).toBeNull();
    expect(document.querySelector('output.visually-hidden')?.textContent).toBe('No se pudo realizar la búsqueda.');
  });

  it('quitar compania de la URL vuelve al nivel 2', async () => {
    datos(coleccion, campo, base(campo));
    ubicacion.search = '?q=Alberto&compania=12';
    const { rerender } = render(<Pagina />);
    await screen.findByRole('button', { name: 'Volver a los resultados' });
    ubicacion.search = '?q=Alberto';
    rerender(<Pagina />);
    expect(screen.queryByRole('button', { name: 'Volver a los resultados' })).toBeNull();
    expect(within(await screen.findByRole('table')).getByText('JG')).toBeTruthy();
  });

  it('sin q: comportamiento actual y ninguna lectura del índice', async () => {
    datos(coleccion, campo, base(campo));
    render(<Pagina />);
    await screen.findByText(/Mostrando 3 registros/);
    expect(within(screen.getByRole('table')).getByText('GA-JR / Compañía de Alarcón')).toBeTruthy();
    expect(consultadas.nombres).not.toContain('documentos');
    expect(consultadas.nombres).not.toContain('bibliografia');
    expect(screen.queryByRole('button', { name: /^Volver/ })).toBeNull();
    expect(document.querySelector('output.visually-hidden')?.textContent).toBe('Listado: 3 registros');
  });
});
