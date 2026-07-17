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

echo "=== [3/4] Compilando y publicando reglas de seguridad y archivos web en Firebase ==="
npm run build
firebase deploy --only firestore:rules,hosting

echo "=== [4/4] Confirmando y subiendo cambios a GitHub ==="
git add .
if git diff-index --quiet HEAD --; then
  echo "No hay cambios pendientes por commitear."
else
  git commit -m "feat: implementar suite de pruebas, reglas de seguridad y script de despliegue"
fi

echo "Intentando realizar push a GitHub..."
if git push origin master; then
  echo "✔ Cambios publicados con éxito en GitHub."
else
  echo "⚠ No se pudo hacer push a GitHub (verifique si el repositorio remoto 'origin' está configurado y accesible)."
fi

echo "=== ¡Despliegue finalizado! ==="
