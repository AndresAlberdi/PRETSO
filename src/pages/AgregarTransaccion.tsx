import { Link } from 'react-router';

// Punto de entrada de las herramientas de carga. Solo para administradores:
// la ruta la protege AdminRoute en App.tsx.
export default function AgregarTransaccion() {
  return (
    <div>
      <h1>Agregar transacción</h1>
      <p className="etiqueta-editor">Solo editores</p>
      <p className="texto-agregar">Todo registro nuevo parte de una transacción. Después se añade en la sección correspondiente con Editar.</p>
      <nav aria-label="Herramientas de carga">
        <ul className="tarjetas-carga">
          <li><Link to="/documentos" className="tarjeta-carga">Documentos</Link></li>
          <li><Link to="/transacciones" className="tarjeta-carga">Transacciones</Link></li>
        </ul>
      </nav>
    </div>
  );
}
