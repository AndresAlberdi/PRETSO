import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import Busqueda from '../pages/Busqueda';
import { invalidarIndice } from '../utils/busquedaGuia/cargaIndice';

let colecciones: Record<string, any[]> = {};
const estado = vi.hoisted(() => ({ isAdmin: false }));

vi.mock('../firebase', () => ({ db: {} }));
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
  invalidarIndice();
  colecciones = {
    companias: [
      { id: 'c7', 'Indicador de registro': 7, 'Sigla Compañía': 'GA-JR', 'Nombre Compañía': 'Compañía de Alarcón', 'Temporadas teatrales': 'De 1580 a 1581' },
      { id: 'c12', 'Indicador de registro': 12, 'Sigla Compañía': '', 'Nombre Compañía': 'Compañía de Vargas' },
    ],
    manejo_de_caja: [{ id: 'm1', 'Sigla Compañía': 7, Ciudad: 'Potosí', 'Año': 1600, 'Transacción': 12 }],
    salarios: [], indicadores: [], bibliografia: [], documentos: [],
    corpus_christi: [],
    transacciones: [{ id: 't1', Num: 12, Noticia: 'Pagó Alberto en Potosí' }],
  };
});
afterEach(cleanup);

function abrir(q: string) {
  const ruta = q === '' ? '/buscar' : `/buscar?q=${encodeURIComponent(q)}`;
  render(<MemoryRouter initialEntries={[ruta]}><Busqueda /></MemoryRouter>);
}

const region = () => document.querySelector('output.visually-hidden') as HTMLElement;
const enlaces = () => screen.getAllByRole('link').map(a => a.getAttribute('href'));

describe('Búsqueda general: nivel 1 (secciones con coincidencias)', () => {
  it('lector: «Alberto» solo en una Noticia lista «Manejo de caja» y no «Transacciones»', async () => {
    abrir('Alberto');
    await screen.findByRole('heading', { level: 2, name: 'Secciones con «Alberto»' });
    expect(screen.getByRole('link', { name: /Manejo de caja/ }).getAttribute('href')).toBe('/caja?q=Alberto');
    expect(screen.getByRole('link', { name: /Manejo de caja/ }).textContent).toContain('1 registro');
    expect(screen.queryByRole('link', { name: /Transacciones/ })).toBeNull();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(region().textContent).toBe('Búsqueda: «Alberto» aparece en 1 sección');
  });

  it('administrador: aparece también «Transacciones»', async () => {
    estado.isAdmin = true;
    abrir('Alberto');
    await screen.findByRole('link', { name: /Transacciones/ });
    expect(screen.getByRole('link', { name: /Transacciones/ }).getAttribute('href')).toBe('/transacciones?q=Alberto');
    expect(region().textContent).toBe('Búsqueda: «Alberto» aparece en 2 secciones');
  });

  it('«1581» encuentra «De 1580 a 1581» en «Índice de compañías»', async () => {
    abrir('1581');
    const enlace = await screen.findByRole('link', { name: /Índice de compañías/ });
    expect(enlace.getAttribute('href')).toBe('/companias?q=1581');
  });

  it('codifica el término en el enlace', async () => {
    colecciones.manejo_de_caja[0].Ciudad = 'Potosí & Lima';
    abrir('Potosí & Lima');
    const enlace = await screen.findByRole('link', { name: /Manejo de caja/ });
    expect(enlace.getAttribute('href')).toBe('/caja?q=Potos%C3%AD+%26+Lima');
  });

  it('un texto que solo está en un campo retirado no encuentra el registro', async () => {
    colecciones.manejo_de_caja[0]['Datos sobre normativa de manejo de caja'] = 'norma secreta';
    abrir('norma secreta');
    await screen.findByText('No se encontró «norma secreta» en ninguna sección.');
    expect(region().textContent).toBe('Búsqueda sin resultados');
  });

  it('sin coincidencias: mensaje y anuncio, sin lista de secciones', async () => {
    abrir('zzzz-inexistente');
    await screen.findByText('No se encontró «zzzz-inexistente» en ninguna sección.');
    expect(screen.queryByRole('navigation', { name: 'Secciones de la base de datos' })).toBeNull();
  });

  it('«ab» muestra el aviso y no busca', async () => {
    abrir('ab');
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toBe('Escriba al menos 3 letras, o un año de cuatro cifras.');
    expect(screen.queryByText(/No se encontró/)).toBeNull();
    expect(region().textContent).toBe('');
    expect(screen.getByRole('navigation', { name: 'Secciones de la base de datos' })).toBeTruthy();
  });

  it('enviar el campo busca y «Limpiar» vuelve a la lista de secciones', async () => {
    abrir('');
    fireEvent.change(screen.getByLabelText('Buscar en la base de datos'), { target: { value: 'Potosí' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    await screen.findByRole('heading', { level: 2, name: 'Secciones con «Potosí»' });
    expect(enlaces()).toContain('/caja?q=Potos%C3%AD');
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar' }));
    await screen.findByRole('navigation', { name: 'Secciones de la base de datos' });
    expect(region().textContent).toBe('');
  });
});
