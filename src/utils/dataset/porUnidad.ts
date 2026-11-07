import {
  camposReferenciaCompania,
  canonizarReferencia,
  resolverCompania,
  siglaParaExportar,
  textoVisibleCompania,
} from '../referenciaCompania';
import { CAMPOS_DATASET, CAMPOS_ENCABEZADO_CORPUS } from './campos';
import { transaccionXml, type Enlaces } from './enlaces';
import { ordenarPorNumero } from './orden';
import { asignarNombresUnicos, sanearNombreArchivo } from './nombres';
import {
  CARPETAS,
  SIN_UNIDAD,
  crearAvisos,
  type ArchivoDataset,
  type DatosDataset,
  type Registro,
  type ResultadoCarpeta,
} from './tipos';
import { atributoXml, cabeceraXml, camposXml, CIERRE_XML, textoXml } from './xml';

const indicador = (r: Registro) => Number(r['Indicador de registro']);

/** Orden estable por `Indicador de registro` ascendente; los no numéricos quedan al final. */
export function ordenarPorIndicador<T extends Registro>(registros: readonly T[]): T[] {
  return ordenarPorNumero(registros, indicador);
}

const recortado = (v: unknown) => String(v ?? '').normalize('NFC').trim();

function elementoReferencia(sangria: number, nombre: string, etiqueta: string, valor: string): string {
  const margen = '  '.repeat(sangria);
  const texto = textoXml(valor);
  const atributos = `${atributoXml('found', 'false')}${atributoXml('label', etiqueta)}`;
  return texto === ''
    ? `${margen}<${nombre}${atributos}/>\n`
    : `${margen}<${nombre}${atributos}>${texto}</${nombre}>\n`;
}

interface Unidad {
  nombre: string;
  seccion: string;
  cuerpo: string;
  registros: number;
}

function nombrarArchivos(carpeta: ArchivoDataset['carpeta'], unidades: Unidad[], generadoEn: Date, encabezados: string[]): ArchivoDataset[] {
  const nombres = asignarNombresUnicos(unidades.map((u) => sanearNombreArchivo(u.nombre)));
  return unidades.map((u, i) => ({
    carpeta,
    nombre: nombres[i],
    unidad: u.nombre,
    registros: u.registros,
    contenido:
      cabeceraXml({ seccion: u.seccion, unidad: u.nombre, registros: u.registros, generadoEn }) +
      encabezados[i] +
      u.cuerpo +
      CIERRE_XML,
  }));
}

/** Un archivo XML por compañía para Manejo de caja o Remuneraciones. */
export function generarCarpetaCompania(
  carpeta: 'caja' | 'remuneraciones',
  datos: DatosDataset,
  enlaces: Enlaces,
  generadoEn: Date,
): ResultadoCarpeta {
  const esCaja = carpeta === 'caja';
  const registros = esCaja ? datos.manejo_de_caja : datos.salarios;
  const defs = esCaja ? CAMPOS_DATASET.manejo_de_caja : CAMPOS_DATASET.salarios;
  const [contenedor, elemento] = esCaja ? ['cash_managements', 'cash_management'] : ['salaries', 'salary'];
  const avisos = crearAvisos();

  const grupos = new Map<Registro, Registro[]>();
  const huerfanos: Registro[] = [];
  for (const r of registros) {
    const c = resolverCompania(r['Sigla Compañía'], datos.companias);
    if (!c) huerfanos.push(r);
    else {
      const l = grupos.get(c);
      if (l) l.push(r);
      else grupos.set(c, [r]);
    }
  }
  avisos.registrosSinUnidad = huerfanos.length;

  const cuerpoRegistros = (lista: Registro[], huerfano: boolean): string => {
    let s = `  <${contenedor}>\n`;
    for (const r of ordenarPorIndicador(lista)) {
      s += `    <${elemento}>\n` + camposXml(defs, r, 3);
      if (huerfano) {
        s += elementoReferencia(3, 'company_reference', 'Compañía', siglaParaExportar(r['Sigla Compañía'], datos.companias));
      }
      // Los avisos son conjuntos de referencias únicas: B5 unirá los conjuntos de todas las carpetas
      // (no suma tamaños), de modo que una misma referencia citada en varias carpetas no se infla.
      s += transaccionXml(r['Transacción'], enlaces, 3, avisos);
      s += `    </${elemento}>\n`;
    }
    return s + `  </${contenedor}>\n`;
  };

  const unidades: Unidad[] = [];
  const encabezados: string[] = [];
  let sinRegistros = 0;
  for (const c of ordenarPorIndicador(datos.companias)) {
    const lista = grupos.get(c);
    if (!lista) {
      sinRegistros += 1;
      continue;
    }
    unidades.push({ nombre: textoVisibleCompania(c), seccion: CARPETAS[carpeta], cuerpo: cuerpoRegistros(lista, false), registros: lista.length });
    encabezados.push('  <company>\n' + camposXml(CAMPOS_DATASET.companias, c, 2) + '  </company>\n');
  }
  if (huerfanos.length > 0) {
    unidades.push({ nombre: SIN_UNIDAD.companias, seccion: CARPETAS[carpeta], cuerpo: cuerpoRegistros(huerfanos, true), registros: huerfanos.length });
    encabezados.push('');
  }
  return { archivos: nombrarArchivos(carpeta, unidades, generadoEn, encabezados), avisos, unidadesSinRegistros: sinRegistros };
}

