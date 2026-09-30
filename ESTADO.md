# ESTADO — PRETSO

Registro de jornada. El detalle técnico está en `PILOTO.md`; aquí solo el estado y lo que necesita a Andres.

## Coordinación 2026-09-29

*Actualizado el 2026-09-30.*

- **Fase 0: hecha.** Rama `wip/2026-09-29-salvaguarda` en origin: **no**. Según el arranque de PRETSO, la salvaguarda fue la rama `chore/modelo-por-rol` (commit `8494e26`: la v1 tal como estaba en disco), que se subió a origin y ya se fusionó. La carpeta principal **conserva** los 7 archivos de la v1 sin commitear (no se limpiaron: `checkout`, `restore`, `stash` y `clean` están prohibidos en la orden).
- **Fase 1: hecha.** PR #33 (modelo por rol v1 + v2, regla 3 corregida y ajuste de la plantilla) **fusionado el 2026-09-30** (`cb6c972`) con autorización de Andres; aprobado por SeguridadGeneral el 29/09. Redesplegó staging con el mismo código: run, humo y ZAP en verde. Ningún agente en `haiku`.
- **Fase 2:**
  - **Bloque 4 (Dependabot): hecho.** PR #34 **fusionado** (`8e94ede`). Aparecieron avisos nuevos que rompían la CI de `main` (18 HIGH); HIGH 18 → 0, MEDIUM 9 → 5. Excepción de `@grpc/grpc-js` (sin parche posible) aprobada por Andres, vence el 2026-12-29. Quedan los `uuid` (MEDIUM, compromiso al 2026-10-26). **Pendiente:** PR #36 de Dependabot (`@grpc/grpc-js` en `functions/`) y el bloque `pip` de `dependabot.yml` (autorizado, sin hacer).
  - **Bloque 3 (gobierno): hecho** como verificación de solo lectura, en `PILOTO.md`. No se tocó el ruleset.
  - **Respaldo automático de Firestore: hecho en `pretso-database`** (PITR, protección contra borrado y respaldo diario de 30 días), verificado. **Falta en `pretso-prod`.**
  - **Bloque 5 (plan): escrito** en `docs/produccion/plan-migracion-pretso-prod.md`. Andres eligió el **camino B** (hace falta `pretso-prod`). Nada del plan se ejecutó todavía. El 30/09 se creó por error `pretso-prod-d8a68` y Andres lo borró; se conserva `pretso-prod`.
  - **«Entrega de octubre»: escrita** en `PILOTO.md`; el contrato sigue sin estar escrito en ningún archivo y lo dicho es inferido.
  - **Documentación: PR #35 abierto**, sin fusionar.
- **Requiere a Andres** (yo ejecuto cada punto con su «sí»):
  1. **Fusionar #35** (documentación; redespliega staging con el mismo código).
  2. **Limpiar la carpeta principal** (ya se fusionó #33): sus 7 archivos de la v1 impiden actualizar `main`. Con su «sí»: `git restore -- .claude/agents/deploy.md .claude/agents/devsecops.md .claude/agents/seguridad.md CLAUDE.md`, borrar `implementador.md`, `planificador.md`, `revisor-codigo.md` y esta copia de `ESTADO.md` (sin versionar), y `git merge --ff-only origin/main`.
  3. **Respaldo en `pretso-prod`** (PITR, protección y respaldo diario de 30 días) antes de cargarle datos.
  4. **Paso 1 del plan** (configuración de Firebase por ambiente): lo preparo como PR abierto; para fusionarlo hay que definir las variables del repositorio de `staging` (escritura en GitHub).
  5. **PR #36 de Dependabot**: ¿lo reviso y fusiono?
  6. **REP-03**: aceptar como «N/A justificado» el ruleset con 0 aprobaciones (un solo dueño) o dar escritura a una segunda cuenta.
  7. **Cuántos usuarios de autenticación hay** (paso 5 del plan).
  8. **Bloque `pip` en `dependabot.yml`**: autorizado; lo hago como PR pequeño cuando me lo indique.
- **Costo:** sesión principal en Sonnet 5.5, sin subagentes ni Opus. Unos 10 runs de CI de PR (~10 min c/u) y **4 despliegues de staging** (los de las fusiones de #34 y #33 y los de la jornada anterior). Sin consultas pagas. El respaldo de Firestore se cobra por almacenamiento; con este corpus se espera un monto pequeño, **por confirmar en la consola de facturación**.
