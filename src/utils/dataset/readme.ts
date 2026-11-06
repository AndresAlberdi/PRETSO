import { CARPETAS, type ClaveCarpeta, type ResumenDataset } from './tipos';
import {
  ACERCA_DEL_PROYECTO,
  CODIFICACION_TEXTO,
  COMO_CITAR,
  DESCRIPCION_CARPETAS,
  EJEMPLO_BIBLIOGRAFIA,
  EJEMPLO_CORPUS,
  ESQUEMA_COMUN,
  LICENCIA,
  NOTA_COMPANIAS,
  NOTA_REMUNERACIONES,
  NOTA_SIN_ARCHIVO_PROPIO,
  NOTA_TRANSACCIONES,
  QUE_NO_INCLUYE,
  RELACIONES,
  TITULO,
  ejemploCaja,
} from './readmeTexto';

const FENCE = '```';
const ORDEN: readonly ClaveCarpeta[] = ['caja', 'remuneraciones', 'corpus', 'companias', 'transacciones', 'bibliografia'];

/** Fecha en formato `AAAA-MM-DD HH:MM` (UTC). */
function fechaUtc(d: Date): string {
  return d.toISOString().slice(0, 16).replace('T', ' ');
}

function bloqueXml(contenido: string): string {
  return `${FENCE}xml\n${contenido}\n${FENCE}`;
}

/** Genera el README.md del dataset a partir del resumen de la generación. */
export function generarReadme(resumen: ResumenDataset): string {
  const porClave = new Map(resumen.carpetas.map((c) => [c.carpeta, c]));
  const lineasCarpetas = ORDEN.map((clave) => {
    const c = porClave.get(clave);
    const archivos = c?.archivos ?? 0;
    const registros = c?.registros ?? 0;
    const conteo = clave === 'companias' || clave === 'transacciones' || clave === 'bibliografia'
      ? `${registros} registros.`
      : `${archivos} archivos, ${registros} registros.`;
    return `- \`${CARPETAS[clave]}/\`: ${DESCRIPCION_CARPETAS[clave]} ${conteo}`;
  });
  const sinCaja = porClave.get('caja')?.unidadesSinRegistros ?? 0;
  const sinRemu = porClave.get('remuneraciones')?.unidadesSinRegistros ?? 0;
  const a = resumen.avisos;

  const esquemas = [
    `### ${CARPETAS.caja}`,
    bloqueXml(ejemploCaja(CARPETAS.caja)),
    `### ${CARPETAS.remuneraciones}`,
    NOTA_REMUNERACIONES,
    `### ${CARPETAS.corpus}`,
    bloqueXml(EJEMPLO_CORPUS),
    `### ${CARPETAS.companias}`,
    NOTA_COMPANIAS,
    `### ${CARPETAS.transacciones}`,
    NOTA_TRANSACCIONES,
    `### ${CARPETAS.bibliografia}`,
    bloqueXml(EJEMPLO_BIBLIOGRAFIA),
  ];

  const partes = [
    TITULO,
    `Generado el ${fechaUtc(resumen.generadoEn)} UTC. Este archivo se regenera entero en cada descarga; reemplaza a cualquier versión anterior.`,
    '## Acerca del proyecto',
    ACERCA_DEL_PROYECTO,
    '## Codificación y cómo abrir los archivos',
    CODIFICACION_TEXTO,
    '## Estructura',
    lineasCarpetas.join('\n'),
    `Compañías sin registros de caja: ${sinCaja}; sin remuneraciones: ${sinRemu}. ${NOTA_SIN_ARCHIVO_PROPIO}`,
    '## Esquema común',
    ESQUEMA_COMUN,
    '## Esquema por carpeta',
    ...esquemas,
    '## Relaciones y redundancia',
    RELACIONES,
    '## Datos incompletos',
    `Transacciones citadas y no encontradas: ${a.transaccionesNoEncontradas}. Documentos citados y no encontrados: ${a.documentosNoEncontrados}. Se marcan con \`found="false"\`. ` +
      `Registros sin compañía o sin ciudad y año: ${a.registrosSinUnidad}; están en \`Sin compañía identificada.xml\` y \`Sin ciudad o año.xml\`.`,
    '## Qué no incluye',
    QUE_NO_INCLUYE,
    '## Cómo citar y licencia',
    `Cómo citar: ${COMO_CITAR}`,
    `Licencia: ${LICENCIA}`,
  ];
  return `${partes.join('\n\n')}\n`;
}
