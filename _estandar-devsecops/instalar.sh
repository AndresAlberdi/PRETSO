#!/usr/bin/env bash
# Instala en su ubicación real los archivos que el asistente remoto no puede
# escribir directamente (.github/, .claude/, .pre-commit-config.yaml).
# Ejecutar UNA vez desde la raíz del proyecto:  bash _estandar-devsecops/instalar.sh
set -Eeuo pipefail
cd "$(dirname "$0")/.."
mkdir -p .github .claude
cp -r _estandar-devsecops/github/. .github/
cp -r _estandar-devsecops/claude/. .claude/
cp _estandar-devsecops/pre-commit-config.yaml .pre-commit-config.yaml
chmod +x deploy.sh security-local.sh
rm -rf _estandar-devsecops
echo "Instalado: .github/ (workflows, config, rulesets), .claude/ (agentes y skills), .pre-commit-config.yaml"
echo "Siguiente paso: PILOTO.md, Fase 0 (pre-commit install) y Fase 1."
