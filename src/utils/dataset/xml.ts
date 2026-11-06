import type { CampoDataset } from './campos';
import { CODIFICACION, NOMBRE_DATASET, VERSION_FORMATO, type Registro } from './tipos';

// Caracteres prohibidos en XML 1.0 (controles, U+FFFE/U+FFFF) y sustitutos sueltos.
const PROHIBIDOS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

/** Convierte un valor en texto XML seguro: NFC, sin caracteres prohibidos y escapado. */
export function textoXml(valor: unknown): string {
  let texto: string;
  if (typeof valor === 'string') texto = valor;
  else if (typeof valor === 'number' || typeof valor === 'boolean') texto = String(valor);
  else return '';
  return texto.normalize('NFC').replace(PROHIBIDOS, '').replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

export function atributoXml(nombre: string, valor: string): string {
  return ` ${nombre}="${textoXml(valor)}"`;
}

export function campoXml(def: CampoDataset, valor: unknown, sangria: number): string {
  const margen = '  '.repeat(sangria);
  const texto = textoXml(valor);
  const etiqueta = atributoXml('label', def.etiqueta);
  if (texto === '') return `${margen}<${def.elemento}${etiqueta}/>\n`;
  return `${margen}<${def.elemento}${etiqueta}>${texto}</${def.elemento}>\n`;
}

export function camposXml(defs: readonly CampoDataset[], registro: Registro, sangria: number): string {
  return defs.map((def) => campoXml(def, registro[def.campo], sangria)).join('');
}

export function cabeceraXml(meta: { seccion: string; unidad: string; registros: number; generadoEn: Date }): string {
  const lineas: Array<[string, string]> = [
    ['dataset_name', NOMBRE_DATASET],
    ['format_version', VERSION_FORMATO],
    ['generated_at', meta.generadoEn.toISOString()],
    ['section', meta.seccion],
    ['unit', meta.unidad],
    ['record_count', String(meta.registros)],
    ['encoding', CODIFICACION],
  ];
  return (
    `<?xml version="1.0" encoding="${CODIFICACION}"?>\n<pretso_dataset>\n  <metadata>\n` +
    lineas.map(([el, v]) => `    <${el}>${textoXml(v)}</${el}>\n`).join('') +
    '  </metadata>\n'
  );
}

export const CIERRE_XML = '</pretso_dataset>\n';
