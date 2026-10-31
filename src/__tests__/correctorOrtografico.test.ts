import { describe, it, expect } from 'vitest';
import { propsCorrector, TEXTO_LIBRE, TEXTO_CODIGO } from '../utils/correctorOrtografico';

describe('propsCorrector', () => {
  it('campo de texto libre con texto: con corrector', () => {
    expect(propsCorrector('Noticia', 'Pago de la renta')).toBe(TEXTO_LIBRE);
  });
  it('sigla de compañía: sin corrector', () => {
    expect(propsCorrector('Sigla Compañía', 'GA-JR')).toBe(TEXTO_CODIGO);
  });
  it('referencias a documentos DocN: sin corrector', () => {
    expect(propsCorrector('Doc3', 1)).toBe(TEXTO_CODIGO);
  });
  it('valor numérico: sin corrector', () => {
    expect(propsCorrector('Año', 1600)).toBe(TEXTO_CODIGO);
  });
  it('año heredado como texto: con corrector', () => {
    expect(propsCorrector('Año', '1600')).toBe(TEXTO_LIBRE);
  });
  it('valor booleano: sin corrector', () => {
    expect(propsCorrector('Activo', true)).toBe(TEXTO_CODIGO);
  });
  it('null o undefined en campo libre: con corrector', () => {
    expect(propsCorrector('Noticia', null)).toBe(TEXTO_LIBRE);
    expect(propsCorrector('Noticia', undefined)).toBe(TEXTO_LIBRE);
    expect(propsCorrector('Noticia')).toBe(TEXTO_LIBRE);
  });
});
