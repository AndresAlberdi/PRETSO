import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, within, renderHook, act } from '@testing-library/react';
import IndiceCompanias from '../pages/IndiceCompanias';
import Bibliografia from '../pages/Bibliografia';
import { useCoincidenciasSeccion } from '../hooks/useIndiceBusqueda';
import { cargarIndice, invalidarIndice } from '../utils/busquedaGuia/cargaIndice';

const ubicacion = vi.hoisted(() => ({ search: '' }));
const navegar = vi.hoisted(() => vi.fn());
let colecciones: Record<string, any[]> = {};
const compuerta = vi.hoisted(() => ({ espera: null as Promise<void> | null }));

vi.mock('../firebase', () => ({ db: {} }));
vi.mock('../utils/audit', () => ({ logAction: vi.fn() }));
vi.mock('react-router', () => ({
  useNavigate: () => navegar,
  useLocation: () => ({ pathname: '/x', search: ubicacion.search, state: null }),
}));
vi.mock('../context/AdminContext', () => ({ useAdmin: () => ({ isAdmin: false, isEditMode: false }) }));
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, nombre: string) => nombre,
  query: (nombre: string) => nombre,
  where: vi.fn(), doc: vi.fn(), deleteDoc: vi.fn(), updateDoc: vi.fn(), addDoc: vi.fn(),
  getDocs: async (nombre: string) => {
    if (compuerta.espera && nombre === 'bibliografia') await compuerta.espera;
    return {
      docs: (colecciones[nombre] ?? []).map(d => ({ id: d.id, data: () => d })),
    };
  },
}));

beforeEach(() => {
  invalidarIndice();
  navegar.mockReset();
  compuerta.espera = null;
  ubicacion.search = '';
  colecciones = {
    companias: [
      { id: 'c1', 'Indicador de registro': 1, 'Sigla Compañía': 'AB-1', 'Nombre Compañía': 'Primera', Autores: 'Alarcón', 'Temporadas teatrales': 'De 1580 a 1581', 'Ámbito': 'España' },
      { id: 'c2', 'Indicador de registro': 2, 'Sigla Compañía': 'CD-2', 'Nombre Compañía': 'Segunda', Autores: 'Ruiz', 'Temporadas teatrales': 'De 1600 a 1602', 'Ámbito': 'Perú' },
    ],
    bibliografia: [
      { id: 'b1', Autores: 'García, Juan', 'Referencias bibliográficas': 'Teatro en Valencia' },
      { id: 'b2', Autores: 'Pérez, Ana', 'Referencias bibliográficas': 'Estudio sobre García Lorca' },
      { id: 'b3', Autores: 'Ruiz, Luis', 'Referencias bibliográficas': 'Fiestas del Corpus' },
    ],
    manejo_de_caja: [], salarios: [], corpus_christi: [], indicadores: [], transacciones: [], documentos: [],
  };
});
afterEach(cleanup);

const campo = () => screen.getByRole('searchbox', { name: 'Buscar en esta sección' });
const buscar = (texto: string) => {
  fireEvent.change(campo(), { target: { value: texto } });
  fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
};

