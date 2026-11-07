import { describe, it, expect } from 'vitest';
import { CAMPOS_DOC, claveEstricta, idsDocumentos } from '../utils/documentosTransaccion';

describe('documentosTransaccion', () => {
  it('CAMPOS_DOC va de Doc1 a Doc10 en orden', () => {
    expect(CAMPOS_DOC).toEqual(['Doc1', 'Doc2', 'Doc3', 'Doc4', 'Doc5', 'Doc6', 'Doc7', 'Doc8', 'Doc9', 'Doc10']);
  });

  it('idsDocumentos respeta el orden Doc1..Doc10 y no el orden de las claves', () => {
    const tx = { Doc10: 'j', Doc2: 'b', Doc1: 'a', Doc3: 3 };
    expect(idsDocumentos(tx)).toEqual(['a', 'b', 3, 'j']);
  });

  it("idsDocumentos salta '', 0, null, undefined y objetos", () => {
    const tx = { Doc1: '', Doc2: 0, Doc3: null, Doc4: { a: 1 }, Doc5: undefined, Doc6: [1], Doc7: 5 };
    expect(idsDocumentos(tx)).toEqual([5]);
  });

  it('idsDocumentos no repite un mismo documento', () => {
    expect(idsDocumentos({ Doc1: 'x', Doc2: 'x', Doc3: 4, Doc4: 4 })).toEqual(['x', 4]);
  });

  it("12 y '12' son claves distintas", () => {
    expect(claveEstricta(12)).not.toBe(claveEstricta('12'));
    expect(idsDocumentos({ Doc1: 12, Doc2: '12' })).toEqual([12, '12']);
  });
});
