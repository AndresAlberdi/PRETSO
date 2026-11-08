import { PAGINAS_LEGALES, type RutaLegal } from '../legal/textosLegales';

export default function PaginaLegal({ ruta }: { ruta: RutaLegal }) {
  const pagina = PAGINAS_LEGALES[ruta];
  return (
    <>
      <h1>{pagina.titulo}</h1>
      {pagina.secciones.map((s) => (
        <section key={s.encabezado}>
          <h2>{s.encabezado}</h2>
          {s.parrafos.map((p) => <p key={p}>{p}</p>)}
        </section>
      ))}
    </>
  );
}
