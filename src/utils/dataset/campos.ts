/**
 * Lista blanca de campos del dataset, en orden fijo. Nunca se recorre
 * `Object.keys` de un registro: los campos retirados o heredados quedan fuera
 * por construcción.
 */
export interface CampoDataset {
  campo: string;
  elemento: string;
  etiqueta: string;
}

export type ColeccionDataset =
  | 'companias'
  | 'transacciones'
  | 'documentos'
  | 'manejo_de_caja'
  | 'salarios'
  | 'corpus_christi'
  | 'bibliografia';

export const CAMPOS_DATASET: Record<ColeccionDataset, readonly CampoDataset[]> = {
  companias: [
    { campo: 'Sigla Compañía', elemento: 'company_code', etiqueta: 'Sigla' },
    { campo: 'Nombre Compañía', elemento: 'company_name', etiqueta: 'Nombre de la compañía' },
    { campo: 'Autores', elemento: 'authors', etiqueta: 'Autores' },
    { campo: 'Temporadas teatrales', elemento: 'theatrical_seasons', etiqueta: 'Temporadas teatrales' },
    { campo: 'Índice de compañías', elemento: 'company_index', etiqueta: 'Índice de compañías' },
    { campo: 'Ámbito', elemento: 'scope', etiqueta: 'Ámbito' },
  ],
  transacciones: [
    { campo: 'Num', elemento: 'transaction_number', etiqueta: 'Nro. de transacción' },
    { campo: 'Noticia', elemento: 'transaction_news', etiqueta: 'Noticia' },
    { campo: 'Fuentes para la generación del dato', elemento: 'sources', etiqueta: 'Fuentes para la generación del dato' },
  ],
  documentos: [
    { campo: 'Doc', elemento: 'doc_id', etiqueta: 'Código del documento' },
    { campo: 'Documento', elemento: 'document_text', etiqueta: 'Texto del documento' },
  ],
  manejo_de_caja: [
    { campo: 'Año', elemento: 'year', etiqueta: 'Año' },
    { campo: 'Ciudad', elemento: 'city', etiqueta: 'Ciudad' },
    { campo: 'Ingresos', elemento: 'income', etiqueta: 'Ingresos' },
    { campo: 'Egresos', elemento: 'expenses', etiqueta: 'Egresos' },
    { campo: 'Otros bienes de la compañía', elemento: 'other_company_assets', etiqueta: 'Otros bienes de la compañía' },
  ],
  salarios: [
    { campo: 'Año', elemento: 'year', etiqueta: 'Año' },
    { campo: 'Ciudad', elemento: 'city', etiqueta: 'Ciudad' },
    // El nombre del campo en la base lleva un espacio final.
    { campo: 'Beneficiario ', elemento: 'beneficiary', etiqueta: 'Beneficiario' },
    { campo: 'Encargo', elemento: 'role', etiqueta: 'Encargo' },
    { campo: 'Monto a pagar', elemento: 'amount_paid', etiqueta: 'Monto a pagar' },
    { campo: 'Ración diaria', elemento: 'daily_allowance', etiqueta: 'Ración diaria' },
    { campo: 'Pago por representación', elemento: 'performance_pay', etiqueta: 'Pago por representación' },
  ],
  corpus_christi: [
    { campo: 'Encargo', elemento: 'task', etiqueta: 'Encargo' },
    // El nombre del campo en la base lleva un espacio final.
    { campo: 'Encargado ', elemento: 'person_in_charge', etiqueta: 'Encargado' },
    { campo: 'Monto a pagar', elemento: 'amount_paid', etiqueta: 'Monto a pagar' },
    { campo: 'Fondos', elemento: 'funds', etiqueta: 'Fondos' },
  ],
  bibliografia: [
    { campo: 'Autores', elemento: 'authors', etiqueta: 'Autores' },
    { campo: 'Referencias bibliográficas', elemento: 'bibliographical_references', etiqueta: 'Referencias bibliográficas' },
  ],
};

export const CAMPOS_ENCABEZADO_CORPUS: readonly CampoDataset[] = [
  { campo: 'Ciudad', elemento: 'city', etiqueta: 'Ciudad' },
  { campo: 'Año', elemento: 'year', etiqueta: 'Año' },
];
