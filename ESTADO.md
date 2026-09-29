# ESTADO — PRETSO

Registro de jornada. El detalle técnico está en `PILOTO.md`; aquí solo el estado y lo que necesita a Andres.

## Coordinación 2026-09-29

- **Fase 0: hecha.** Rama `wip/2026-09-29-salvaguarda` en origin: **no**. Según el arranque de PRETSO, la salvaguarda fue la rama `chore/modelo-por-rol` (commit `8494e26`: la v1 exactamente como estaba en disco), ya en origin. La carpeta principal **conserva** los 7 archivos de la v1 sin commitear (no se limpiaron: `checkout`, `restore`, `stash` y `clean` están prohibidos en la jornada).
- **Fase 1: PR #33 abierto, CI verde, `CLEAN`, sin fusionar.** Tres commits: v1, v2 y la corrección de la regla 3 (`/model opus` a secas guardaba el modelo como valor por defecto). Veredicto de SeguridadGeneral: **aprobado**, con un ajuste recomendado que no bloquea. Ningún agente en `haiku`. Se deja abierto porque fusionar redespliega `pretso-database`, el sitio en uso.
- **Fase 2:**
  - **Bloque 4 (Dependabot): PR #34 abierto, CI verde, `CLEAN`, sin fusionar.** Cierra `qs` y `undici`: MEDIUM 9 → 5. Los 5 restantes (`uuid`) no se pueden cerrar sin subir `exceljs` o `firebase-admin`.
  - **Bloque 3 (gobierno): hecho** como verificación de solo lectura, registrada en `PILOTO.md`. No se tocó el ruleset. Hallazgo: siete controles bloqueantes del checklist están en rojo (no afectan al sitio actual; sí a un primer tag).
  - **Bloque 5 (plan): escrito** en `docs/produccion/plan-migracion-pretso-prod.md`. No se ejecutó nada. Hallazgo clave: la aplicación tiene `pretso-database` escrito fijo en el código; un tag hoy publicaría en `pretso-prod` un sitio que lee y escribe en `pretso-database`.
  - **«Entrega de octubre»: escrita** en `PILOTO.md`. El contrato **no está escrito en ningún archivo**: lo que consta es inferido y espera la confirmación de Andres.
  - **Documentación: PR #35 abierto** (`ESTADO.md`, `PILOTO.md` y el plan), sin fusionar.
- **Requiere a Andres** (yo ejecuto cada punto con su «sí»):
  1. **Camino «A» o «B»**: ¿el contrato exige un entorno de producción separado (B) o basta el sistema arriba sobre `pretso-database` (A)? Con una palabra.
  2. **Respaldo automático de Firestore, hoy inexistente** (PITR, respaldo programado y protección contra borrado están desactivados en `pretso-database` y `pretso-prod`). Con su «sí» ejecuto sobre `pretso-database`: `gcloud firestore databases update --database='(default)' --enable-pitr --delete-protection --project pretso-database` y `gcloud firestore backups schedules create --database='(default)' --recurrence=daily --retention=30d --project pretso-database`. El costo por almacenamiento se confirma en la consola de facturación antes de activarlo.
  3. **Fusionar #33, #34 y #35** (en ese orden; cada uno redespliega staging con el mismo código y exige poner la rama al día tras el anterior). O esperar al próximo cambio real.
  4. **Ajuste recomendado por SeguridadGeneral en #33**: adoptar la introducción de la sección de delegación de la plantilla y marcar la fila `proyectos (Opus)` en `CLAUDE.md`. No lo apliqué por pedido de otra sesión; con su «sí» va como cuarto commit.
  5. **Limpiar la carpeta principal tras fusionar #33**: sus 7 archivos de la v1 (ya en origin) impedirían actualizar `main` sin conflicto. Con su «sí»: `git restore -- .claude/agents/deploy.md .claude/agents/devsecops.md .claude/agents/seguridad.md CLAUDE.md`, borrar `implementador.md`, `planificador.md` y `revisor-codigo.md` sin versionar, y `git merge --ff-only origin/main`.
  6. **REP-03**: aceptar como «N/A justificado» el ruleset con 0 aprobaciones (un solo dueño) o dar escritura a una segunda cuenta.
  7. **Cuántos usuarios de autenticación hay** (para el paso 5 del plan de migración, solo si es «B»).
  8. **Bloque `pip` en `dependabot.yml`** (hoy no cubre `requirements.txt`): un PR pequeño, si lo autoriza.
- **Costo:** sesión principal en Sonnet 5.5 desde el arranque, sin subagentes ni Opus. Unos 4 runs de CI de PR (~10 min c/u) y **ningún despliegue**. La mayor parte del tiempo fue esperar el CI y leer el checklist del estándar (272 líneas) para citar sus controles. Sin consultas pagas.
