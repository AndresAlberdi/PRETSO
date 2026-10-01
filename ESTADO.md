# ESTADO — PRETSO

Registro de jornada. El detalle técnico está en `PILOTO.md`; aquí solo el estado y lo que necesita a Andres.

## Coordinación 2026-09-29

*Actualizado el 2026-09-30 (cierre).*

- **Fase 0: hecha.** Rama `wip/2026-09-29-salvaguarda` en origin: **no**. Según el arranque de PRETSO, la salvaguarda fue la rama `chore/modelo-por-rol` (commit `8494e26`: la v1 tal como estaba en disco), que se subió a origin y ya se fusionó. La carpeta principal **conserva** los 7 archivos de la v1 sin commitear (no se limpiaron: `checkout`, `restore`, `stash` y `clean` están prohibidos en la orden).
- **Fase 1: hecha.** PR #33 (modelo por rol v1 + v2, regla 3 corregida y ajuste de la plantilla) **fusionado el 2026-09-30** (`cb6c972`) con autorización de Andres; aprobado por SeguridadGeneral el 29/09. Redesplegó staging con el mismo código: run, humo y ZAP en verde. Ningún agente en `haiku`.
- **Fase 2:**
  - **Bloque 4 (Dependabot): hecho.** PR #34 **fusionado** (`8e94ede`). Aparecieron avisos nuevos que rompían la CI de `main` (18 HIGH); HIGH 18 → 0, MEDIUM 9 → 5. Excepción de `@grpc/grpc-js` (sin parche posible) aprobada por Andres, vence el 2026-12-29. Quedan los `uuid` (MEDIUM, compromiso al 2026-10-26). PR #36 de Dependabot (`@grpc/grpc-js` 1.14.5 en `functions/`) **fusionado** (`0764cbc`). **Pendiente:** el bloque `pip` de `dependabot.yml` (autorizado, sin hacer).
  - **Bloque 3 (gobierno): hecho** como verificación de solo lectura, en `PILOTO.md`. No se tocó el ruleset.
  - **Respaldo automático de Firestore: hecho en `pretso-database`** (PITR, protección contra borrado y respaldo diario de 30 días), verificado. **También en `pretso-prod`** (activado y verificado el 2026-09-30, con la base aún vacía).
  - **Bloque 5 (plan): escrito** en `docs/produccion/plan-migracion-pretso-prod.md`. Andres eligió el **camino B** (hace falta `pretso-prod`). Nada del plan se ejecutó todavía. El 30/09 se creó por error `pretso-prod-d8a68` y Andres lo borró; se conserva `pretso-prod`.
  - **«Entrega de octubre»: escrita** en `PILOTO.md`; el contrato sigue sin estar escrito en ningún archivo y lo dicho es inferido.
  - **Documentación: PR #35 fusionado** (`782e1e3`).
- **Limpieza de la carpeta principal: hecha** el 2026-09-30 con autorización de Andres. Antes de tocar nada se comprobó, archivo por archivo, que lo retirado ya estaba en `main` (cinco archivos idénticos; `CLAUDE.md` y `planificador.md` eran la versión anterior) y se guardó una copia de respaldo. La carpeta quedó en `main` al día; los tres worktrees de PR ya fusionados se retiraron tras comprobar que sus commits estaban dentro de lo fusionado. `ESTADO.md` se conserva como modificación sin commitear, porque esta copia es más reciente que la de git.
- **PR #37 y #38 fusionados el 2026-09-30** con autorización de Andres: #37 (`3a324cc`, `pip` en `dependabot.yml`) y #38 (`63b9a83`, paso 1 del plan: configuración de Firebase y Client ID por ambiente). El run de `main` terminó en verde, incluido Gitleaks sobre el push. El sitio sirve el mismo bundle que un build local de staging (idéntico por sha256) y carga sin errores. **Paso 1 del plan: hecho.** La carpeta principal está en `main` (`63b9a83`) y no quedan worktrees.
- **Dependabot (abrió PR al activarse el bloque `pip`): #39, #40 y #41 fusionados el 2026-09-30** con autorización de Andres, de a uno y tras revisarlos: #40 (`1c4c8a4`, `oxlint` 1.85.0, solo desarrollo), #39 (`dcf1855`, `firebase-admin` 7.7.0 en `requirements.txt`, probado en un entorno limpio porque la CI no lo ejecuta) y #41 (`92c9cc7`, SHA de `snyk/actions`, cuya comparación muestra un solo commit que cambia su `CODEOWNERS`). Cada fusión desplegó staging con el mismo código; los tres runs, en verde, y el sitio responde 200. No queda ningún PR abierto ni rama remota distinta de `main`.
- **Requiere a Andres** (yo ejecuto cada punto con su «sí»):
  1. **Comprobación humana del sitio tras #38:** abrir https://pretso-database.web.app, iniciar sesión y cargar una pantalla con datos.
  2. **Paso 3 del plan** (registrar la app web en `pretso-prod`, restringir su apiKey y crear su cliente OAuth) y luego el **paso 2** (endurecer `pretso-prod`: auditoría, presupuesto, dominios de Auth). Son cambios de GCP; cada uno con su «sí». Al completar el paso 3 hay que invertir dos pruebas y cuatro valores vacíos de `src/environments/production/`.
  3. **REP-03**: aceptar como «N/A justificado» el ruleset con 0 aprobaciones (un solo dueño) o dar escritura a una segunda cuenta.
  4. **Cuántos usuarios de autenticación hay** (paso 5 del plan).
- **Documentación al día:** `PILOTO.md`, este archivo y el plan de migración se actualizaron en un PR de documentación el 2026-09-30, con el estado de los controles bloqueantes y el registro de la jornada del 28/09, que faltaba.
- **Costo:** sesión principal en Sonnet 5.5; para el paso 1 se usaron dos agentes, `implementador` (Sonnet) y `revisor-codigo` (Opus, dos pasadas), según `CLAUDE.md`. Alrededor de 20 runs de CI de PR (~10 min c/u) y **9 despliegues de staging** el 30/09, uno por fusión; ninguno a producción. Sin consultas pagas. El respaldo de Firestore se cobra por almacenamiento; con este corpus se espera un monto pequeño, **por confirmar en la consola de facturación**.
