import { collection, getDocs, query } from "firebase/firestore";
import { db } from "../firebase";
import JSZip from "jszip";

// Translation mapping from Spanish to English field names
const FIELD_TRANSLATIONS: Record<string, Record<string, string>> = {
  documentos: {
    Doc: 'doc_id',
    Documento: 'document_text'
  },
  companias: {
    'Sigla Compañía': 'company_code',
    'Indicador de registro': 'record_indicator',
    'Temporadas teatrales': 'theatrical_seasons',
    'Índice de compañías': 'company_index',
    'Autores': 'authors',
    'Ámbito': 'scope'
  },
  transacciones: {
    'Num': 'transaction_number',
    'Noticia': 'transaction_news',
    'Fuentes para la generación del dato': 'sources',
    'Doc1': 'document_ref_1',
    'Doc2': 'document_ref_2',
    'Doc3': 'document_ref_3',
    'Doc4': 'document_ref_4',
    'Doc5': 'document_ref_5',
    'Doc6': 'document_ref_6',
    'Doc7': 'document_ref_7',
    'Doc8': 'document_ref_8',
    'Doc9': 'document_ref_9',
    'Doc10': 'document_ref_10'
  },
  manejo_de_caja: {
    'Indicador de registro': 'record_indicator',
    'Sigla Compañía': 'company_code',
    'Año': 'year',
    'Ciudad': 'city',
    'Ingresos': 'income',
    'Egresos': 'expenses',
    'Otros bienes de la compañía': 'other_company_assets',
    'Transacción': 'transaction_ref',
    'Datos sobre normativa de manejo de caja': 'cash_management_regulations'
  },
  salarios: {
    'Indicador de registro': 'record_indicator',
    'Sigla Compañía': 'company_code',
    'Ciudad': 'city',
    'Año': 'year',
    'Beneficiario ': 'beneficiary',
    'Encargo': 'role',
    'Monto a pagar': 'amount_paid',
    'Transacción': 'transaction_ref',
    'Ración diaria': 'daily_allowance',
    'Pago por representación': 'performance_pay',
    'Días de ración en un año': 'daily_allowance_days_per_year',
    'Número estimado de representaciones por año': 'estimated_performances_per_year',
    'Número de representaciones  por año ': 'performances_per_year'
  },
  corpus_christi: {
    'Indicador de registro': 'record_indicator',
    'Ciudad': 'city',
    'Año': 'year',
    'Encargado ': 'person_in_charge',
    'Encargo': 'task',
    'Monto a pagar': 'amount_paid',
    'Fondos': 'funds',
    'Transacción': 'transaction_ref',
    'Compañía': 'company',
    'Compañía2': 'company_2',
    'Compañía3': 'company_3',
    'Compañía4': 'company_4',
    'Compañía5': 'company_5',
    'Compañía6': 'company_6',
    'Compañía7': 'company_7',
    'Compañía8': 'company_8',
    'Compañía9': 'company_9',
    'Compañía10': 'company_10',
    'Cmp': 'cmp',
    'Cmp2': 'cmp_2'
  },
  indicadores: {
    'Indicador de registro': 'record_indicator',
    'Ciudad': 'city',
    'Años': 'years',
    'Concepto': 'concept',
    'Monto': 'amount',
    'Nota': 'note',
    'Categorías': 'categories',
    'Transacción': 'transaction_ref',
    'Sigla Compañía': 'company_code'
  },
  bibliografia: {
    'Autores': 'authors',
    'Referencias bibliográficas': 'bibliographical_references'
  }
};

// Fallback field translation for safety
export function translateField(collectionName: string, field: string): string {
  const tableMap = FIELD_TRANSLATIONS[collectionName];
  if (tableMap && tableMap[field] !== undefined) {
    return tableMap[field];
  }
  // Convert Spanish characters and spaces to clean English identifiers
  return field
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(/ñ/g, "n")
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

// XML entity escaping helper
export function escapeXml(unsafe: any): string {
  if (unsafe === null || unsafe === undefined) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export const COLLECTION_ELEMENT_MAP: Record<string, { root: string; item: string }> = {
  documentos: { root: 'documents', item: 'document' },
  companias: { root: 'companies', item: 'company' },
  transacciones: { root: 'transactions', item: 'transaction' },
  manejo_de_caja: { root: 'cash_managements', item: 'cash_management' },
  salarios: { root: 'salaries', item: 'salary' },
  corpus_christi: { root: 'corpus_christi_records', item: 'corpus_christi_record' },
  indicadores: { root: 'indicators', item: 'indicator' },
  bibliografia: { root: 'bibliographies', item: 'bibliography' }
};

// Generate full XML string
export async function generateDatabaseXml(): Promise<string> {
  const collections = Object.keys(COLLECTION_ELEMENT_MAP);
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<pretso_database>\n';

  for (const collName of collections) {
    const mapping = COLLECTION_ELEMENT_MAP[collName];
    xml += `  <${mapping.root}>\n`;

    const q = query(collection(db, collName));
    const snap = await getDocs(q);

    snap.docs.forEach(doc => {
      xml += `    <${mapping.item}>\n`;
      const data = doc.data();

      // Ensure fields are output in sorted order for determinism and readability
      Object.keys(data).sort().forEach(key => {
        if (key === 'id') return; // ignore document reference ID
        const engKey = translateField(collName, key);
        const val = data[key];
        
        xml += `      <${engKey}>${escapeXml(val)}</${engKey}>\n`;
      });

      xml += `    </${mapping.item}>\n`;
    });

    xml += `  </${mapping.root}>\n`;
  }

  xml += '</pretso_database>';
  return xml;
}

// Trigger browser download of XML
export function downloadXml(xmlContent: string, filename: string) {
  const blob = new Blob([xmlContent], { type: 'application/xml;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Generate a ZIP containing the XML
export async function generateZipBlob(xmlContent: string, xmlFilename: string): Promise<Blob> {
  const zip = new JSZip();
  zip.file(xmlFilename, xmlContent);
  return await zip.generateAsync({ type: "blob" });
}

// Upload a Blob to Google Drive of account pretsodatabase@gmail.com
export async function uploadToGoogleDrive(
  blob: Blob,
  filename: string,
  accessToken: string
): Promise<string> {
  const metadata = {
    name: filename,
    mimeType: 'application/zip'
  };

  const boundary = 'pretso_multipart_boundary_178239';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadataPart = 'Content-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(metadata);

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsArrayBuffer(blob);
    reader.onload = async () => {
      try {
        const arrayBuffer = reader.result as ArrayBuffer;
        const body = new Blob([
          delimiter,
          metadataPart,
          delimiter,
          'Content-Type: application/zip\r\n\r\n',
          new Uint8Array(arrayBuffer),
          closeDelimiter
        ], { type: `multipart/related; boundary=${boundary}` });

        const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`
          },
          body: body
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Google Drive API error: ${response.status} - ${errText}`);
        }

        const resData = await response.json();
        resolve(resData.id);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Error reading file blob"));
  });
}
