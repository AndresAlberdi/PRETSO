import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, cleanup, waitFor } from '@testing-library/react';
import { deleteDoc } from 'firebase/firestore';
import { PAGINAS, mostrarTabla, crearColecciones } from './ayudas/paginasSeccion';
import type { ColeccionesPrueba } from './ayudas/paginasSeccion';
import Documentos from '../pages/Documentos';
import Transacciones from '../pages/Transacciones';

vi.mock('../firebase', () => ({ auth: {}, db: {}, firebaseConfig: {} }));
vi.mock('../utils/audit', () => ({ logAction: vi.fn() }));
vi.mock('react-router', () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/x', search: '', state: null }),
}));
const estado = vi.hoisted(() => ({
  isAdmin: true, isReader: false, isEditMode: true, setIsEditMode: vi.fn(),
}));
vi.mock('../context/AdminContext', () => ({ useAdmin: () => estado }));

let colecciones: ColeccionesPrueba = {};
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, nombre: string) => nombre,
  query: (nombre: string) => nombre,
  where: vi.fn(), doc: vi.fn(), deleteDoc: vi.fn(), updateDoc: vi.fn(), addDoc: vi.fn(),
  getDocs: async (nombre: string) => ({
    docs: (colecciones[nombre] ?? []).map(d => ({ id: d.id, data: () => d })),
    empty: (colecciones[nombre] ?? []).length === 0,
    size: (colecciones[nombre] ?? []).length,
  }),
}));

const borrarMock = vi.mocked(deleteDoc);
let registro: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  colecciones = crearColecciones();
  borrarMock.mockReset();
  registro = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { cleanup(); registro.mockRestore(); });
vi.setConfig({ testTimeout: 15000 });

const MENSAJE = {
  Documentos: 'No se pudo borrar el documento. Inténtelo de nuevo.',
  Transacciones: 'No se pudo borrar la transacción. Inténtelo de nuevo.',
  'Índice de compañías': 'No se pudo borrar la compañía. Inténtelo de nuevo.',
  Bibliografía: 'No se pudo borrar el registro. Inténtelo de nuevo.',
  'Manejo de caja': 'No se pudo borrar el registro. Inténtelo de nuevo.',
  Remuneraciones: 'No se pudo borrar el registro. Inténtelo de nuevo.',
  'Corpus Christi': 'No se pudo borrar el registro. Inténtelo de nuevo.',
  Indicadores: 'No se pudo borrar el registro. Inténtelo de nuevo.',
} as const;

const TODAS = [
  { nombre: 'Documentos', Componente: Documentos },
  { nombre: 'Transacciones', Componente: Transacciones },
  ...PAGINAS.map(p => ({ nombre: p.nombre, Componente: p.Componente })),
];

async function borrarPrimero(nombre: string, Componente: React.ComponentType) {
  colecciones = crearColecciones();
  // Sin vínculos entre documentos y transacciones: el borrado llega a la confirmación.
  colecciones.transacciones = nombre === 'Transacciones' ? crearColecciones().transacciones : [];
  // El mock de getDocs ignora `where`: sin registros vinculados la verificación de integridad deja borrar.
  if (nombre === 'Transacciones' || nombre === 'Índice de compañías') {
    for (const c of ['manejo_de_caja', 'salarios', 'corpus_christi', 'indicadores']) colecciones[c] = [];
  }
  const pagina = PAGINAS.find(p => p.nombre === nombre);
  let tabla: HTMLElement;
  if (pagina) tabla = await mostrarTabla(pagina);
  else { render(<Componente />); tabla = (await screen.findAllByRole('table'))[0]; }
  fireEvent.click(within(tabla).getAllByRole('button', { name: 'Borrar' })[0]);
  // Documentos, Transacciones e Índice de compañías esperan 1 s de análisis antes de confirmar.
  const confirmar = await screen.findByRole('alertdialog', undefined, { timeout: 3000 });
  fireEvent.click(within(confirmar).getByRole('button', { name: /^(Borrar|Confirmar)$/ }));
}

describe.each(TODAS)('error al borrar en $nombre', ({ nombre, Componente }) => {
  it('avisa con un diálogo y registra solo el código', async () => {
    borrarMock.mockRejectedValue({ code: 'permission-denied', message: 'detalle técnico', email: 'a@b.c' });
    await borrarPrimero(nombre, Componente);
    const texto = await screen.findByText(MENSAJE[nombre as keyof typeof MENSAJE]);
    const aviso = screen.getByRole('alertdialog');
    expect(aviso.contains(texto)).toBe(true);
    expect(within(aviso).getByText('No se pudo completar la operación')).toBeTruthy();
    expect(screen.queryByText(/¿Está seguro|¿Estás seguro/)).toBeNull();
    expect(registro).toHaveBeenCalledWith(expect.stringMatching(/^No se pudo borrar .*:$/), 'permission-denied');
    for (const llamada of registro.mock.calls) {
      for (const arg of llamada) expect(typeof arg).toBe('string');
    }
  });

  it('registra «sin código» si el error no trae code ni name', async () => {
    borrarMock.mockRejectedValue({});
    await borrarPrimero(nombre, Componente);
    await screen.findByText(MENSAJE[nombre as keyof typeof MENSAJE]);
    expect(registro).toHaveBeenCalledWith(expect.any(String), 'sin código');
  });

  it('no muestra aviso si el borrado resulta bien', async () => {
    borrarMock.mockResolvedValue(undefined);
    await borrarPrimero(nombre, Componente);
    await waitFor(() => expect(borrarMock).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(registro).not.toHaveBeenCalled();
  });
});
