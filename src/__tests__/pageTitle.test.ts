import { describe, it, expect } from 'vitest';
import { pageTitle } from '../utils/pageTitle';

describe('pageTitle', () => {
  const casos: Array<[string, string]> = [
    ['/', 'Inicio — PRETSO'],
    ['/buscar', 'Búsqueda general — PRETSO'],
    ['/caja', 'Manejo de Caja — PRETSO'],
    ['/salarios', 'Remuneraciones — PRETSO'],
    ['/corpus', 'Corpus Christi — PRETSO'],
    ['/indicadores', 'Identificación de Indicadores — PRETSO'],
    ['/companias', 'Compañías — PRETSO'],
    ['/bibliografia', 'Bibliografía — PRETSO'],
    ['/agregar', 'Agregar transacción — PRETSO'],
    ['/transacciones', 'Transacciones — PRETSO'],
    ['/documentos', 'Documentos — PRETSO'],
    ['/auditoria', 'Auditoría — PRETSO'],
    ['/administracion', 'Administración — PRETSO'],
    ['/usuarios', 'Usuarios — PRETSO'],
    ['/login', 'Iniciar sesión — PRETSO'],
  ];

  it.each(casos)('ruta %s', (ruta, esperado) => {
    expect(pageTitle(ruta)).toBe(esperado);
  });

  it('ignora la barra final', () => {
    expect(pageTitle('/caja/')).toBe('Manejo de Caja — PRETSO');
  });

  it('usa PRETSO por defecto en rutas desconocidas', () => {
    expect(pageTitle('/no-existe')).toBe('PRETSO');
    expect(pageTitle('')).toBe('PRETSO');
    expect(pageTitle('/constructor')).toBe('PRETSO');
  });
});
