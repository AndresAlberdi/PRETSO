import { describe, it, expect } from 'vitest';
import { assertTextosLegalesPublicables } from '../legal/publicable';
import { MARCADOR, PAGINAS_LEGALES, PIE, textosLegalesPlanos } from '../legal/textosLegales';

const CON = ['texto', 'Falta [[PENDIENTE: año]] aquí'];
const SIN = ['texto', 'completo'];

describe('assertTextosLegalesPublicables', () => {
  it('lanza en producción con tag si hay marcador', () => {
    expect(() => assertTextosLegalesPublicables('production', 'tag', CON)).toThrow(/textos legales sin completar/);
  });
  it('lanza en producción con workflow_dispatch si hay marcador', () => {
    expect(() => assertTextosLegalesPublicables('production', 'branch', CON, 'workflow_dispatch')).toThrow();
  });
  it('no lanza en PR, en staging ni en producción local', () => {
    expect(() => assertTextosLegalesPublicables('production', 'branch', CON, 'pull_request')).not.toThrow();
    expect(() => assertTextosLegalesPublicables('production', undefined, CON)).not.toThrow();
    expect(() => assertTextosLegalesPublicables('staging', 'branch', CON, 'push')).not.toThrow();
    expect(() => assertTextosLegalesPublicables('staging', 'tag', CON)).not.toThrow();
  });
  it('no lanza sin marcadores', () => {
    expect(() => assertTextosLegalesPublicables('production', 'tag', SIN)).not.toThrow();
    expect(() => assertTextosLegalesPublicables('production', 'branch', SIN, 'workflow_dispatch')).not.toThrow();
  });
  it('reconoce el marcador con o sin «:», con corchetes dentro del texto o sin cierre', () => {
    expect(MARCADOR.test('[[PENDIENTE]]')).toBe(true);
    expect(MARCADOR.test('[[PENDIENTE: x]]')).toBe(true);
    expect(MARCADOR.test('[[PENDIENTE: a [b] c]]')).toBe(true);
    expect(MARCADOR.test('[[ pendiente: x')).toBe(true);
    expect(MARCADOR.test('texto sin marcador')).toBe(false);
  });
  it('detecta todas las apariciones de «[[PENDIENTE» de los textos planos', () => {
    const fuente = textosLegalesPlanos().join('\n');
    const abiertas = (fuente.match(/\[\[PENDIENTE/g) ?? []).length;
    const detectadas = fuente.split('\n').filter((l) => MARCADOR.test(l)).length;
    expect(abiertas).toBeGreaterThan(0);
    expect(detectadas).toBeGreaterThan(0);
    expect(fuente.replace(new RegExp(MARCADOR.source, 'gi'), '')).not.toMatch(/\[\[PENDIENTE/);
  });
  it('el recuadro vacío de la portada cuenta como pendiente', () => {
    expect(textosLegalesPlanos().some((t) => MARCADOR.test(t) && t.includes('portada'))).toBe(true);
  });
  it('los textos planos incluyen el pie y todas las páginas', () => {
    const planos = textosLegalesPlanos();
    expect(planos).toContain(PIE.titularidad);
    for (const p of Object.values(PAGINAS_LEGALES)) expect(planos).toContain(p.titulo);
  });
});
