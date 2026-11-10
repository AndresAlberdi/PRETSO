// Textos legales de PRETSO. Los fragmentos `[[PENDIENTE: …]]` son datos que debe aportar la Universidad:
// se dejan tal cual y la puerta de publicación (publicable.ts) impide publicar a producción mientras existan.

// Detecta cualquier apertura de marcador (con o sin «:» y sin depender del cierre), para que la puerta falle cerrada.
export const MARCADOR = /\[\[\s*PENDIENTE\b/i;

export type RutaLegal = '/aviso-legal' | '/privacidad' | '/cookies' | '/accesibilidad' | '/creditos';

export interface PaginaLegalTexto {
  titulo: string;
  secciones: { encabezado: string; parrafos: string[] }[];
}

export const PIE: { titularidad: string; financiacion: string; explicacion: string; urlDeclaracionAgid?: string } = {
  titularidad:
    "© [[PENDIENTE: año]] Università Ca' Foscari Venezia, Dipartimento di Studi Linguistici e Culturali Comparati. PRETSO es un resultado del proyecto THIS (Theater in Imperial Spain), financiado por la Unión Europea (MSCA, acuerdo n.º 101150056, HORIZON-MSCA-2023-PF-01).",
  financiacion:
    '[[PENDIENTE: texto exacto del Grant Agreement firmado; habitual: "Financiado por la Unión Europea. Las opiniones y puntos de vista expresados solo comprometen a su(s) autor(es) y no reflejan necesariamente los de la Unión Europea ni los de la Agencia Ejecutiva de Investigación (REA). Ni la Unión Europea ni la autoridad que concede la subvención pueden ser consideradas responsables de ellos."]]',
  // Recuadro de la portada que redacta Laura. Vacío hasta entonces; la puerta de publicación lo trata como pendiente.
  explicacion: '',
};

export const PAGINAS_LEGALES: Record<RutaLegal, PaginaLegalTexto> = {
  '/aviso-legal': {
    titulo: 'Aviso legal',
    secciones: [
      {
        encabezado: 'Titular',
        parrafos: ["Università Ca' Foscari Venezia, [[PENDIENTE: domicilio, CF/P. IVA]]."],
      },
      {
        encabezado: 'Finalidad',
        parrafos: ['PRETSO es una base de datos académica de consulta.'],
      },
      {
        encabezado: 'Propiedad',
        parrafos: ['Los resultados son propiedad exclusiva de la Universidad.'],
      },
      {
        encabezado: 'Licencias',
        parrafos: [
          'Licencia del corpus: [[PENDIENTE: p. ej. CC BY 4.0]].',
          'Licencia del código: [[PENDIENTE]].',
        ],
      },
      {
        encabezado: 'Cómo citar',
        parrafos: ['[[PENDIENTE: texto de Laura]]'],
      },
      {
        encabezado: 'Exención de responsabilidad',
        parrafos: [
          'Las transcripciones se ofrecen con fines de investigación y la Universidad no garantiza su exactitud. Se recomienda contrastarlas con las fuentes originales.',
        ],
      },
      {
        encabezado: 'Ley aplicable',
        parrafos: ['[[PENDIENTE]]'],
      },
    ],
  },
  '/privacidad': {
    titulo: 'Privacidad',
    secciones: [
      {
        encabezado: 'Titular del tratamiento',
        parrafos: ['La Universidad. Delegado de protección de datos (DPO): [[PENDIENTE: contacto del DPO]].'],
      },
      {
        encabezado: 'Datos que se tratan',
        parrafos: [
          'Visitantes: datos técnicos (dirección IP, señales del dispositivo) que tratan Google Firebase Hosting y reCAPTCHA Enterprise/App Check.',
          'Cuentas de administración: correo electrónico.',
          'Bitácora de cambios: correo de quien edita.',
        ],
      },
      {
        encabezado: 'Finalidades',
        parrafos: ['Servir el sitio, protegerlo del abuso y administrar los datos.'],
      },
      {
        encabezado: 'Base jurídica',
        parrafos: ['[[PENDIENTE]]'],
      },
      {
        encabezado: 'Encargado del tratamiento y transferencias',
        parrafos: [
          'Encargado: Google. Ubicación de los datos: Estados Unidos (nam5). Mecanismo de transferencia: [[PENDIENTE]].',
        ],
      },
      {
        encabezado: 'Conservación',
        parrafos: ['[[PENDIENTE]]'],
      },
      {
        encabezado: 'Derechos y reclamación',
        parrafos: [
          'Puede ejercer sus derechos y presentar una reclamación ante el Garante per la protezione dei dati personali. Canal para ejercerlos: [[PENDIENTE]].',
        ],
      },
    ],
  },
  '/cookies': {
    titulo: 'Cookies',
    secciones: [
      {
        encabezado: 'Uso de cookies',
        parrafos: [
          'El sitio no usa cookies de analítica ni de publicidad.',
          'Se almacenan únicamente los datos técnicos siguientes, todos necesarios para el funcionamiento del sitio (medición del 16/10):',
          'IndexedDB de Firebase: autenticación, App Check y latidos.',
          'localStorage «_grecaptcha»: reCAPTCHA.',
          '[[PENDIENTE: confirmación del DPO sobre reCAPTCHA]]',
        ],
      },
    ],
  },
  '/accesibilidad': {
    titulo: 'Accesibilidad',
    secciones: [
      {
        encabezado: 'Norma de referencia',
        parrafos: ['WCAG 2.1 AA / EN 301 549.'],
      },
      {
        encabezado: 'Estado de conformidad',
        parrafos: ['[[PENDIENTE: conformidad parcial o total, según la evaluación]]'],
      },
      {
        encabezado: 'Declaración oficial',
        parrafos: ['[[PENDIENTE: URL de la declaración en form.agid.gov.it, la publica el RTD]]'],
      },
      {
        encabezado: 'Comentarios',
        parrafos: ['Puede enviar sus comentarios a [[PENDIENTE: correo]]; se responde en 30 días.'],
      },
    ],
  },
  '/creditos': {
    titulo: 'Créditos',
    secciones: [
      {
        encabezado: 'Proyecto',
        parrafos: [
          "Proyecto THIS (MSCA 101150056). Investigadora principal: Laura Paz Rescala. Università Ca' Foscari Venezia, Dipartimento di Studi Linguistici e Culturali Comparati.",
        ],
      },
      {
        encabezado: 'Desarrollo',
        parrafos: ['[[PENDIENTE: cómo se menciona a Andres]]'],
      },
      {
        encabezado: 'Software de terceros',
        parrafos: ['React, Firebase JS SDK, ExcelJS, JSZip y React Router, cada uno con su licencia.'],
      },
      {
        encabezado: 'Emblema de la Unión Europea',
        parrafos: ['El emblema de la Unión Europea acompaña a la financiación del proyecto.'],
      },
      {
        encabezado: 'Herramientas de inteligencia artificial',
        parrafos: ['[[PENDIENTE: declaración de uso de herramientas de IA, si la Universidad la exige]]'],
      },
    ],
  },
};

/** Todos los textos legales en una lista plana, para la puerta de publicación. */
export function textosLegalesPlanos(): string[] {
  const textos: string[] = [PIE.titularidad, PIE.financiacion, PIE.explicacion.trim() || '[[PENDIENTE: explicación de la portada, la redacta Laura]]'];
  if (PIE.urlDeclaracionAgid) textos.push(PIE.urlDeclaracionAgid);
  for (const pagina of Object.values(PAGINAS_LEGALES)) {
    textos.push(pagina.titulo);
    for (const s of pagina.secciones) textos.push(s.encabezado, ...s.parrafos);
  }
  return textos;
}
