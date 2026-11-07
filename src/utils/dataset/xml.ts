import type { CampoDataset } from './campos';
import { CODIFICACION, NOMBRE_DATASET, VERSION_FORMATO, type Registro } from './tipos';

// Caracteres prohibidos en XML 1.0: controles (salvo tab, LF y CR), U+FFFE/U+FFFF y sustitutos sueltos.
function quitarProhibidos(texto: string): string {
  let salida = '';
  for (let i = 0; i < texto.length; i++) {
    const c = texto.charCodeAt(i);
    if (c < 0x20 && c !== 0x09 && c !== 0x0a && c !== 0x0d) continue;
    if (c === 0xfffe || c === 0xffff) continue;
    if (c >= 0xd800 && c <= 0xdbff) {
      const sig = texto.charCodeAt(i + 1);
      if (sig >= 0xdc00 && sig <= 0xdfff) {
        salida += texto[i] + texto[i + 1];
        i++;
      }
      continue;
    }
    if (c >= 0xdc00 && c <= 0xdfff) continue;
    salida += texto[i];
  }
  return salida;
}

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
  else if (typeof valor === 'number') {
    if (!Number.isFinite(valor)) return '';
    texto = String(valor);
  } else if (typeof valor === 'boolean') texto = String(valor);
  else return '';
  return quitarProhibidos(texto).normalize('NFC').replace(/[&<>"']/g, (c) => ESCAPES[c]);
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
