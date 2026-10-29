import { Link } from 'react-router';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { useAdmin } from '../context/AdminContext';

export interface TopBarProps {
  /** Botón de retorno; se omite en la portada. */
  volver?: { to: string; texto: 'Atrás' | 'Inicio' };
  /** Correo de la sesión y botón «Salir»; solo en la portada. */
  conCuenta?: boolean;
}

// Barra mínima de cada pantalla: marca, cuenta (portada) y botón de retorno.
export function TopBar({ volver, conCuenta = false }: TopBarProps) {
  const { user } = useAdmin();
  return (
    <header className="barra-superior">
      <p className="marca">PRETSO</p>
      {conCuenta && user?.email && <span className="barra-correo">{user.email}</span>}
      {conCuenta && <button type="button" className="boton boton-primario" onClick={() => signOut(auth)}>Salir</button>}
      {volver && <Link to={volver.to} className="boton boton-secundario">{volver.texto}</Link>}
    </header>
  );
}
