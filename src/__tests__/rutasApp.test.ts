import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const fuente = readFileSync(resolve(__dirname, '../App.tsx'), 'utf8');

// Extrae cada <Route path="..." ... /> completo (hasta el cierre "/>" de la línea) sin depender de espacios.
function rutas(): Map<string, string> {
  const mapa = new Map<string, string>();
  for (const m of fuente.matchAll(/<Route\s+path\s*=\s*"([^"]+)"[^\n]*/g)) {
    mapa.set(m[1], m[0]);
  }
  return mapa;
}
const R = rutas();
const sinEspacios = (t: string) => t.replace(/\s+/g, '');

describe('rutas de App.tsx', () => {
  it('declara las rutas esperadas', () => {
    for (const p of ['/buscar', '/', '/agregar', '/transacciones', '/documentos', '/auditoria', '/administracion', '/usuarios',
      '/caja', '/salarios', '/corpus', '/indicadores', '/companias', '/bibliografia', '*']) {
      expect(R.has(p), p).toBe(true);
    }
  });

  it.each(['/agregar', '/transacciones', '/documentos', '/auditoria', '/administracion', '/usuarios'])(
    '%s anida ProtectedRoute, ReaderRoute y AdminRoute en ese orden',
    (p) => {
      const t = R.get(p)!;
      const a = t.indexOf('<ProtectedRoute>');
      const b = t.indexOf('<ReaderRoute>');
      const c = t.indexOf('<AdminRoute>');
      expect(a).toBeGreaterThan(-1);
      expect(b).toBeGreaterThan(a);
      expect(c).toBeGreaterThan(b);
    },
  );

  it.each(['/caja', '/salarios', '/corpus', '/indicadores', '/companias', '/bibliografia'])(
    '%s usa ATRAS_BUSCAR y no AdminRoute',
    (p) => {
      const t = R.get(p)!;
      expect(t).toContain('ATRAS_BUSCAR');
      expect(t).not.toContain('AdminRoute');
    },
  );

  it('/agregar usa ATRAS_BUSCAR', () => {
    expect(R.get('/agregar')!).toContain('ATRAS_BUSCAR');
  });

  it('solo la ruta "/" usa conCuenta', () => {
    for (const [p, t] of R) {
      if (p === '/') expect(sinEspacios(t)).toContain('conCuenta');
      else expect(t, p).not.toContain('conCuenta');
    }
  });

  it('el comodín navega a "/"', () => {
    expect(sinEspacios(R.get('*')!)).toMatch(/<Navigateto="\/"/);
  });

  it('RouteEffects va antes de <Routes> para que el título de «Acceso pendiente» prevalezca', () => {
    expect(fuente.indexOf('<RouteEffects />')).toBeGreaterThan(-1);
    expect(fuente.indexOf('<RouteEffects />')).toBeLessThan(fuente.indexOf('<Routes>'));
  });
});
