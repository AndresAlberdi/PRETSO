import { describe, it, expect } from 'vitest';
import { construirEnlaces, transaccionXml } from '../../utils/dataset/enlaces';
import { idsDocumentos } from '../../utils/documentosTransaccion';
import { contarAvisos, crearAvisos } from '../../utils/dataset/tipos';

const valido = (x: string) =>
  new DOMParser().parseFromString(`<r>${x}</r>`, 'application/xml').getElementsByTagName('parsererror').length === 0;

describe('enlaces del dataset', () => {
  const enlaces = construirEnlaces({
    transacciones: [
      { Num: 7, Noticia: 'Pago & cobro', Doc1: 12, Doc2: 12, Doc3: 0, Doc4: '' },
      { Num: 8, Noticia: 'Otra', Doc1: '12' },
    ],
    documentos: [{ Doc: 12, Documento: 'Texto del documento' }],
  });

  it('encuentra la transacción con referencia "7.0" y emite el número canónico', () => {
    const a = crearAvisos();
    const x = transaccionXml('7.0', enlaces, 1, a);
    expect(x).toContain('<transaction_number label="Nro. de transacción">7</transaction_number>');
    expect(x).toContain('Pago &amp; cobro');
    expect(contarAvisos(a).transaccionesNoEncontradas).toBe(0);
    expect(valido(x)).toBe(true);
  });

  it('Doc1 = Doc2 sale una vez; 0 y vacío se ignoran', () => {
    expect(idsDocumentos(enlaces.transacciones.get('7') as Record<string, unknown>)).toEqual([12]);
    const x = transaccionXml(7, enlaces, 0, crearAvisos());
    expect(x.match(/<document>/g)).toHaveLength(1);
    expect(valido(x)).toBe(true);
  });

  it('el criterio estricto no une "12" con 12 y cuenta el aviso una sola vez', () => {
    const a = crearAvisos();
    const x = transaccionXml(8, enlaces, 0, a);
    transaccionXml(8, enlaces, 0, a);
    expect(x).toContain('<document found="false">');
    expect(contarAvisos(a).documentosNoEncontrados).toBe(1);
    expect(valido(x)).toBe(true);
  });

  it('una transacción inexistente citada dos veces cuenta 1', () => {
    const a = crearAvisos();
    const x = transaccionXml(99, enlaces, 0, a);
    transaccionXml('99.0', enlaces, 0, a);
    expect(x).toContain('<transaction found="false">');
    expect(contarAvisos(a).transaccionesNoEncontradas).toBe(1);
    expect(valido(x)).toBe(true);
  });

  it('una referencia vacía no emite nada; sin documentos sale <documents/>', () => {
    expect(transaccionXml('', enlaces, 0, crearAvisos())).toBe('');
    const e = construirEnlaces({ transacciones: [{ Num: 1 }], documentos: [] });
    const x = transaccionXml(1, e, 0, crearAvisos());
    expect(x).toContain('<documents/>');
    expect(valido(x)).toBe(true);
  });

  it('ignora entradas que no son objetos', () => {
    const e = construirEnlaces({
      transacciones: [null, 5, { Num: 1 }] as unknown as Record<string, unknown>[],
      documentos: [undefined] as unknown as Record<string, unknown>[],
    });
    expect(e.transacciones.size).toBe(1);
    expect(e.documentos.size).toBe(0);
  });
});
