// Privilegio de administrador: solo el custom claim `admin` con valor booleano
// verdadero. Cadenas como 'true' o números no lo conceden (igual que las reglas).
export function hasAdminClaim(claims: Record<string, unknown> | null | undefined): boolean {
  return claims?.admin === true;
}

// Lector: solo `reader` con valor booleano verdadero (igual que firestore.rules).
export function hasReaderClaim(claims: Record<string, unknown> | null | undefined): boolean {
  return claims?.reader === true;
}
