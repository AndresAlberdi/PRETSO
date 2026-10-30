// Título de documento por ruta (WCAG 2.4.2). Las rutas reflejan las de App.tsx.
const SECCIONES: Record<string, string> = {
  '/': 'Inicio',
  '/buscar': 'Búsqueda general',
  '/caja': 'Manejo de Caja',
  '/salarios': 'Remuneraciones',
  '/corpus': 'Corpus Christi',
  '/indicadores': 'Identificación de Indicadores',
  '/companias': 'Compañías',
  '/bibliografia': 'Bibliografía',
  '/agregar': 'Agregar transacción',
  '/transacciones': 'Transacciones',
  '/documentos': 'Documentos',
  '/auditoria': 'Auditoría',
  '/administracion': 'Administración',
  '/usuarios': 'Usuarios',
  '/login': 'Iniciar sesión',
};

const TITULO_POR_DEFECTO = 'PRETSO';

export function pageTitle(pathname: string): string {
  const ruta = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  const seccion = Object.prototype.hasOwnProperty.call(SECCIONES, ruta) ? SECCIONES[ruta] : undefined;
  return seccion ? `${seccion} — ${TITULO_POR_DEFECTO}` : TITULO_POR_DEFECTO;
}
