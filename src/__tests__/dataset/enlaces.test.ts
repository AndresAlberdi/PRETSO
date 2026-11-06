import { describe, it, expect } from 'vitest';
import { construirEnlaces, idsDocumentos, transaccionXml } from '../../utils/dataset/enlaces';
import type { AvisosDataset } from '../../utils/dataset/tipos';

const avisos = (): AvisosDataset => ({ transaccionesNoEncontradas: 0, documentosNoEncontrados: 0, registrosSinUnidad: 0 });
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
    const a = avisos();
    const x = transaccionXml('7.0', enlaces, 1, a);
    expect(x).toContain('<transaction_number label="Nro. de transacción">7</transaction_number>');
    expect(x).toContain('Pago &amp; cobro');
    expect(a.transaccionesNoEncontradas).toBe(0);
    expect(valido(x)).toBe(true);
  });

  it('Doc1 = Doc2 sale una vez; 0 y vacío se ignoran', () => {
    expect(idsDocumentos(enlaces.transacciones.get('7') as Record<string, unknown>)).toEqual([12]);
    const x = transaccionXml(7, enlaces, 0, avisos());
    expect(x.match(/<document>/g)).toHaveLength(1);
  });

  it('el criterio estricto no une "12" con 12 y suma un aviso', () => {
    const a = avisos();
    const x = transaccionXml(8, enlaces, 0, a);
    expect(x).toContain('<document found="false">');
    expect(a.documentosNoEncontrados).toBe(1);
    expect(valido(x)).toBe(true);
  });

  it('una transacción inexistente sale con found="false" y suma un aviso', () => {
    const a = avisos();
    const x = transaccionXml(99, enlaces, 0, a);
    expect(x).toContain('<transaction found="false">');
    expect(a.transaccionesNoEncontradas).toBe(1);
  });

  it('una referencia vacía no emite nada; sin documentos sale <documents/>', () => {
    expect(transaccionXml('', enlaces, 0, avisos())).toBe('');
    const e = construirEnlaces({ transacciones: [{ Num: 1 }], documentos: [] });
    expect(transaccionXml(1, e, 0, avisos())).toContain('<documents/>');
  });
});
