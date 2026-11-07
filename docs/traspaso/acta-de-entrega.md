# Acta de entrega de PRETSO

Este documento no contiene identificadores numéricos, correos de cuentas personales ni valores de secretos. Los datos de contacto se anotan fuera del repositorio.

Estado: **borrador previo al traspaso**. Fecha prevista de entrega: 24 a 27 de noviembre de 2026. Los campos `[[PENDIENTE: …]]` se completan el día del traspaso.

## 1. Partes y decisión de destino (D5)

- **Entrega:** Andres Alberdi, propietario actual del repositorio y de los dos proyectos.
- **Recibe:** la Universidad Ca' Foscari. Destino: una organización de GitHub, principales de Google (cuentas institucionales) y una cuenta de facturación de la Universidad.
- **Acceso residual de Andres:** se mantiene hasta la aprobación del informe final, con una fecha de retiro escrita en esta acta: `[[PENDIENTE: fecha de retiro]]`.
- **Organización de Google Cloud:** los proyectos solo se mueven a la organización de la Universidad si esta lo exige, y después de revisar sus políticas de organización (véase `procedimiento-traspaso.md`, paso 7).

## 2. Inventario de activos

La columna «Evidencia» se completa al entregar cada activo (captura, salida de un comando de solo lectura o enlace al PR). La columna «Recibe» nombra a la persona o al rol de la Universidad, sin correos personales.

| N.º | Activo | Detalle | Fecha | Recibe | Evidencia |
|---|---|---|---|---|---|
| 1 | Repositorio de GitHub | Código, 3 secretos de repositorio y 2 de Environment, variables, Environments `staging` y `production` con revisores, ruleset de `main`, `CODEOWNERS`, colaborador adicional, Dependabot y code scanning. Número de variables: `[[PENDIENTE: confirmar con gh variable list; el inventario del 2026-10-01 lista cinco]]` | | | |
| 2 | Proyecto `pretso-database` (staging) | Hosting `pretso-database.web.app`; Firestore con recuperación a un punto en el tiempo (PITR) y respaldos; Authentication; función `listAccounts` con la cuenta de servicio `fn-usuarios`; cuentas de servicio `deploy-staging` y las cuentas por defecto de App Engine y de Compute; pool WIF `github`; clave de reCAPTCHA Enterprise; apiKey restringida; cliente OAuth de Google Drive | | | |
| 3 | Proyecto `pretso-prod` (producción) | Lo mismo que staging, sin Functions por ahora, con la cuenta de servicio `deploy-production` y el presupuesto con alertas. **El presupuesto vive en la cuenta de facturación de Andres y no viaja con el proyecto.** | | | |
| 4 | Cuenta de facturación | De Andres a la de la Universidad | | | |
| 5 | Cuentas Google del proyecto | La cuenta personal de Andres usada por la sesión y la cuenta de administración del proyecto. Esta última es una cuenta personal: se entregan sus credenciales y su recuperación, o se reemplaza por una cuenta institucional. Decisión: `[[PENDIENTE: entregar o reemplazar]]` | | | |
| 6 | Dominio | Hoy solo `*.web.app`, que viaja con el proyecto. Un dominio propio de la Universidad sería trabajo nuevo, fuera de este traspaso | | | |
| 7 | Servicio de correo transaccional | No existe. Si se crea, irá en una cuenta de la Universidad | | | |
| 8 | Proyecto `pretso-platform` | Está en estado de borrado solicitado. Se confirma el borrado definitivo; no se transfiere | | | |
| 9 | Último ZIP del dataset | Generado desde la pantalla «Administración» (un XML por unidad de registro y un README en español) | | | |

## 3. Documentación entregada

- `README.md` y `ARCHITECTURE.md`.
- `estructura_datos.md` (esquema de las colecciones, dataset XML y búsqueda guiada).
- `docs/produccion/runbook-rollback.md` (rollback e incidentes) y `docs/operacion/runbook-operacion.md` (operación diaria).
- `docs/seguridad/inventario-secretos.md`: hay que sustituir al propietario «Andres Alberdi» por los nuevos propietarios al cerrar el traspaso.
- `.devsecops.yml`: las excepciones que contiene llevan `aprobado_por` con la cuenta actual; se revisan al traspasar (véase el runbook de operación, sección 7).
- `LICENSE`: no existe; el README declara «Todos los derechos reservados». Lo decide la Universidad.

## 4. Archivos que dependen del equipo de Andres

`CLAUDE.md`, `.claude/`, `Prompts/`, `ESTADO.md` y `PILOTO.md` contienen rutas absolutas del equipo de Andres y se usan con Claude Code. No son necesarios para compilar, probar ni desplegar la aplicación. La Universidad decide si los conserva (por ejemplo, para seguir trabajando con Claude Code), los adapta o los retira en un PR propio.

## 5. Qué hace cada parte

- **Solo personas:** aceptar transferencias e invitaciones, cambiar la facturación, entregar cuentas Google, aprobar Environments y firmar esta acta.
- **Con asistencia de Claude Code, con autorización previa de Andres:** documentos y PR, verificaciones de solo lectura, secretos y variables de GitHub, claims de administración y ajustes de WIF.

## 6. Advertencias

- **No ejecutar `setup-oidc-gcp.sh`** (inventario de secretos, sección 4.1): sobrescribe la condición del provider WIF y reabre el acceso amplio por repositorio.
- **Cambiar la cuenta de facturación sin desvincularla antes.** Si se desvincula, se pierde el plan Blaze y las Functions se detienen.
- Mientras no se actualice WIF tras transferir el repositorio, los despliegues fallan cerrados; el sitio sigue en línea.

## 7. Firmas

| Rol | Nombre | Fecha | Firma |
|---|---|---|---|
| Entrega (Andres Alberdi) | | | |
| Recibe (Universidad) | | | |
| DPO de la Universidad | | | |
