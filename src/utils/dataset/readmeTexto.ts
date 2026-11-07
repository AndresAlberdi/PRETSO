/**
 * Textos editables del README del dataset. Sin lógica: Laura puede ajustar
 * cualquier constante sin tocar el generador (`readme.ts`).
 */
import { CODIFICACION, NOMBRE_DATASET, VERSION_FORMATO } from './tipos';

export const TITULO = '# PRETSO — Precios del Teatro del Siglo de Oro: dataset';

export const ACERCA_DEL_PROYECTO =
  'Datos económicos del teatro del Siglo de Oro recopilados por el proyecto PRETSO. (Texto provisional: el definitivo lo enviará Laura.)';

export const CODIFICACION_TEXTO =
  'Todos los archivos están en UTF-8 (sin BOM), con saltos de línea LF. Los XML declaran `<?xml version="1.0" encoding="UTF-8"?>`. ' +
  'Ábralos con un navegador, un editor de texto (VS Code, Notepad++, Bloc de notas de Windows 10 o posterior) o importándolos en una hoja de cálculo como XML. ' +
  'Si al descomprimir ve caracteres extraños en los nombres de carpeta (Í, ñ), use 7-Zip o el descompresor de su sistema actualizado.';

/** Descripción de cada carpeta; `{n}` y `{m}` no se usan: los conteos los agrega el generador. */
export const DESCRIPCION_CARPETAS = {
  caja: 'un XML por compañía con registros de caja.',
  remuneraciones: 'un XML por compañía (trato).',
  corpus: 'un XML por ciudad y año (trato), llamado `Ciudad-Año.xml`.',
  companias: 'un XML con todas las compañías.',
  transacciones: 'un XML con cada transacción y, anidados, sus documentos con el texto completo.',
  bibliografia: 'un XML con las referencias bibliográficas.',
} as const;

export const NOTA_SIN_ARCHIVO_PROPIO = 'No tienen archivo propio; figuran en el Índice de compañías.';

export const ESQUEMA_COMUN =
  'Raíz `<pretso_dataset>`; primero `<metadata>` (dataset_name, format_version, generated_at, section, unit, record_count, encoding). ' +
  'Cada campo lleva el atributo `label` con su nombre en español. Un campo vacío aparece como elemento vacío.';

export const RELACIONES =
  'Cada registro trae anidada su transacción (`<transaction>`: número, noticia, fuentes) y el texto completo de sus documentos (`<document>`: código y texto). ' +
  'Un mismo documento se repite en cada registro que lo cita, para que cada archivo se lea solo. Las compañías se identifican por su sigla.';

export const QUE_NO_INCLUYE =
  'Identificación de indicadores (por ahora), datos de usuarios, bitácora de cambios, identificadores internos de la base de datos y campos retirados por la investigación.';

export const COMO_CITAR = '(Pendiente: lo define la Universidad o Laura.)';

export const LICENCIA = '(Pendiente: la define la Universidad o Laura.)';

const XML_ABRE = '<?xml version="1.0" encoding="UTF-8"?>\n<pretso_dataset>';

const METADATA = (seccion: string, unidad: string): string =>
  [
    '  <metadata>',
    `    <dataset_name>${NOMBRE_DATASET}</dataset_name>`,
    `    <format_version>${VERSION_FORMATO}</format_version>`,
    '    <generated_at>2026-11-06T12:00:00.000Z</generated_at>',
    `    <section>${seccion}</section>`,
    `    <unit>${unidad}</unit>`,
    '    <record_count>1</record_count>',
    `    <encoding>${CODIFICACION}</encoding>`,
    '  </metadata>',
  ].join('\n');

const TRANSACCION_ANIDADA = [
  '      <transaction>',
  '        <transaction_number label="Nro. de transacción">45</transaction_number>',
  '        <transaction_news label="Noticia">…</transaction_news>',
  '        <sources label="Fuentes para la generación del dato">…</sources>',
  '        <documents>',
  '          <document>',
  '            <doc_id label="Código del documento">101</doc_id>',
  '            <document_text label="Texto del documento">…texto completo…</document_text>',
  '          </document>',
  '          <document found="false">',
  '            <doc_id label="Código del documento">102</doc_id>',
  '          </document>',
  '        </documents>',
  '      </transaction>',
].join('\n');

/** Ejemplo de esquema para cada carpeta (se imprime en bloques de código). */
export function ejemploCaja(nombreCarpeta: string): string {
  return [
    XML_ABRE,
    METADATA(nombreCarpeta, 'GA-AR'),
    '  <company>',
    '    <company_code label="Sigla">GA-AR</company_code>',
    '    <company_name label="Nombre de la compañía">…</company_name>',
    '    <authors label="Autores">…</authors>',
    '    <theatrical_seasons label="Temporadas teatrales">1615-1616</theatrical_seasons>',
    '    <company_index label="Índice de compañías">…</company_index>',
    '    <scope label="Ámbito">…</scope>',
    '  </company>',
    '  <cash_managements>',
    '    <cash_management>',
    '      <year label="Año">1615</year>',
    '      <city label="Ciudad">Madrid</city>',
    '      <income label="Ingresos">300 reales</income>',
    '      <expenses label="Egresos"/>',
    '      <other_company_assets label="Otros bienes de la compañía"/>',
    TRANSACCION_ANIDADA,
    '    </cash_management>',
    '  </cash_managements>',
    '</pretso_dataset>',
  ].join('\n');
}

export const NOTA_REMUNERACIONES =
  'Igual que Manejo de caja, con `<salaries><salary>` y los campos year, city, beneficiary, role, amount_paid, daily_allowance, performance_pay, más `<transaction>`.';

export const EJEMPLO_CORPUS = [
  '  <city_year>',
  '    <city label="Ciudad">Madrid</city>',
  '    <year label="Año">1615</year>',
  '  </city_year>',
  '  <corpus_christi_records>',
  '    <corpus_christi_record>',
  '      <task label="Encargo">…</task>',
  '      <person_in_charge label="Encargado">…</person_in_charge>',
  '      <amount_paid label="Monto a pagar">…</amount_paid>',
  '      <funds label="Fondos">…</funds>',
  '      <companies>',
  '        <company>',
  '          <company_code label="Sigla">GA-AR</company_code>',
  '          <company_name label="Nombre de la compañía">…</company_name>',
  '        </company>',
  '        <company found="false">',
  '          <company_code label="Sigla">Compañía no encontrada</company_code>',
  '        </company>',
  '      </companies>',
  '      <transaction>…</transaction>',
  '    </corpus_christi_record>',
  '  </corpus_christi_records>',
].join('\n');

export const NOTA_COMPANIAS = '`<companies><company>` con los seis campos de la compañía (sigla, nombre, autores, temporadas teatrales, índice de compañías y ámbito).';

export const NOTA_TRANSACCIONES = '`<transactions><transaction>`, igual a la transacción anidada de los ejemplos anteriores.';

export const EJEMPLO_BIBLIOGRAFIA = [
  '  <bibliographies>',
  '    <bibliography>',
  '      <authors label="Autores">…</authors>',
  '      <bibliographical_references label="Referencias bibliográficas">…</bibliographical_references>',
  '    </bibliography>',
  '  </bibliographies>',
].join('\n');
