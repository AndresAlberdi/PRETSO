import { Link } from 'react-router';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { useAdmin } from '../context/AdminContext';
import { useCanLoad } from '../hooks/useCanEdit';

export interface TopBarProps {
  /** Botón de retorno; se omite en la portada. */
  volver?: { to: string; texto: 'Atrás' | 'Inicio' };
  /** Correo de la sesión y botón «Salir»; solo en la portada. */
  conCuenta?: boolean;
  /** Enlace rojo a /agregar; solo en /buscar y solo para administradores. */
  conAgregar?: boolean;
}

// Barra mínima de cada pantalla: marca, cuenta (portada) y botón de retorno.
export function TopBar({ volver, conCuenta = false, conAgregar = false }: TopBarProps) {
  const { user } = useAdmin();
  const canLoad = useCanLoad();
  return (
    <header className="barra-superior">
      <p className="marca">PRETSO</p>
      {conCuenta && user?.email && <span className="barra-correo">{user.email}</span>}
      {conCuenta && <button type="button" className="boton boton-primario" onClick={() => signOut(auth)}>Salir</button>}
      {conAgregar && canLoad && <Link to="/agregar" className="boton boton-editor">Agregar transacción</Link>}
      {volver && <Link to={volver.to} className="boton boton-secundario">{volver.texto}</Link>}
    </header>
  );
}
