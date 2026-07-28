#!/bin/bash
set -e

echo "=== [1/4] Ejecutando pruebas unitarias locales ==="
npm run test

echo "=== [2/4] Ejecutando análisis de vulnerabilidades con Snyk ==="
if snyk test; then
  echo "✔ Análisis de Snyk completado sin vulnerabilidades críticas."
else
  echo "⚠ Advertencia: Snyk detectó vulnerabilidades. Por favor revíselas antes de publicar en producción."
  # Do not halt if there are warnings, but let the user know. 
  # If you want to block on security issues, keep 'set -e' active.
fi

echo "=== [3/4] Compilando y publicando reglas de seguridad, Cloud Functions y archivos web en Firebase ==="
npm run build
cd functions && npm run build && cd ..
firebase deploy --only firestore:rules,hosting,functions --non-interactive

echo "=== [4/4] Confirmando y subiendo cambios a GitHub ==="
git add .
if git diff-index --quiet HEAD --; then
  echo "No hay cambios pendientes por commitear."
else
  COMMIT_MSG="${1:-feat: actualización general y refactorización}"
  git commit -m "$COMMIT_MSG"
fi

echo "Intentando realizar push a GitHub..."
if git push origin master; then
  echo "✔ Cambios publicados con éxito en GitHub."
else
  echo "⚠ No se pudo hacer push a GitHub (verifique si el repositorio remoto 'origin' está configurado y accesible)."
fi

echo "=== ¡Despliegue finalizado! ==="
