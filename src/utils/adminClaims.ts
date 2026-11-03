// Privilegio de administrador: solo el custom claim `admin` con valor booleano
// verdadero. Cadenas como 'true' o números no lo conceden (igual que las reglas).
export function hasAdminClaim(claims: Record<string, unknown> | null | undefined): boolean {
  return claims?.admin === true;
}

// Lector: solo `reader` con valor booleano verdadero (igual que firestore.rules).
export function hasReaderClaim(claims: Record<string, unknown> | null | undefined): boolean {
  return claims?.reader === true;
}

// Administración solo por Google: el proveedor con el que se abrió ESTA sesión (claim
// firebase.sign_in_provider). Lista blanca: cualquier otro valor, incluido null, no habilita.
export function isAllowedAdminProvider(provider: string | null | undefined): boolean {
  return provider === 'google.com';
}
