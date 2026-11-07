import { describe, it, expect } from 'vitest';
import { combinarAvisos, contarAvisos, crearAvisos } from '../../utils/dataset/tipos';

describe('combinarAvisos', () => {
  it('cuenta una vez la referencia repetida entre carpetas y suma los registros sin unidad', () => {
    const a = crearAvisos();
    a.transaccionesNoEncontradas.add('5');
    a.documentosNoEncontrados.add('number:9');
    a.registrosSinUnidad = 2;
    const b = crearAvisos();
    b.transaccionesNoEncontradas.add('5');
    b.transaccionesNoEncontradas.add('6');
    b.registrosSinUnidad = 1;
    expect(contarAvisos(combinarAvisos(a, b))).toEqual({
      transaccionesNoEncontradas: 2,
      documentosNoEncontrados: 1,
      registrosSinUnidad: 3,
    });
    expect(a.transaccionesNoEncontradas.size).toBe(1);
  });
});
