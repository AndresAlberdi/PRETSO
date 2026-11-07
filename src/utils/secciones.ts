export interface Seccion { ruta: string; nombre: string }
export const SECCIONES: readonly Seccion[] = [
  { ruta: '/caja', nombre: 'Manejo de caja' },
  { ruta: '/salarios', nombre: 'Remuneraciones' },
  { ruta: '/corpus', nombre: 'Corpus Christi' },
  { ruta: '/indicadores', nombre: 'Identificación de indicadores' },
  { ruta: '/companias', nombre: 'Índice de compañías' },
  { ruta: '/bibliografia', nombre: 'Bibliografía' },
];
