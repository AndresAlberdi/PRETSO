import { useEffect, useState } from 'react';
import {
  accountsErrorMessage, fetchAccounts, formatLastSignIn, MAX_ACCOUNTS_SHOWN, PROVIDER_LABELS, ROLE_LABELS,
  type ListAccountsResult,
} from '../utils/accounts';
import { loginErrorCode } from '../utils/authErrors';

type Estado = { tipo: 'cargando' } | { tipo: 'listo'; datos: ListAccountsResult } | { tipo: 'error'; mensaje: string };

// Lista de cuentas (correo, rol, acceso, estado y último acceso). Los datos vienen de la función
// `listAccounts`, solo para administradores; nunca incluyen uid ni contraseñas.
export default function AccountList({ refreshSignal }: { refreshSignal: number }) {
  const [estado, setEstado] = useState<Estado>({ tipo: 'cargando' });
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    let vigente = true;
    setEstado({ tipo: 'cargando' });
    fetchAccounts()
      .then((datos) => { if (vigente) setEstado({ tipo: 'listo', datos }); })
      .catch((err: unknown) => {
        if (!vigente) return;
        console.error('Error al listar usuarios:', loginErrorCode(err));
        setEstado({ tipo: 'error', mensaje: accountsErrorMessage(err) });
      });
    return () => { vigente = false; };
  }, [refreshSignal, recarga]);

  const cargando = estado.tipo === 'cargando';

  return (
    <section style={{ marginTop: '2rem' }} aria-labelledby="titulo-cuentas">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <h2 id="titulo-cuentas" style={{ margin: 0, fontSize: '1.2em' }}>Cuentas registradas</h2>
        <button type="button" className="boton boton-secundario" disabled={cargando} onClick={() => setRecarga((n) => n + 1)}>
          Actualizar lista
        </button>
      </div>
      {cargando && <output>Cargando usuarios...</output>}
      {estado.tipo === 'error' && <div role="alert" className="acceso-error" style={{ marginTop: '1rem' }}>{estado.mensaje}</div>}
      {estado.tipo === 'listo' && (
        estado.datos.accounts.length === 0 ? <p>No hay cuentas registradas.</p> : (
          <div style={{ overflowX: 'auto', marginTop: '1rem' }}>
            <table>
              <caption className="visually-hidden">Cuentas de acceso</caption>
              <thead>
                <tr>
                  <th scope="col">Correo</th>
                  <th scope="col">Rol</th>
                  <th scope="col">Acceso con</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Último acceso</th>
                </tr>
              </thead>
              <tbody>
                {estado.datos.accounts.map((c, i) => (
                  <tr key={c.email ?? `sin-correo-${i}`}>
                    <td>{c.email ?? '(sin correo)'}</td>
                    <td>{ROLE_LABELS[c.role]}</td>
                    <td>{c.providers.length ? c.providers.map((p) => PROVIDER_LABELS[p]).join(', ') : '—'}</td>
                    <td>{c.disabled ? 'Deshabilitada' : 'Habilitada'}</td>
                    <td>{formatLastSignIn(c.lastSignInTime)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
      {estado.tipo === 'listo' && estado.datos.truncated && (
        <p>Se muestran las primeras {MAX_ACCOUNTS_SHOWN} cuentas.</p>
      )}
    </section>
  );
}