/** Un archivo XML por ciudad y año para Corpus Christi. */
export function generarCarpetaCorpus(datos: DatosDataset, enlaces: Enlaces, generadoEn: Date): ResultadoCarpeta {
  const avisos = crearAvisos();
  const grupos = new Map<string, { ciudad: string; anio: string; lista: Registro[] }>();
  const huerfanos: Registro[] = [];
  for (const r of datos.corpus_christi) {
    const ciudad = recortado(r['Ciudad']);
    const anio = recortado(r['Año']);
    if (ciudad === '' || anio === '') {
      huerfanos.push(r);
      continue;
    }
    const clave = `${ciudad}\u0000${anio}`;
    const g = grupos.get(clave) ?? { ciudad, anio, lista: [] };
    g.lista.push(r);
    grupos.set(clave, g);
  }
  avisos.registrosSinUnidad = huerfanos.length;

  const [defCodigo, defNombre] = CAMPOS_DATASET.companias;

  const companiasXml = (r: Registro): string => {
    const vistas = new Set<Registro>();
    const huerfanasVistas = new Set<string>();
    let s = '';
    for (const campo of camposReferenciaCompania('corpus_christi')) {
      const valor = r[campo];
      if (recortado(valor) === '') continue;
      const c = resolverCompania(valor, datos.companias);
      if (c) {
        if (vistas.has(c)) continue;
        vistas.add(c);
        // El nombre del archivo y <unit> usan textoVisibleCompania; company_code es el dato tal cual
        // (igual que el Índice de compañías).
        s += '        <company>\n' + camposXml([defCodigo, defNombre], c, 5) + '        </company>\n';
      } else {
        const texto = siglaParaExportar(valor, datos.companias);
        const canon = canonizarReferencia(valor);
        if (huerfanasVistas.has(canon)) continue;
        huerfanasVistas.add(canon);
        s += `        <company${atributoXml('found', 'false')}>\n` + camposXml([defCodigo], { 'Sigla Compañía': texto }, 5) + '        </company>\n';
      }
    }
    return s === '' ? '      <companies/>\n' : `      <companies>\n${s}      </companies>\n`;
  };

  const cuerpoRegistros = (lista: Registro[], huerfano: boolean): string => {
    let s = '  <corpus_christi_records>\n';
    for (const r of ordenarPorIndicador(lista)) {
      s += '    <corpus_christi_record>\n';
      if (huerfano) {
        s += camposXml(CAMPOS_ENCABEZADO_CORPUS, { Ciudad: recortado(r['Ciudad']), Año: recortado(r['Año']) }, 3);
      }
      s += camposXml(CAMPOS_DATASET.corpus_christi, r, 3) + companiasXml(r) + transaccionXml(r['Transacción'], enlaces, 3, avisos);
      s += '    </corpus_christi_record>\n';
    }
    return s + '  </corpus_christi_records>\n';
  };

  const ordenados = Array.from(grupos.values()).sort(
    (a, b) => a.ciudad.localeCompare(b.ciudad, 'es') || a.anio.localeCompare(b.anio, 'es', { numeric: true }),
  );
  const unidades: Unidad[] = [];
  const encabezados: string[] = [];
  for (const g of ordenados) {
    unidades.push({ nombre: `${g.ciudad}-${g.anio}`, seccion: CARPETAS.corpus, cuerpo: cuerpoRegistros(g.lista, false), registros: g.lista.length });
    encabezados.push(
      '  <city_year>\n' + camposXml(CAMPOS_ENCABEZADO_CORPUS, { Ciudad: g.ciudad, Año: g.anio }, 2) + '  </city_year>\n',
    );
  }
  if (huerfanos.length > 0) {
    unidades.push({ nombre: SIN_UNIDAD.corpus, seccion: CARPETAS.corpus, cuerpo: cuerpoRegistros(huerfanos, true), registros: huerfanos.length });
    encabezados.push('');
  }
  return { archivos: nombrarArchivos('corpus', unidades, generadoEn, encabezados), avisos, unidadesSinRegistros: 0 };
}
