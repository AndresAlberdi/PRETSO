import { describe, it, expect, vi } from 'vitest';
import { CAMPOS_RETIRADOS, esCampoRetirado } from '../utils/camposRetirados';
import { COLUMN_ORDERS } from '../utils/xlsxExport';
import { translateField, generateDatabaseXml } from '../utils/backup';
import { render, screen, cleanup } from '@testing-library/react';
import DetailsModal from '../components/DetailsModal';
import { textoResultadoBusqueda } from '../utils/textoResultadoBusqueda';

const datos = vi.hoisted(() => ({
  salarios: [{
    id: 's1', 'Indicador de registro': 1, 'Ración diaria': 2, 'Pago por representación': 3,
    'Días de ración en un año': 365, 'Número estimado de representaciones por año': 10,
    'Número de representaciones  por año ': 12,
  }],
  manejo_de_caja: [{
    id: 'm1', 'Indicador de registro': 1, Ingresos: 5, 'Datos sobre normativa de manejo de caja': 'norma',
  }],
}));
vi.mock('../firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, nombre: string) => nombre,
  query: (nombre: string) => nombre,
  getDocs: async (nombre: string) => ({
    docs: ((datos as Record<string, unknown[]>)[nombre] ?? []).map(d => ({ data: () => d })),
  }),
}));

describe('campos retirados (Laura, 02/11/2026)', () => {
  it('son los cuatro acordados', () => {
    expect(CAMPOS_RETIRADOS.manejo_de_caja).toEqual(['Datos sobre normativa de manejo de caja']);
    expect(CAMPOS_RETIRADOS.salarios).toHaveLength(3);
  });

  it('se conservan Ración diaria y Pago por representación', () => {
    expect(esCampoRetirado('salarios', 'Ración diaria')).toBe(false);
    expect(esCampoRetirado('salarios', 'Pago por representación')).toBe(false);
  });

  it('un campo retirado de una colección no lo es en otra', () => {
    expect(esCampoRetirado('manejo_de_caja', 'Datos sobre normativa de manejo de caja')).toBe(true);
    expect(esCampoRetirado('salarios', 'Datos sobre normativa de manejo de caja')).toBe(false);
  });

  it('ninguna columna del Excel es un campo retirado', () => {
    for (const [coleccion, columnas] of Object.entries(COLUMN_ORDERS)) {
      for (const c of columnas) expect(esCampoRetirado(coleccion, c)).toBe(false);
    }
  });

  it('la copia XML ya no traduce los campos retirados', () => {
    expect(translateField('manejo_de_caja', 'Datos sobre normativa de manejo de caja'))
      .not.toBe('cash_management_regulations');
    expect(translateField('salarios', 'Días de ración en un año')).not.toBe('daily_allowance_days_per_year');
    expect(translateField('salarios', 'Ración diaria')).toBe('daily_allowance');
  });

  it('la copia XML omite los campos retirados aunque el registro los traiga y conserva los demás', async () => {
    const xml = await generateDatabaseXml();
    expect(xml).toContain('<daily_allowance>2</daily_allowance>');
    expect(xml).toContain('<performance_pay>3</performance_pay>');
    expect(xml).toContain('<income>5</income>');
    expect(xml).not.toContain('365');
    expect(xml).not.toContain('norma');
    expect(xml).not.toMatch(/dias_de_racion|numero_estimado|numero_de_representaciones/);
  });

  it('«Ver detalle» no muestra los campos retirados y sí los demás', () => {
    render(<DetailsModal collectionName="salarios" onClose={() => undefined}
      record={{ id: 's1', 'Ración diaria': 2, 'Días de ración en un año': 365 }} />);
    expect(screen.getByText('Ración diaria')).toBeTruthy();
    expect(screen.queryByText('Días de ración en un año')).toBeNull();
    expect(screen.queryByText('365')).toBeNull();
    cleanup();
  });

  it('el resumen de /buscar no usa campos retirados', () => {
    const t = textoResultadoBusqueda(
      { 'Datos sobre normativa de manejo de caja': 'norma', Ingresos: 5 }, 'manejo_de_caja', []);
    expect(t).toBe('Ingresos: 5');
  });
});
