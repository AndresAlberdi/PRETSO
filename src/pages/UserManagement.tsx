import AccountList from "../components/AccountList";

// Cuentas con acceso a PRETSO. El ingreso es solo con Google: los roles (administrador o lector) se
// asignan en el servidor con el script de claims; aquí solo se consultan.
export default function UserManagement() {
  return (
    <div style={{ maxWidth: '900px', margin: '2rem auto', padding: '2rem', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
      <h1 style={{ marginTop: 0, marginBottom: '0.83em', fontSize: '1.5em', color: 'var(--primary-color)' }}>Cuentas con acceso</h1>
      <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
        El ingreso a PRETSO es solo con una cuenta de Google autorizada. Los administradores pueden editar los datos; los lectores solo consultarlos. Los roles los asigna la administración técnica del proyecto.
      </p>
      <AccountList refreshSignal={0} />
    </div>
  );
}
