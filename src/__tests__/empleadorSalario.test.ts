import { describe, it, expect } from 'vitest';
import { agruparEmpleadoresOtro, claveEmpleadorOtro, esEmpleadorOtro, textoManual, validarEmpleadorOtro } from '../utils/empleadorSalario';

describe('esEmpleadorOtro', () => {
  it.each([null, '', undefined, 'None'])('es otro con la sigla %s y nombre', (sigla) => {
    expect(esEmpleadorOtro({ 'Sigla Compañía': sigla, Empleador: 'Juan' })).toBe(true);
  });
  it('gana la compañía si hay sigla', () => {
    expect(esEmpleadorOtro({ 'Sigla Compañía': 7, Empleador: 'Juan' })).toBe(false);
  });
  it('sin nombre no es otro', () => {
    expect(esEmpleadorOtro({ 'Sigla Compañía': null, Empleador: '  ' })).toBe(false);
  });
});

describe('textoManual', () => {
  it('colapsa espacios y rechaza tipos raros', () => {
    expect(textoManual('  Juan   Pérez ')).toBe('Juan Pérez');
    expect(textoManual(1600)).toBe('1600');
    expect(textoManual({})).toBe('');
  });
});

describe('claveEmpleadorOtro', () => {
  it('normaliza tildes, mayúsculas y espacios', () => {
    const a = { Empleador: 'Juan  Pérez', 'Temporadas teatrales': '1615-1616', 'Ámbito': 'Madrid' };
    const b = { Empleador: 'juan perez', 'Temporadas teatrales': '1615-1616 ', 'Ámbito': 'MADRID' };
    expect(claveEmpleadorOtro(a)).toBe(claveEmpleadorOtro(b));
  });
  it('un «|» en el nombre no choca con otro triple', () => {
    const a = { Empleador: 'a|b', 'Temporadas teatrales': 'c', 'Ámbito': 'd' };
    const b = { Empleador: 'a', 'Temporadas teatrales': 'b|c', 'Ámbito': 'd' };
    expect(claveEmpleadorOtro(a)).not.toBe(claveEmpleadorOtro(b));
  });
});

describe('agruparEmpleadoresOtro', () => {
  const base = { 'Sigla Compañía': null, Empleador: 'Juan', 'Temporadas teatrales': '1615', 'Ámbito': 'España' };
  it('iguales normalizados forman un grupo y el texto es del menor indicador', () => {
    const g = agruparEmpleadoresOtro([
      { ...base, 'Indicador de registro': 5, Empleador: 'JUAN' },
      { ...base, 'Indicador de registro': 2, Empleador: 'Juan' },
    ]);
    expect(g).toHaveLength(1);
    expect(g[0].nombre).toBe('Juan');
    expect(g[0].registros).toHaveLength(2);
  });
  it('cambia el ámbito: dos grupos, ordenados', () => {
    const g = agruparEmpleadoresOtro([
      { ...base, 'Indicador de registro': 1, 'Ámbito': 'Perú' },
      { ...base, 'Indicador de registro': 2 },
      { ...base, 'Indicador de registro': 3, 'Sigla Compañía': 7 },
    ]);
    expect(g.map((x) => x.ambito)).toEqual(['España', 'Perú']);
  });
});

describe('validarEmpleadorOtro', () => {
  const ok = { Empleador: 'Juan', 'Temporadas teatrales': '1615', 'Ámbito': 'desconocido' };
  it('devuelve el primer error con el mensaje literal', () => {
    expect(validarEmpleadorOtro({ ...ok, Empleador: ' ' })).toEqual({ campo: 'Empleador', mensaje: 'Debe escribir el nombre del empleador.' });
    expect(validarEmpleadorOtro({ ...ok, 'Temporadas teatrales': '' })?.mensaje).toBe('Debe escribir las temporadas teatrales.');
    expect(validarEmpleadorOtro({ ...ok, 'Ámbito': '' })?.mensaje).toBe('Debe escribir el ámbito; si no se conoce, escriba «desconocido».');
  });
  it('«desconocido» es válido', () => {
    expect(validarEmpleadorOtro(ok)).toBeNull();
  });
});
