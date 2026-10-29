import { Link } from 'react-router';
import { useAdmin } from '../context/AdminContext';

export default function Portada() {
  const { isAdmin } = useAdmin();
  return (
    <div className="portada">
      <section className="portada-hero" aria-labelledby="titulo-portada">
        <h1 id="titulo-portada" className="portada-titulo">PRETSO</h1>
        <p className="portada-subtitulo">Precios del Teatro del Siglo de Oro</p>
        <p className="portada-descripcion">Base de datos para el estudio de las dinámicas económicas del teatro comercial en los territorios hispanos (siglos XVI-XVII)</p>
      </section>
      <section className="portada-lateral" aria-label="Proyecto y acciones">
        <div className="portada-logos">
          <div className="portada-logo"><img src="/logo_this.jpg" alt="Logo del proyecto THIS: Theater in Imperial Spain" /></div>
          <div className="portada-logo"><img src="/logo_unive.png" alt="Università Ca' Foscari Venezia, Departamento de Lingüística y Estudios Culturales Comparados" /></div>
          <div className="portada-logo portada-logo-oscuro"><img src="/logo_ue.png" alt="Funded by the European Union" /></div>
        </div>
        <div className="portada-leyenda">
          <p>Proyecto: [101150056] — [THIS] — [HORIZON-MSCA-2023-PF-01]</p>
          <p>IP: Laura Paz Rescala</p>
        </div>
        <div className="portada-acciones">
          <Link to="/buscar" className="boton boton-primario">Realizar búsquedas</Link>
          {isAdmin && (<>
            <Link to="/buscar" className="boton boton-editor">Editar</Link>
            <Link to="/administracion" className="boton boton-editor">Administración</Link>
          </>)}
        </div>
      </section>
    </div>
  );
}
