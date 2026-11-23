/**
 * Texto del README del dataset (README.pdf), tal como lo redactó Laura Paz Rescala.
 * Sin lógica de maquetación: `readme.ts` convierte estos bloques en el PDF.
 * Las frases que cambian en cada descarga (fecha, cifras y avisos) son funciones del resumen.
 */
import { CARPETAS, type ClaveCarpeta, type ResumenDataset } from './tipos';

export type Bloque =
  | { tipo: 'titulo'; texto: string }
  | { tipo: 'subtitulo'; texto: string }
  | { tipo: 'h1'; texto: string }
  | { tipo: 'h2'; texto: string }
  | { tipo: 'p'; texto: string }
  | { tipo: 'enlace'; texto: string; url: string }
  | { tipo: 'lista'; items: string[] }
  | { tipo: 'tabla'; encabezado: string[]; filas: string[][]; anchos: Array<string | number> };

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

const dos = (n: number): string => String(n).padStart(2, '0');

/** «22 de noviembre de 2026» (UTC, sin depender de Intl). */
export function fechaDia(d: Date): string {
  return `${d.getUTCDate()} de ${MESES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
}

/** «22 de noviembre de 2026, a las 23:50 UTC» (UTC, sin depender de Intl). */
export function fechaLarga(d: Date): string {
  return `${fechaDia(d)}, a las ${dos(d.getUTCHours())}:${dos(d.getUTCMinutes())} UTC`;
}

const ORDEN = Object.keys(CARPETAS) as ClaveCarpeta[];

function filasExportacion(resumen: ResumenDataset): string[][] {
  const porClave = new Map(resumen.carpetas.map((c) => [c.carpeta, c]));
  return ORDEN.map((clave) => {
    const c = porClave.get(clave);
    return [CARPETAS[clave], String(c?.archivos ?? 0), String(c?.registros ?? 0)];
  });
}

/** Frase sobre las compañías del índice sin archivo propio, con cifras en dígitos y concordancia. */
export function fraseCompaniasSinArchivo(sinCaja: number, sinRemu: number): string {
  if (sinCaja === 0 && sinRemu === 0) {
    return 'Todas las compañías del índice tienen registros de caja y de remuneraciones, por lo que cada una cuenta con un archivo propio en las carpetas respectivas.';
  }
  const compania = (n: number): string => (n === 1 ? '1 compañía' : `${n} compañías`);
  const no = (n: number): string => (n === 1 ? 'no tiene' : 'no tienen');
  const caja = sinCaja === 0
    ? 'Todas las compañías del índice tienen registros de caja'
    : `${compania(sinCaja)} del índice ${no(sinCaja)} registros de caja`;
  const remu = sinRemu === 0
    ? 'todas tienen registros de remuneraciones'
    : `${sinCaja === 0 ? compania(sinRemu) : String(sinRemu)} ${no(sinRemu)} registros de remuneraciones`;
  const final = sinCaja + sinRemu === 1
    ? 'por ese motivo, no cuenta con un archivo propio en la carpeta respectiva.'
    : sinCaja > 0 && sinRemu > 0
      ? 'por ese motivo, no cuentan con un archivo propio en las carpetas respectivas.'
      : 'por ese motivo, no cuentan con un archivo propio en la carpeta respectiva.';
  return `${caja} y ${remu}; ${final}`;
}

/** Frase de la sección 7 con los avisos de la exportación (cifras en dígitos). */
export function fraseAvisos(resumen: ResumenDataset): string {
  const a = resumen.avisos;
  const t = a.transaccionesNoEncontradas;
  const d = a.documentosNoEncontrados;
  const r = a.registrosSinUnidad;
  const transacciones = t === 1 ? '1 transacción citada y no encontrada' : `${t} transacciones citadas y no encontradas`;
  const documentos = d === 1 ? '1 documento citado y no encontrado' : `${d} documentos citados y no encontrados`;
  const registros = r === 1 ? '1 registro sin compañía o sin ciudad y año' : `${r} registros sin compañía o sin ciudad y año`;
  return `En la exportación del ${fechaDia(resumen.generadoEn)} se indican ${transacciones}, ${documentos}, y ${registros}.`;
}

export function bloquesReadme(resumen: ResumenDataset): Bloque[] {
  const porClave = new Map(resumen.carpetas.map((c) => [c.carpeta, c]));
  const sinCaja = porClave.get('caja')?.unidadesSinRegistros ?? 0;
  const sinRemu = porClave.get('remuneraciones')?.unidadesSinRegistros ?? 0;
  return [
    { tipo: 'titulo', texto: 'Readme' },
    { tipo: 'subtitulo', texto: 'Dataset de la base de datos PRETSO. Precios del Teatro del Siglo de Oro.' },

    { tipo: 'h1', texto: '1. ¿Qué es PRETSO?' },
    { tipo: 'p', texto: 'PRETSO. Precios del Teatro del Siglo de Oro es una base de datos dedicada al estudio de la actividad económica y las relaciones laborales del teatro profesional hispánico durante la temprana Edad Moderna, principalmente entre la segunda mitad del siglo XVI y las primeras décadas del siglo XVII.' },
    { tipo: 'p', texto: 'PRETSO tiene como objetivo reunir, organizar y facilitar la consulta de información histórica. Entre otros aspectos, permite estudiar los ingresos y egresos de las compañías, las remuneraciones de los trabajadores teatrales, los encargos de representaciones para las fiestas del Corpus Christi y otros indicadores económicos del mercado teatral.' },
    { tipo: 'p', texto: 'La información procede de fuentes históricas, principalmente documentales, que permiten reconstruir diferentes aspectos de la actividad teatral en la España peninsular y en los virreinatos americanos. PRETSO no constituye un registro exhaustivo de la actividad teatral del período estudiado. Es una herramienta de investigación en desarrollo, cuyo contenido depende de las noticias históricas localizadas, examinadas e incorporadas a la base de datos.' },
    { tipo: 'p', texto: 'Este dataset ofrece una exportación de los datos registrados en PRETSO en archivos XML. A diferencia de la base de datos en línea, que dispone de una interfaz de búsqueda y consulta, el dataset permite examinar los registros como archivos estructurados, conservar una copia de la información exportada y trabajar con ella mediante otras herramientas. La organización de los archivos responde a las características de esta exportación y no reproduce exactamente la estructura de navegación de la base de datos.' },

    { tipo: 'h1', texto: '2. Cómo acceder al dataset y abrir los archivos' },
    { tipo: 'p', texto: 'El dataset se distribuye como un conjunto de carpetas que contienen archivos XML. El dataset se exporta directamente desde la base de datos en línea y cada descarga genera nuevamente los archivos a partir de la información disponible en ese momento.' },
    { tipo: 'p', texto: 'Todos los archivos utilizan codificación UTF-8 sin marca de orden de bytes (BOM) y saltos de línea LF. Los XML incluyen una declaración de codificación UTF-8. Pueden abrirse con un navegador web o un editor de texto, como VS Code, Notepad++ o el Bloc de notas de Windows 10 o posterior. También pueden importarse a herramientas de procesamiento de datos compatibles con XML, aunque la visualización de los elementos anidados dependerá de cada programa.' },
    { tipo: 'p', texto: 'Si al descomprimir los archivos aparecen caracteres extraños en los nombres de las carpetas que contienen tildes o la letra ‘ñ’, se recomienda utilizar un descompresor actualizado, como 7-Zip.' },

    { tipo: 'h1', texto: '3. Organización del dataset' },
    { tipo: 'p', texto: 'El dataset está organizado en seis carpetas:' },
    {
      tipo: 'lista',
      items: [
        'Manejo de caja: un archivo XML por compañía teatral con registros de caja. El título de cada archivo es la sigla de la compañía teatral.',
        'Remuneraciones: un archivo XML por empleador, que puede ser una compañía teatral u otro tipo de empleador. El título de cada archivo es la sigla de la compañía, si el empleador es una compañía, u «otro - nombre del empleador - temporadas» si el empleador no es una compañía.',
        'Corpus Christi: un archivo XML por ciudad y año. El título de cada archivo indica la ciudad y el año en cuestión.',
        'Índice de compañías: un archivo XML que reúne la información general de todas las compañías registradas.',
        'Lista de transacciones: un archivo XML que reúne las transacciones y los documentos asociados a ellas.',
        'Bibliografía: un archivo XML con las referencias bibliográficas registradas.',
      ],
    },
    { tipo: 'p', texto: `En la exportación generada el ${fechaLarga(resumen.generadoEn)}, el contenido es el siguiente:` },
    { tipo: 'tabla', encabezado: ['Carpeta', 'Archivos XML', 'Registros'], filas: filasExportacion(resumen), anchos: ['*', 'auto', 'auto'] },
    { tipo: 'p', texto: `Estas cifras corresponden a la exportación indicada. ${fraseCompaniasSinArchivo(sinCaja, sinRemu)}` },

    { tipo: 'h2', texto: '3.1. Manejo de caja' },
    { tipo: 'p', texto: 'Esta carpeta reúne información sobre los movimientos registrados en las cajas de diferentes compañías teatrales. La caja constituye un elemento central de la administración económica de las compañías, pues permite estudiar la circulación de dinero y otros bienes vinculados a su funcionamiento.' },
    { tipo: 'p', texto: 'Cada archivo corresponde a una compañía y contiene su sigla, nombre, autores, temporadas teatrales, índice de compañías y ámbito de actividad. Los registros se encuentran dentro de los elementos <cash_managements> y <cash_management>. Cada movimiento puede incluir año, ciudad, ingresos, egresos y otros bienes de la compañía, además de la transacción histórica de la que procede el dato.' },
    { tipo: 'p', texto: 'Los movimientos registrados corresponden a la información identificada en las fuentes históricas y no deben interpretarse necesariamente como una reconstrucción completa de la contabilidad de cada compañía.' },

    { tipo: 'h2', texto: '3.2. Remuneraciones' },
    { tipo: 'p', texto: 'Esta carpeta reúne noticias históricas sobre acuerdos de remuneración de personas vinculadas al trabajo teatral. Permite examinar las ocupaciones por las que se contrataba a estas personas y las condiciones económicas de los acuerdos registrados.' },
    { tipo: 'p', texto: 'Los archivos se organizan por empleador. Cuando el empleador es una compañía, el encabezado <employer> identifica su sigla y sus autores. Cuando no es una compañía, el campo company_or_other contiene el valor «otro» y employers identifica al empleador. Los archivos correspondientes a estos últimos comienzan por «otro - nombre del empleador - temporadas»; cada combinación del mismo nombre, temporadas y ámbito se conserva en su propio archivo. Las temporadas y el ámbito pueden figurar como «desconocido».' },
    { tipo: 'p', texto: 'Los acuerdos se encuentran dentro de <salaries> y <salary>. Los campos permiten identificar el año, la ciudad, el beneficiario, la ocupación, el monto pagado, la ración diaria y el pago por representación, junto con la transacción de origen. Los registros permiten identificar diferentes modalidades de remuneración y condiciones de contratación, sin constituir necesariamente una lista completa de los trabajadores de cada compañía.' },

    { tipo: 'h2', texto: '3.3. Corpus Christi' },
    { tipo: 'p', texto: 'Esta carpeta reúne información sobre encargos y pagos relacionados con la representación de obras teatrales durante las fiestas del Corpus Christi. Los archivos se organizan por ciudad y año, siguiendo el formato Ciudad-Año.xml.' },
    { tipo: 'p', texto: 'Cada archivo identifica la ciudad y el año en <city_year>. Los registros se encuentran dentro de <corpus_christi_records> y <corpus_christi_record>, con información sobre el encargo, el encargado, el monto a pagar, los fondos, las compañías relacionadas y la transacción histórica correspondiente.' },
    { tipo: 'p', texto: 'Cuando no se encuentra una compañía relacionada, puede aparecer un elemento <company found="false"> con la indicación «Compañía no encontrada». Esta marca no equivale a afirmar que la compañía histórica no existiera, sino que no se ha encontrado la correspondencia en los datos exportados.' },

    { tipo: 'h2', texto: '3.4. Índice de compañías' },
    { tipo: 'p', texto: 'Esta carpeta contiene un único archivo XML con las compañías teatrales registradas en PRETSO. Cada elemento <company>, dentro de <companies>, reúne la sigla, el nombre, los autores, las temporadas teatrales, el índice de compañías y el ámbito de actividad.' },
    { tipo: 'p', texto: 'La sigla permite identificar una compañía y relacionar su información con los registros de otras carpetas. Una compañía puede figurar en este índice aunque no tenga movimientos de caja o acuerdos de remuneración en la exportación.' },

    { tipo: 'h2', texto: '3.5. Lista de transacciones' },
    { tipo: 'p', texto: 'Esta carpeta contiene un archivo XML con las transacciones registradas en la exportación. Las transacciones constituyen la unidad fundamental a partir de la cual se organiza la información histórica en PRETSO.' },
    { tipo: 'p', texto: 'Cada elemento <transaction>, dentro de <transactions>, reúne el número de transacción, una noticia histórica, las referencias de las fuentes utilizadas y los documentos asociados. Los documentos se identifican mediante un código y, cuando está disponible, incluyen el texto completo.' },
    { tipo: 'p', texto: 'Esta carpeta permite consultar las transacciones reunidas en un solo archivo, sin tener que recorrer las carpetas temáticas. Las transacciones también aparecen anidadas en los registros de Manejo de caja, Remuneraciones y Corpus Christi.' },

    { tipo: 'h2', texto: '3.6. Bibliografía' },
    { tipo: 'p', texto: 'Esta carpeta contiene un archivo XML con las referencias bibliográficas registradas en PRETSO. Cada elemento <bibliography>, dentro de <bibliographies>, incluye los campos authors y bibliographical_references.' },
    { tipo: 'p', texto: 'La bibliografía facilita la identificación de las publicaciones utilizadas en el proceso de investigación y registro de la información histórica.' },

    { tipo: 'h1', texto: '4. Las transacciones y las relaciones entre los archivos' },
    { tipo: 'p', texto: 'Cada transacción reúne una noticia histórica, las referencias de las fuentes utilizadas y los documentos asociados. Una misma transacción puede proporcionar información relevante para diferentes aspectos de la actividad económica teatral. Por ejemplo, un acuerdo de contratación puede contener información sobre remuneraciones y, al mismo tiempo, sobre obligaciones económicas de una compañía.' },
    { tipo: 'p', texto: 'Para facilitar la lectura independiente de los archivos, los registros de las carpetas temáticas incluyen su transacción y los documentos asociados, con el texto completo. Por ello, una misma transacción o un mismo documento pueden repetirse en diferentes archivos. Esta redundancia es deliberada: no indica necesariamente la existencia de transacciones o documentos históricos distintos.' },
    { tipo: 'p', texto: 'Las relaciones principales se establecen mediante tres identificadores:' },
    {
      tipo: 'lista',
      items: [
        'Número de transacción: permite vincular los registros temáticos con su noticia histórica y sus fuentes.',
        'Código de documento: identifica los documentos asociados a una transacción.',
        'Sigla de compañía: permite relacionar los datos de una compañía en las distintas carpetas y en el Índice de compañías.',
      ],
    },
    { tipo: 'p', texto: 'Al analizar conjuntamente varios archivos, conviene tener en cuenta estas relaciones para no contar varias veces una misma transacción o un mismo documento.' },

    { tipo: 'h1', texto: '5. Estructura de los archivos XML' },
    { tipo: 'p', texto: 'Todos los archivos tienen como elemento raíz <pretso_dataset> y comienzan con un bloque <metadata> que identifica el dataset, la versión del formato, la fecha de generación, la sección, la unidad de exportación, el número de registros y la codificación.' },
    { tipo: 'p', texto: 'Los campos de los registros incorporan un atributo label con su denominación en español. Cuando un campo no tiene contenido, se representa mediante un elemento vacío, por ejemplo <expenses/>. Este elemento no debe interpretarse automáticamente como un valor numérico igual a cero.' },
    { tipo: 'p', texto: 'Las estructuras principales son las siguientes:' },
    {
      tipo: 'tabla',
      encabezado: ['Carpeta', 'Elemento de agrupación', 'Elemento de registro'],
      filas: [
        ['Manejo de caja', '<cash_managements>', '<cash_management>'],
        ['Remuneraciones', '<salaries>', '<salary>'],
        ['Corpus Christi', '<corpus_christi_records>', '<corpus_christi_record>'],
        ['Índice de compañías', '<companies>', '<company>'],
        ['Lista de transacciones', '<transactions>', '<transaction>'],
        ['Bibliografía', '<bibliographies>', '<bibliography>'],
      ],
      anchos: [120, '*', '*'],
    },
    { tipo: 'p', texto: 'En Manejo de caja, los datos generales de la compañía se incluyen en <company>; en Remuneraciones, los del empleador en <employer>; y en Corpus Christi, la ciudad y el año en <city_year>. Los registros de las tres carpetas incluyen una transacción anidada, con los campos transaction_number, transaction_news, sources y, cuando corresponde, <documents> con uno o varios elementos <document>.' },
    { tipo: 'p', texto: 'Los campos específicos de cada sección son:' },
    {
      tipo: 'lista',
      items: [
        'Manejo de caja: year, city, income, expenses, other_company_assets.',
        'Remuneraciones: year, city, beneficiary, role, amount_paid, daily_allowance, performance_pay.',
        'Corpus Christi: task, person_in_charge, amount_paid, funds, companies.',
        'Índice de compañías: company_code, company_name, authors, theatrical_seasons, company_index, scope.',
        'Bibliografía: authors, bibliographical_references.',
      ],
    },
    { tipo: 'p', texto: 'Los documentos anidados contienen doc_id y, cuando se dispone de él, document_text. En los registros de Corpus Christi, <companies> puede contener varias compañías relacionadas con un mismo encargo.' },
    { tipo: 'p', texto: 'La versión del formato indicada en el bloque de metadatos es 1.0. Esta versión describe el formato de exportación y debe distinguirse de la fecha de generación de los archivos.' },

    { tipo: 'h1', texto: '6. Convenciones y criterios de registro' },
    { tipo: 'h2', texto: '6.1. Siglas de las compañías' },
    { tipo: 'p', texto: 'Cada compañía teatral dispone de una sigla que funciona como identificador. Las siglas se escriben en mayúsculas y sus componentes se separan mediante guiones, por ejemplo «GA-JR». La información correspondiente a cada sigla puede consultarse en el Índice de compañías.' },
    { tipo: 'h2', texto: '6.2. Representación de las fechas' },
    { tipo: 'p', texto: 'Las fechas se registran mediante diferentes fórmulas, según la información disponible en las fuentes históricas. Entre las convenciones utilizadas se encuentran un año determinado («1600»), un intervalo («De 1580 a 1581»), un intervalo con indicación de mes, una referencia aproximada («Activa en 1600») o una referencia a una década («De la década de 1590 a 1605»).' },
    { tipo: 'p', texto: 'Estas convenciones permiten conservar distintos grados de precisión cronológica según la documentación disponible. Al procesar los XML, no debe suponerse que todas las expresiones cronológicas tienen el mismo grado de precisión.' },
    { tipo: 'h2', texto: '6.3. Registro de montos monetarios' },
    { tipo: 'p', texto: 'PRETSO utiliza los reales para facilitar la consulta y comparación de los datos económicos, pero conserva también la forma en que los montos aparecen expresados en los documentos históricos. Esta distinción permite identificar tanto el valor normalizado utilizado en la investigación como la denominación monetaria original de la fuente.' },
    { tipo: 'p', texto: 'En el dataset, los campos monetarios pueden contener texto, incluidas unidades como «reales». Por ello, no deben tratarse automáticamente como números sin examinar previamente su contenido.' },
    { tipo: 'h2', texto: '6.4. Alcance e interpretación de los datos' },
    { tipo: 'p', texto: 'Los registros proceden de noticias históricas identificadas en las fuentes consultadas durante el desarrollo de la investigación. La presencia de un dato permite identificar su documentación histórica, pero no implica necesariamente que se disponga de información completa sobre la actividad económica a la que pertenece. Los movimientos de caja pueden representar únicamente una parte de las operaciones de una compañía y los acuerdos de remuneración conservados no constituyen necesariamente una relación completa de sus trabajadores.' },
    { tipo: 'p', texto: 'Los datos deben interpretarse teniendo en cuenta el alcance y las características de las fuentes históricas disponibles.' },

    { tipo: 'h1', texto: '7. Datos incompletos y particularidades de la exportación' },
    { tipo: 'p', texto: 'La exportación contempla marcas y archivos especiales para determinados casos:' },
    {
      tipo: 'lista',
      items: [
        'Un documento asociado que no se haya encontrado puede figurar como <document found="false">, conservando su código cuando está disponible.',
        'Una compañía no encontrada en un registro de Corpus Christi puede figurar como <company found="false">.',
        'Las transacciones con número duplicado o ausente se conservan en la Lista de transacciones mediante los atributos number_status="duplicate" y number_status="missing", respectivamente.',
        'Los registros de caja o remuneraciones sin compañía identificada pueden agruparse en Sin compañía identificada.xml.',
        'Los registros de Corpus Christi sin ciudad o año pueden agruparse en Sin ciudad o año.xml.',
      ],
    },
    { tipo: 'p', texto: fraseAvisos(resumen) },
    { tipo: 'p', texto: 'El dataset no incluye, por ahora, una sección de la base de datos llamada Identificación de indicadores, cuya estructura está todavía en desarrollo. Se prevé que en versiones futuras de este mismo dataset se encuentre dicha sección.' },

    { tipo: 'h1', texto: '8. Cómo citar el dataset' },
    { tipo: 'p', texto: 'Paz Rescala, Laura. PRETSO. Precios del Teatro del Siglo de Oro: dataset. DOI: pendiente.' },

    { tipo: 'h1', texto: '9. Licencia y condiciones de uso' },
    { tipo: 'p', texto: 'Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 International (CC BY-NC-ND 4.0):' },
    { tipo: 'enlace', texto: 'https://creativecommons.org/licenses/by-nc-nd/4.0/', url: 'https://creativecommons.org/licenses/by-nc-nd/4.0/' },
    { tipo: 'p', texto: 'Esta licencia permite compartir el material con atribución, sin fines comerciales y sin distribuir versiones modificadas del material licenciado. Se aplica únicamente a los contenidos sobre los que sus titulares poseen los derechos correspondientes y no modifica los derechos que puedan existir sobre documentos históricos, imágenes u otros materiales de terceros.' },

    { tipo: 'h1', texto: '10. Proyecto, financiación y contacto' },
    { tipo: 'p', texto: 'PRETSO ha sido desarrollada en el marco del proyecto:' },
    { tipo: 'p', texto: 'Theater in Imperial Spain: Studying a Commercial Activity during the First Globalization from the Perspective of Labor and Economic History (THIS).' },
    { tipo: 'p', texto: 'Investigadora responsable: Laura Paz Rescala.' },
    { tipo: 'p', texto: 'Programa de financiación: Horizon Europe, Marie Skłodowska-Curie Actions, Postdoctoral Fellowships.' },
    { tipo: 'p', texto: 'Número de proyecto: 101150056.' },
    { tipo: 'p', texto: "Instituciones vinculadas al proyecto: Università Ca' Foscari Venezia y Tulane University." },
    { tipo: 'p', texto: 'Sitio web: https://pretso-database.web.app/' },
    { tipo: 'p', texto: 'Contacto: lauraagar.pazrescala@unive.it' },
  ];
}
