import { collection, getDocs, query } from "firebase/firestore";
import { db } from "../firebase";
import * as XLSX from "xlsx";

// Sheet names in Spanish for the tabs
const SHEET_NAMES: Record<string, string> = {
  documentos: 'Documentos',
  companias: 'Compañías',
  transacciones: 'Transacciones',
  manejo_de_caja: 'Manejo de Caja',
  salarios: 'Salarios',
  corpus_christi: 'Corpus Christi',
  indicadores: 'Indicadores',
  bibliografia: 'Bibliografía'
};

// Column ordering for each sheet to display them logically
const COLUMN_ORDERS: Record<string, string[]> = {
  documentos: ['Doc', 'Documento'],
  companias: ['Indicador de registro', 'Sigla Compañía', 'Autores', 'Temporadas teatrales', 'Índice de compañías', 'Ámbito'],
  transacciones: ['Num', 'Noticia', 'Fuentes para la generación del dato', 'Doc1', 'Doc2', 'Doc3', 'Doc4', 'Doc5', 'Doc6', 'Doc7', 'Doc8', 'Doc9', 'Doc10'],
  manejo_de_caja: ['Indicador de registro', 'Sigla Compañía', 'Año', 'Ciudad', 'Ingresos', 'Egresos', 'Otros bienes de la compañía', 'Transacción', 'Datos sobre normativa de manejo de caja'],
  salarios: ['Indicador de registro', 'Sigla Compañía', 'Año', 'Ciudad', 'Beneficiario ', 'Encargo', 'Monto a pagar', 'Transacción', 'Ración diaria', 'Pago por representación', 'Días de ración en un año', 'Número estimado de representaciones por año', 'Número de representaciones  por año '],
  corpus_christi: ['Indicador de registro', 'Ciudad', 'Año', 'Encargado ', 'Encargo', 'Monto a pagar', 'Fondos', 'Transacción', 'Compañía', 'Compañía2', 'Compañía3', 'Compañía4', 'Compañía5', 'Compañía6', 'Compañía7', 'Compañía8', 'Compañía9', 'Compañía10', 'Cmp', 'Cmp2'],
  indicadores: ['Indicador de registro', 'Ciudad', 'Años', 'Concepto', 'Monto', 'Nota', 'Categorías', 'Transacción', 'Sigla Compañía'],
  bibliografia: ['Autores', 'Referencias bibliográficas']
};

// Header renaming map to remove technical training spaces in columns
const HEADER_CLEANUPS: Record<string, string> = {
  'Beneficiario ': 'Beneficiario',
  'Encargado ': 'Encargado',
  'Número de representaciones  por año ': 'Número de representaciones por año',
};

export async function generateDatabaseXlsx(): Promise<Blob> {
  const wb = XLSX.utils.book_new();
  const collections = Object.keys(SHEET_NAMES);

  for (const collName of collections) {
    const q = query(collection(db, collName));
    const snap = await getDocs(q);

    // 1. Sort the records sequentially by their index field
    const docs = [...snap.docs];
    docs.sort((docA, docB) => {
      const a = docA.data();
      const b = docB.data();
      
      let indexField = '';
      if (collName === 'documentos') indexField = 'Doc';
      else if (collName === 'transacciones') indexField = 'Num';
      else if (collName === 'bibliografia') {
        return String(a['Autores'] || '').localeCompare(String(b['Autores'] || ''));
      }
      else indexField = 'Indicador de registro';

      const valA = a[indexField];
      const valB = b[indexField];

      // Safe numeric sort
      const numA = Number(valA);
      const numB = Number(valB);
      if (!isNaN(numA) && !isNaN(numB)) {
        return numA - numB;
      }
      return String(valA || '').localeCompare(String(valB || ''));
    });

    // 2. Format row objects preserving column ordering
    const formattedRows = docs.map(doc => {
      const rowData = doc.data();
      const newRow: any = {};
      const columns = COLUMN_ORDERS[collName] || Object.keys(rowData).sort();

      columns.forEach(col => {
        const cleanHeader = HEADER_CLEANUPS[col] || col;
        newRow[cleanHeader] = rowData[col] !== undefined && rowData[col] !== null ? rowData[col] : '';
      });
      return newRow;
    });

    // 3. Create worksheet and append to workbook
    const ws = XLSX.utils.json_to_sheet(formattedRows);
    XLSX.utils.book_append_sheet(wb, ws, SHEET_NAMES[collName]);
  }

  // 4. Generate XLSX binary buffer
  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function downloadXlsx(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
