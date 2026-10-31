import { describe, it, expect } from 'vitest';
import {
  errorFormatoSigla, evaluarSigla, lineaParecido, introAvisoSigla, claveSigla, partesSigla,
  type CompaniaSigla,
} from '../utils/siglas';

const c = (id: string, sigla?: unknown): CompaniaSigla => (sigla === undefined ? { id } : { id, 'Sigla Compañía': sigla });

describe('formato de sigla', () => {
  it.each(['GA', 'JG-JeG', 'GA-AR-MR', 'A-B-C-D', 'Ñandú', 'TM-01', '  GA-JR  ', 'Ña'.normalize('NFD')])(
    'válida: %s', v => expect(errorFormatoSigla(v)).toBeNull());

  const vacia = 'Debe ingresar la sigla de la compañía.';
  const espacios = 'La sigla no puede contener espacios; una las partes con un guion (por ejemplo, GA-JR).';
  const extremos = 'La sigla no puede empezar ni terminar con un guion.';
  const doble = 'Una las partes de la sigla con un solo guion, no con varios seguidos.';
  const caracteres = 'La sigla solo admite letras y números, con las partes unidas por un guion (por ejemplo, GA-JR).';
  it.each<[unknown, string]>([
    ['', vacia], ['   ', vacia], [null, vacia], [undefined, vacia],
    ['GA JR', espacios], ['GA -JR', espacios],
    ['-GA', extremos], ['GA-', extremos], ['-', extremos],
    ['GA--JR', doble],
    ['GA–JR', caracteres], ['GA_JR', caracteres], ['G.A.', caracteres], ['GA/JR', caracteres],
  ])('inválida: %j', (v, msg) => expect(errorFormatoSigla(v)).toBe(msg));
});

describe('partes y clave', () => {
  it('normaliza sin tildes ni mayúsculas', () => {
    expect(partesSigla(' GÁ-JR ')).toEqual(['ga', 'jr']);
    expect(claveSigla('GA - JR')).toBe('ga-jr');
  });
});

describe('duplicados', () => {
  const lista = [c('a', 'GA-JR')];
  it.each(['ga-jr', ' GA-JR ', 'GÁ-JR'])('%j es duplicada', v => {
    const r = evaluarSigla(v, lista);
    expect(r).toEqual({
      estado: 'error', motivo: 'duplicada',
      mensaje: 'Ya existe una compañía con la sigla «GA-JR». Use una sigla distinta.',
      conflicto: { id: 'a', sigla: 'GA-JR' },
    });
  });
  it('sigla antigua con espacios', () => {
    const r = evaluarSigla('GA-JR', [c('a', 'GA - JR')]);
    expect(r).toMatchObject({ estado: 'error', motivo: 'duplicada' });
    if (r.estado === 'error' && r.motivo === 'duplicada') expect(r.mensaje).toContain('«GA - JR»');
  });
  it('idPropio igual -> ok', () => expect(evaluarSigla('GA-JR', lista, 'a')).toEqual({ estado: 'ok' }));
  it('idPropio null o ausente incluye a todas', () => {
    expect(evaluarSigla('GA-JR', lista, null).estado).toBe('error');
    expect(evaluarSigla('GA-JR', lista).estado).toBe('error');
  });
  it('formato inválido', () => {
    expect(evaluarSigla('GA--JR', lista)).toMatchObject({ estado: 'error', motivo: 'formato' });
  });
});

describe('parecidos', () => {
  const tipos = (r: ReturnType<typeof evaluarSigla>) =>
    r.estado === 'aviso' ? r.parecidos.map(p => `${p.sigla}:${p.tipo}`) : r.estado;
  it('GA frente a GA-JR y GA-AR-MR', () => {
    const r = evaluarSigla('GA', [c('2', 'GA-AR-MR'), c('1', 'GA-JR')]);
    expect(tipos(r)).toEqual(['GA-AR-MR:contenida', 'GA-JR:contenida']);
  });
  it('GA-AR-MR frente a GA y AR', () => {
    expect(tipos(evaluarSigla('GA-AR-MR', [c('1', 'GA'), c('2', 'AR')]))).toEqual(['AR:contiene', 'GA:contiene']);
  });
  it('reordenada', () => expect(tipos(evaluarSigla('JR-GA', [c('1', 'GA-JR')]))).toEqual(['GA-JR:reordenada']));
  it('GA-MR en GA-AR-MR', () => expect(tipos(evaluarSigla('GA-MR', [c('1', 'GA-AR-MR')]))).toEqual(['GA-AR-MR:contenida']));
  it('sin aviso', () => {
    expect(evaluarSigla('GA', [c('1', 'GAR')])).toEqual({ estado: 'ok' });
    expect(evaluarSigla('GA-JR', [c('1', 'GA-AR')])).toEqual({ estado: 'ok' });
  });
  it('el duplicado gana al parecido', () => {
    expect(evaluarSigla('GA', [c('1', 'GA-JR'), c('2', 'GA')]).estado).toBe('error');
  });
  it('ignora sigla vacía o ausente', () => {
    expect(evaluarSigla('GA', [c('1', ''), c('2'), c('3', '  '), c('4', null)])).toEqual({ estado: 'ok' });
  });
  it('desempata por id', () => {
    const r = evaluarSigla('GA', [c('b', 'GA-JR'), c('a', 'GA-JR')]); // siglas repetidas en datos antiguos
    expect(r.estado === 'aviso' && r.parecidos.map(p => p.id)).toEqual(['a', 'b']);
  });
});

describe('datos reales', () => {
  const reales = ['JG', 'JG-JeG', 'GA', 'GA-JR', 'GA-AR-MR', 'AR'].map((s, i) => c(`r${i}`, s));
  it.each(reales)('$id nunca da error contra las demás', comp => {
    expect(evaluarSigla(comp['Sigla Compañía'], reales, comp.id).estado).not.toBe('error');
  });
});

describe('textos', () => {
  it('línea de parecido', () => {
    expect(lineaParecido({ id: '1', sigla: 'GA-JR', tipo: 'contenida' })).toBe('Está contenida en «GA-JR».');
    expect(lineaParecido({ id: '1', sigla: 'GA', tipo: 'contiene' })).toBe('Contiene a «GA».');
    expect(lineaParecido({ id: '1', sigla: 'GA-JR', tipo: 'reordenada' })).toBe('Tiene las mismas partes que «GA-JR», en otro orden.');
  });
  it('introducción', () => {
    expect(introAvisoSigla('GA', 1)).toBe('La sigla «GA» se parece a la de otra compañía ya registrada:');
    expect(introAvisoSigla('GA', 2)).toBe('La sigla «GA» se parece a la de otras compañías ya registradas:');
  });
});
