export interface Seccion { ruta: string; nombre: string }
export const SECCIONES: readonly Seccion[] = [
  { ruta: '/caja', nombre: 'Manejo de Caja' },
  { ruta: '/salarios', nombre: 'Remuneraciones' },
  { ruta: '/corpus', nombre: 'Corpus Christi' },
  { ruta: '/indicadores', nombre: 'Identificación de Indicadores' },
  { ruta: '/companias', nombre: 'Índice de Compañías' },
  { ruta: '/bibliografia', nombre: 'Bibliografía' },
];
