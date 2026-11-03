import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SECCIONES } from '../utils/secciones';
import { NOMBRES_COLECCION, etiquetaCampo, nombreColeccion } from '../utils/etiquetas';

const RAIZ_SRC = join(__dirname, '..');

function archivosFuente(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) return nombre === '__tests__' ? [] : archivosFuente(ruta);
    return /\.(ts|tsx)$/.test(nombre) ? [ruta] : [];
  });
}

// Literales con mayúsculas innecesarias que ya no deben aparecer en la interfaz.
const LITERALES_ANTIGUOS = [
  'Manejo de Caja', 'Identificación de Indicadores', 'Índice de Compañías',
  'Todas las Compañías', 'Todas las Temporadas', 'Todas las Categorías', 'Todas las Ciudades',
  'Todos los Ámbitos', 'Todos los Años', 'Resultados de Búsqueda', 'Enlace Roto',
  'Confirmar Borrado', 'Confirmar Eliminación', 'Error de Integridad', 'Temporadas Teatrales',
  'Vínculos Rápidos', 'Detalle de Compañía', 'Detalles del Registro', 'Detalle de Transacción',
  'Información General', 'Documentos Asociados', 'Nuevo Registro', 'Editar Registro',
  'Asociar Documentos', 'Transacción Relacionada', 'Sigla Compañía (Obligatorio)',
  'Administración del Sistema', 'Gestión de Usuarios', 'Exportación y Respaldos',
  'Descargar Base de Datos', 'Correo Electrónico', 'Crear Usuario Lector', 'la Base de Datos solo',
  'por Correo/Contraseña', 'Compañias',
  '(No Editable)', 'Guardar Cambios', 'Índice Autogenerado', 'Compañía Principal', 'Crear Registro',
  'Correo electrónico (Lector)', 'Configurar Google Client ID',
];

describe('mayúsculas en títulos y etiquetas', () => {
  const archivos = archivosFuente(RAIZ_SRC);

  it('recorre archivos de src', () => {
    expect(archivos.length).toBeGreaterThan(20);
  });

  it.each(LITERALES_ANTIGUOS)('no queda el literal «%s» en src', (literal) => {
    const con = archivos.filter((f) => readFileSync(f, 'utf8').includes(literal));
    expect(con).toEqual([]);
  });

  it('SECCIONES incluye «Corpus Christi» y «Manejo de caja»', () => {
    const nombres = SECCIONES.map((s) => s.nombre);
    expect(nombres).toContain('Corpus Christi');
    expect(nombres).toContain('Manejo de caja');
  });

  it('nombreColeccion resuelve cada colección y devuelve el identificador si no la conoce', () => {
    expect(nombreColeccion('companias')).toBe('Compañías');
    expect(nombreColeccion('manejo_de_caja')).toBe('Manejo de caja');
    expect(nombreColeccion('salarios')).toBe('Remuneraciones');
    expect(nombreColeccion('corpus_christi')).toBe('Corpus Christi');
    expect(nombreColeccion('otra')).toBe('otra');
    expect(Object.keys(NOMBRES_COLECCION)).toHaveLength(8);
  });

  it('etiquetaCampo muestra «Nombre de la compañía» para la clave de Firestore', () => {
    expect(etiquetaCampo('Nombre Compañía')).toBe('Nombre de la compañía');
  });
});
