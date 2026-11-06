import { describe, it, expect } from 'vitest';
import { cabeceraXml, campoXml, camposXml, CIERRE_XML, textoXml } from '../../utils/dataset/xml';

const def = { campo: 'Egresos', elemento: 'expenses', etiqueta: 'Egresos' };

const envuelto = (x: string) => `<r>${x}</r>`;

function esXmlValido(x: string): boolean {
  const doc = new DOMParser().parseFromString(x, 'application/xml');
  return doc.getElementsByTagName('parsererror').length === 0;
}

describe('textoXml', () => {
  it('escapa los cinco caracteres especiales', () => {
    expect(textoXml(`& < > " '`)).toBe('&amp; &lt; &gt; &quot; &apos;');
  });
  it('quita caracteres prohibidos y conserva los permitidos', () => {
    expect(textoXml('a\u0001b\u000Bc\uD800d')).toBe('abcd');
    expect(textoXml('a\tb\nñá€')).toBe('a\tb\nñá€');
  });
  it('normaliza a NFC', () => {
    expect(textoXml('á')).toBe('á');
  });
  it('convierte números y vacía null y objetos', () => {
    expect(textoXml(7)).toBe('7');
    expect(textoXml(null)).toBe('');
    expect(textoXml({})).toBe('');
    expect(textoXml(NaN)).toBe('');
    expect(textoXml(Infinity)).toBe('');
  });
});

describe('campoXml y cabeceraXml', () => {
  it('un campo vacío sale autocerrado', () => {
    const vacio = campoXml(def, '', 1);
    const lleno = campoXml(def, 'x & y', 0);
    expect(vacio).toBe('  <expenses label="Egresos"/>\n');
    expect(lleno).toBe('<expenses label="Egresos">x &amp; y</expenses>\n');
    expect(esXmlValido(envuelto(vacio))).toBe(true);
    expect(esXmlValido(envuelto(lleno))).toBe(true);
  });
  it('la cabecera lleva fecha UTC y conteo', () => {
    const c = cabeceraXml({ seccion: 'Manejo de caja', unidad: 'ABC', registros: 3, generadoEn: new Date('2026-11-06T12:00:00Z') });
    expect(c).toContain('generated_at>2026-11-06T12:00:00.000Z<');
    expect(c).toContain('record_count>3<');
  });
  it('todo el XML generado es válido', () => {
    const x =
      cabeceraXml({ seccion: 'S & T', unidad: 'Ü', registros: 1, generadoEn: new Date('2026-11-06T12:00:00Z') }) +
      '  <record>\n' +
      camposXml([def, { campo: 'b', elemento: 'b', etiqueta: 'B "q"' }], { Egresos: 'a<b\u0001\uD800', b: '' }, 2) +
      '  </record>\n' +
      CIERRE_XML;
    expect(esXmlValido(x)).toBe(true);
  });
});
