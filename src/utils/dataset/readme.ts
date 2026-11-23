import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import { bloquesReadme, type Bloque } from './readmeTexto';
import type { ResumenDataset } from './tipos';

function aContenido(b: Bloque): Content {
  switch (b.tipo) {
    case 'titulo':
      return { text: b.texto, style: 'titulo' };
    case 'subtitulo':
      return { text: b.texto, style: 'subtitulo' };
    case 'h1':
      return { text: b.texto, style: 'h1', headlineLevel: 1 };
    case 'h2':
      return { text: b.texto, style: 'h2', headlineLevel: 2 };
    case 'p':
      return { text: b.texto, style: 'p' };
    case 'enlace':
      return { text: b.texto, link: b.url, style: 'enlace' };
    case 'lista':
      return { ul: b.items, style: 'lista' };
    case 'tabla':
      return {
        style: 'tabla',
        table: {
          headerRows: 1,
          widths: b.anchos,
          body: [
            b.encabezado.map((t) => ({ text: t, bold: true, fillColor: '#eeeeee' })),
            ...b.filas.map((fila) => fila.map((t) => ({ text: t }))),
          ],
        },
        layout: 'lightHorizontalLines',
      };
  }
}

/** Árbol del documento pdfmake del README; función pura, sin cargar pdfmake. */
export function construirDocumentoReadme(resumen: ResumenDataset): TDocumentDefinitions {
  return {
    info: {
      title: 'PRETSO. Precios del Teatro del Siglo de Oro: dataset (Readme)',
      author: 'PRETSO',
      creationDate: resumen.generadoEn,
    },
    pageSize: 'A4',
    pageMargins: [56, 56, 56, 56],
    defaultStyle: { font: 'Roboto', fontSize: 10.5, lineHeight: 1.25 },
    content: bloquesReadme(resumen).map(aContenido),
    styles: {
      titulo: { fontSize: 24, bold: true, margin: [0, 0, 0, 4] },
      subtitulo: { fontSize: 13, color: '#444444', margin: [0, 0, 0, 14] },
      h1: { fontSize: 15, bold: true, margin: [0, 14, 0, 6] },
      h2: { fontSize: 12.5, bold: true, margin: [0, 10, 0, 4] },
      p: { margin: [0, 0, 0, 6] },
      lista: { margin: [0, 0, 0, 8] },
      tabla: { margin: [0, 2, 0, 10] },
      enlace: { color: '#1a5fb4', decoration: 'underline', margin: [0, 0, 0, 6] },
    },
  };
}

/** Genera el README.pdf. pdfmake (y su fuente Roboto) se cargan solo al llamar a esta función. */
export async function generarReadmePdf(resumen: ResumenDataset): Promise<Uint8Array> {
  const [{ default: pdfMake }, { default: vfs }] = await Promise.all([
    import('pdfmake/build/pdfmake'),
    import('pdfmake/build/vfs_fonts'),
  ]);
  pdfMake.addVirtualFileSystem(vfs);
  return pdfMake.createPdf(construirDocumentoReadme(resumen)).getBuffer();
}
