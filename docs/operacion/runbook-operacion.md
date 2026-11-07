# Runbook de operación de PRETSO

Tareas periódicas y de administración. Para fallos, rollback e incidentes véase [`docs/produccion/runbook-rollback.md`](../produccion/runbook-rollback.md). Sin ids numéricos, sin correos personales y sin valores de secretos.

Variables usadas abajo: `PROYECTO` es `pretso-database` (staging) o `pretso-prod` (producción). Los cambios en producción los autoriza una persona; la tabla de comandos de `CLAUDE.md` rige para el repositorio.

## 1. Quién hace qué

- Lo que exige a una persona (aprobar el Environment `production`, IAM, facturación, consola) lo hace la persona designada por la Universidad.
- Lo demás puede hacerse desde un terminal con `gcloud` y `gh` autenticados con cuentas de usuario.

## 2. Altas y bajas de administradores

El privilegio de administrador es el custom claim `admin === true` (véase `ARCHITECTURE.md`, sección 3.2). Las cuentas inician sesión con Google; la cuenta debe existir ya en Authentication, porque el registro abierto está deshabilitado (`disabledUserSignup`).

```bash
# Ver el cambio previsto (solo lectura)
python3 scripts/asignar_claim_admin.py --proyecto "$PROYECTO" --correo <cuenta>
# Alta
python3 scripts/asignar_claim_admin.py --proyecto "$PROYECTO" --correo <cuenta> --aplicar
# Baja (también revoca los tokens de refresco)
python3 scripts/asignar_claim_admin.py --proyecto "$PROYECTO" --correo <cuenta> --quitar --aplicar
```

Requiere credenciales de usuario (`gcloud auth application-default login`). El script imprime el correo: no pegar su salida en canales públicos. Un token ya emitido sigue siendo válido hasta una hora. Limitaciones y cuenta comprometida: `runbook-rollback.md`, sección 2.4 y 5.2. Tras una baja, deshabilitar también la cuenta en la consola de Authentication y retirar su acceso a GitHub y a GCP.

El claim `reader` (lector) no lo gestiona ese script: `[[PENDIENTE: no hay procedimiento operativo documentado para asignarlo; el runbook de rollback lo reconoce como hueco]]`.

## 3. App Check

- Proveedor: reCAPTCHA Enterprise; la site key de cada ambiente está en el código (`src/environments/<ambiente>/firebase.ts`) y es un identificador público.
- Estado documentado al 2026-10-03: modo monitoreo (`UNENFORCED`) en ambos proyectos. `[[PENDIENTE: confirmar en la consola de Firebase el estado actual de cada proyecto; el bloqueo (ENFORCED) de Firestore en pretso-prod está previsto en la publicación]]`.
- Cambiar entre `UNENFORCED` y `ENFORCED`: consola de Firebase, App Check, Firestore. Si el bloqueo deja la aplicación sin datos (clave o dominio mal configurados), volver a `UNENFORCED` basta y surte efecto en minutos.
- Desarrollo local: exige un token de depuración en `VITE_APPCHECK_DEBUG_TOKEN` (solo con `npm run dev`; cualquier build o prueba falla si la variable tiene valor). El token es un secreto: no se versiona.

## 4. Presupuesto

El presupuesto con alertas (50, 90 y 100 % y previsión) vive en la cuenta de facturación, no en el proyecto. Tras el traspaso lo recrea la Universidad en su cuenta (`procedimiento-traspaso.md`, paso 3). Revisar los avisos cada mes. Cambiar la cuenta de un proyecto sin desvincularlo.

## 5. `security.txt`: renovar `Expires`

`[[PENDIENTE: el archivo public/.well-known/security.txt aún no existe en el repositorio; lo crea el PR de la tarea F2. Cuando exista, completar esta sección con su ruta]]`. Regla: el campo `Expires` de RFC 9116 debe renovarse antes de su fecha (recomendado: calendario con aviso 30 días antes), por PR a `main`, y se verifica con `curl` sobre la URL pública.

## 6. Respaldos y restauración

- Protecciones activas desde el 2026-09-30 en ambos proyectos: PITR con ventana de 7 días, protección contra borrado y respaldo diario con retención de 30 días.
- Restaurar o clonar siempre a una **base nueva**; nunca sobre la base afectada. Comandos, advertencias y limitaciones: `runbook-rollback.md`, sección 2.3.
- Copia lógica adicional: la pantalla «Administración» descarga el volcado XML o lo guarda en Google Drive (requiere el cliente OAuth de Drive del proyecto). El dataset de investigación se genera como ZIP desde la misma pantalla.

## 7. Dependencias, Dependabot y excepciones

- Dependabot (`.github/dependabot.yml`) abre PR cada lunes para npm (raíz y `functions/`) y para los pines de GitHub Actions. Cada PR pasa las pruebas y el análisis estático antes de fusionarse (squash).
- Local: `npm ci && npm run lint && npm test`; en `functions/`, `npm ci && npm run build`; `./security-local.sh` sin CRITICAL ni HIGH no exceptuados.
- **Excepciones de seguridad (`.devsecops.yml`)** que vencen y obligan a revisión:
  - **2026-12-25**: cuatro hallazgos de gitleaks sobre claves web de Firebase (identificadores públicos por diseño). Control real: apiKey restringida por referente y por API, y App Check. Al vencer, comprobar ambos y renovar con justificación o eliminar.
  - **2026-12-29**: `CKV_GHA_7` de checkov (entradas de `workflow_dispatch`). Al vencer, revisar que ninguna entrada se interpole en un script y renovar o eliminar.
- Toda excepción nueva o renovada necesita `justificacion`, `aprobado_por`, `creado` y `vence` (máximo 90 días), y la aprueba el propietario. `aprobado_por` hoy nombra a Andres: tras el traspaso lo aprueba la Universidad.

## 8. Emergencia: cerrar la lectura pública

Aplica cuando las reglas de Firestore declaren la lectura pública del corpus (`[[PENDIENTE: depende del PR de reglas L1; hasta que se fusione, las reglas actuales exigen administrador o claim reader]]`). Si hay extracción abusiva, costo anómalo o un dato que no debía ser público:

1. Una persona con acceso a la consola de Firebase abre Firestore, Reglas, y **publica la versión anterior** de las reglas (el historial de versiones lo permite). Es inmediato.
2. Después se concilia el repositorio con un PR que revierta el cambio de reglas (`runbook-rollback.md`, sección 2.2); en staging basta revertir y fusionar.
3. Registrar el incidente como issue con la etiqueta `incidente`.

## 9. Tareas periódicas

| Frecuencia | Tarea |
|---|---|
| Semanal | Revisar y fusionar los PR de Dependabot |
| Mensual | Revisar el presupuesto y el estado de App Check |
| Antes de cada tag | `/pase-a-produccion` y la lista de `docs/seguridad/inventario-secretos.md` |
| Antes de 25/12 y 29/12 | Revisar las excepciones (sección 7) |
| Antes de `Expires` | Renovar `security.txt` (sección 5) |