describe('Índice de compañías con la búsqueda guiada', () => {
  it('«1581» encuentra «De 1580 a 1581», lo subraya y deja una sola región viva', async () => {
    render(<IndiceCompanias />);
    await screen.findByText('AB-1');
    expect(screen.getByText('CD-2')).toBeTruthy();
    buscar('1581');
    await waitFor(() => expect(screen.queryByText('CD-2')).toBeNull());
    expect(screen.getByText('AB-1')).toBeTruthy();
    const marca = document.querySelector('mark.coincidencia');
    expect(marca?.textContent).toBe('De 1580 a 1581');
    expect(document.querySelectorAll('output[aria-live]')).toHaveLength(1);
    await waitFor(() => expect(document.querySelector('output')?.textContent).toBe('Búsqueda: 1 compañía encontrada'));
  });

  it('busca en Ámbito sin acentos y Limpiar restaura el total', async () => {
    render(<IndiceCompanias />);
    await screen.findByText('AB-1');
    buscar('espana');
    await waitFor(() => expect(screen.queryByText('CD-2')).toBeNull());
    expect(screen.getByText('Total registros: 1')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar' }));
    expect(screen.getByText('Total registros: 2')).toBeTruthy();
    expect(screen.getByText('CD-2')).toBeTruthy();
  });

  it('«ab» muestra el aviso y no filtra', async () => {
    render(<IndiceCompanias />);
    await screen.findByText('AB-1');
    buscar('ab');
    expect(screen.getByRole('alert').textContent).toBe('Escriba al menos 3 letras, o un año de cuatro cifras.');
    expect(screen.getByText('CD-2')).toBeTruthy();
  });

  it('un término de la URL filtra desde el inicio', async () => {
    ubicacion.search = '?q=alarcon';
    render(<IndiceCompanias />);
    await waitFor(() => expect(screen.queryByText('CD-2')).toBeNull());
    expect((campo() as HTMLInputElement).value).toBe('alarcon');
  });
});

describe('Bibliografía con la búsqueda guiada', () => {
  it('«garcia» encuentra autores y referencias, y Limpiar restaura el total', async () => {
    render(<Bibliografia />);
    await screen.findByText('Mostrando 3 de 3 registros');
    buscar('garcia');
    await screen.findByText('Mostrando 2 de 3 registros');
    expect(screen.queryByText('Fiestas del Corpus')).toBeNull();
    const tabla = screen.getByRole('table');
    expect(within(tabla).getAllByText('García', { exact: false }).length).toBeGreaterThan(0);
    expect(document.querySelectorAll('mark.coincidencia').length).toBeGreaterThan(0);
    expect(document.querySelectorAll('output[aria-live]')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar' }));
    expect(screen.getByText('Mostrando 3 de 3 registros')).toBeTruthy();
  });

  it('«ab» muestra el aviso y no filtra', async () => {
    render(<Bibliografia />);
    await screen.findByText('Mostrando 3 de 3 registros');
    buscar('ab');
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('Mostrando 3 de 3 registros')).toBeTruthy();
  });
});

describe('correcciones de la revisión', () => {
  it('con el índice ya en caché y los datos de la página después, desplaza a la primera coincidencia', async () => {
    await cargarIndice();
    // Los datos de la propia página llegan después de que el índice (en caché) esté listo.
    let abrir: () => void = () => {};
    compuerta.espera = new Promise<void>(r => { abrir = r; });
    ubicacion.search = '?q=garcia';
    const desplazar = vi.fn();
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = desplazar;
    try {
      render(<div id="contenido"><Bibliografia /></div>);
      await new Promise(r => setTimeout(r, 50));
      expect(desplazar).not.toHaveBeenCalled();
      abrir();
      await screen.findByText('Mostrando 2 de 3 registros');
      await waitFor(() => expect(desplazar).toHaveBeenCalled());
      expect(document.querySelector('mark.coincidencia')).not.toBeNull();
    } finally {
      Element.prototype.scrollIntoView = original;
    }
  });

  it('useCoincidenciasSeccion devuelve reintentar y recupera tras un error', async () => {
    const fallo = vi.spyOn(colecciones.bibliografia, 'map').mockImplementationOnce(() => { throw new Error('fallo simulado'); });
    const { result } = renderHook(() => useCoincidenciasSeccion('bibliografia', 'garcia'));
    await waitFor(() => expect(result.current.estado).toBe('error'));
    fallo.mockRestore();
    act(() => result.current.reintentar());
    await waitFor(() => expect(result.current.estado).toBe('listo'));
    expect(result.current.porId.size).toBe(2);
  });

  it('el Índice muestra el error en pantalla con «Reintentar» y sin «Total registros: 0»', async () => {
    const fallo = vi.spyOn(colecciones.bibliografia, 'map').mockImplementationOnce(() => { throw new Error('fallo simulado'); });
    ubicacion.search = '?q=alarcon';
    render(<IndiceCompanias />);
    await screen.findByText('AB-1', {}, { timeout: 3000 }).catch(() => undefined);
    await screen.findByRole('button', { name: 'Reintentar' });
    expect(screen.queryByText(/Total registros/)).toBeNull();
    fallo.mockRestore();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await screen.findByText('Total registros: 1');
  });

  it('una compañía puede listarse sin subrayado si la coincidencia está en un campo que la tabla no muestra', async () => {
    // Decisión de diseño 6: el subrayado solo cubre texto visible; «Nombre Compañía» está indexado pero la tabla no lo muestra.
    ubicacion.search = '?q=primera';
    render(<IndiceCompanias />);
    await waitFor(() => expect(screen.queryByText('CD-2')).toBeNull());
    expect(screen.getByText('AB-1')).toBeTruthy();
    expect(document.querySelector('mark.coincidencia')).toBeNull();
  });
});
