import type { ComponentType } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ManejoCaja from '../../pages/ManejoCaja';
import Salarios from '../../pages/Salarios';
import CorpusChristi from '../../pages/CorpusChristi';
import Indicadores from '../../pages/Indicadores';
import IndiceCompanias from '../../pages/IndiceCompanias';
import Bibliografia from '../../pages/Bibliografia';

// Ayudante común de las pruebas de modo edición por sección. Los `vi.mock` van en cada archivo de prueba.

export type ColeccionesPrueba = Record<string, Array<{ id: string } & Record<string, unknown>>>;

export function crearColecciones(): ColeccionesPrueba {
  const base = { 'Sigla Compañía': 7, Ciudad: 'Potosí', 'Año': 1600 };
  return {
    companias: [
      { id: 'c7', 'Indicador de registro': 7, 'Sigla Compañía': 'GA-JR', 'Nombre Compañía': 'Compañía de Alarcón', Autores: 'Alarcón y Ramírez' },
      { id: 'c8', 'Indicador de registro': 8, 'Sigla Compañía': 'TM-01', 'Nombre Compañía': 'Compañía de Tirso', Autores: 'Tirso de Molina' },
    ],
    documentos: [
      { id: 'd1', Doc: 1, Documento: 'Carta de García' },
      { id: 'd2', Doc: 2, Documento: 'Recibo de tela' },
    ],
    transacciones: [
      { id: 't1', Num: 1, Noticia: 'Pago a García', 'Fuentes para la generación del dato': 'ALP' },
      { id: 't2', Num: 2, Noticia: 'Compra de tela', 'Fuentes para la generación del dato': 'AGI' },
    ],
    manejo_de_caja: [{ id: 'm1', ...base, Ingresos: 100 }, { id: 'm2', ...base, Ingresos: 200 }],
    salarios: [{ id: 's1', ...base }, { id: 's2', ...base }],
    corpus_christi: [{ id: 'cc1', ...base }, { id: 'cc2', ...base }],
    indicadores: [{ id: 'i1', ...base, 'Categorías': 'Precios' }, { id: 'i2', ...base, 'Categorías': 'Precios' }],
    bibliografia: [{ id: 'b1', Autores: 'Rennert', 'Referencias bibliográficas': 'The Spanish Stage' },
      { id: 'b2', Autores: 'Shergold', 'Referencias bibliográficas': 'A History of the Spanish Stage' },
    ],
  };
}

export interface Pagina {
  nombre: string;
  archivo: string;
  Componente: ComponentType;
  /** 'barra': SearchBar sin tabla de resumen ni pantalla de detalle. */
  buscador: 'SearchBar' | 'barra' | 'campo' | 'ninguno';
  filas: number;
  /** Usos de <CeldaAdmin en el código de la página. */
  celdas: number;
  /** Botón de la lista que abre la tabla de detalle y nombre de esa tabla. */
  detalle?: { boton: string; tabla: RegExp };
}
export const PAGINAS: Pagina[] = [
  { nombre: 'Manejo de caja', archivo: 'ManejoCaja.tsx', Componente: ManejoCaja, buscador: 'SearchBar', filas: 2, celdas: 2, detalle: { boton: 'CAJA', tabla: /^Registros de caja de / } },
  { nombre: 'Remuneraciones', archivo: 'Salarios.tsx', Componente: Salarios, buscador: 'SearchBar', filas: 2, celdas: 2, detalle: { boton: 'TRATO', tabla: /^Remuneraciones de / } },
  { nombre: 'Corpus Christi', archivo: 'CorpusChristi.tsx', Componente: CorpusChristi, buscador: 'SearchBar', filas: 2, celdas: 2, detalle: { boton: 'TRATO', tabla: /^Transacciones de Corpus Christi en / } },
  { nombre: 'Indicadores', archivo: 'Indicadores.tsx', Componente: Indicadores, buscador: 'SearchBar', filas: 2, celdas: 2, detalle: { boton: 'LISTA', tabla: /^Indicadores de la categoría / } },
  { nombre: 'Índice de compañías', archivo: 'IndiceCompanias.tsx', Componente: IndiceCompanias, buscador: 'campo', filas: 2, celdas: 1 },
  { nombre: 'Bibliografía', archivo: 'Bibliografia.tsx', Componente: Bibliografia, buscador: 'barra', filas: 2, celdas: 1 },
];

// Deja a la vista una tabla de datos: en las secciones con buscador, la de resultados.
export async function mostrarTabla(p: Pagina): Promise<HTMLElement> {
  render(<p.Componente />);
  if (p.buscador !== 'SearchBar') return (await screen.findAllByRole('table'))[0];
  await screen.findAllByRole('table');
  fireEvent.change(screen.getByRole('combobox', { name: 'Buscar en' }), { target: { value: 'all' } });
  fireEvent.change(screen.getByPlaceholderText('Añadir filtro...'), { target: { value: 'Potosí' } });
  fireEvent.click(screen.getAllByRole('button', { name: 'Buscar' })[0]);
  return screen.findByRole('table', { name: /^Resultados de búsqueda/ });
}

// Deja a la vista la tabla de detalle de una sección con lista de compañías, categorías o ciudades.
export async function mostrarDetalle(p: Pagina & { detalle: NonNullable<Pagina['detalle']> }): Promise<HTMLElement> {
  render(<p.Componente />);
  fireEvent.click((await screen.findAllByRole('button', { name: p.detalle.boton }))[0]);
  return screen.findByRole('table', { name: p.detalle.tabla });
}
