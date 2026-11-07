# Procedimiento de traspaso de PRETSO

Orden de pasos para entregar el repositorio, los proyectos y la facturación sin cortar el servicio. Complementa el inventario de `acta-de-entrega.md`. Sin ids numéricos, sin correos personales y sin valores de secretos.

Destino (D5): organización de GitHub, principales de Google y cuenta de facturación de la Universidad. Ventana prevista: 24 a 27 de noviembre de 2026.

## 1. Prerrequisitos de la Universidad (solo personas)

- Una organización de GitHub con un owner que acepte la transferencia.
- Principales de Google (cuentas institucionales) para el rol Owner.
- Una cuenta de facturación con alguien que tenga `billing.user` o sea administrador.
- Contactos del DPO, del responsable de transparencia (RTD) y de TI: `[[PENDIENTE: nombres y canal, fuera del repositorio]]`.

## 2. IAM de Google Cloud

Andres invita a los principales de la Universidad como `roles/owner` en `pretso-database` y `pretso-prod`, y ellos aceptan. Lo hace Andres en la consola, porque los cambios de IAM los bloquea la sesión automatizada.

## 3. Facturación

La Universidad **cambia** la cuenta de facturación asociada a cada proyecto por la suya, **sin desvincular antes**. Si se desvincula, el proyecto pierde el plan Blaze y las Functions dejan de funcionar. Después la Universidad recrea el presupuesto y las alertas (50, 90 y 100 %, más previsión) en su cuenta. Lo hacen solo personas.

## 4. Cuentas de administración

La Universidad crea sus cuentas de Google. Con la autorización de Andres se asigna el claim con `scripts/asignar_claim_admin.py` (véase el runbook de operación, sección 2). Se prueba la entrada con Google.

## 5. Repositorio

1. Congelar las fusiones a `main`.
2. Andres transfiere el repositorio y el owner de la organización acepta.
3. Enseguida, con autorización de Andres (o por Andres en la consola, si la sesión lo bloquea):
   - actualizar la condición del provider WIF en los **dos** proyectos (nuevo identificador del propietario del repositorio) y el binding de `deploy-production` (nuevo sujeto `repo:<ORG>/PRETSO:environment:production`);
   - verificar que el identificador del repositorio no cambió;
   - verificar con `gh secret list` y `gh variable list` que se conservaron los secretos y las variables; si faltan, recargarlos (son identificadores, no claves);
   - actualizar la variable `APROBADORES_PROD`, los revisores del Environment `production` y `.github/CODEOWNERS` (este último, por PR);
   - correr `probar-identidad-negativa.yml` y luego un despliegue a staging en verde.
4. **No ejecutar `setup-oidc-gcp.sh`** (véase `docs/seguridad/inventario-secretos.md`, sección 4.1).
5. Qué se conserva en una transferencia de GitHub.com (secretos, Environments, rulesets): `[[PENDIENTE: verificar en la documentación oficial de GitHub vigente el día del traspaso; la consulta previa solo encontró documentación de GitHub Enterprise Server]]`.
6. Tras el traspaso hay que actualizar también la URL de clonación en el `README.md` y los enlaces a `AndresAlberdi/PRETSO` en los documentos.

## 6. Ventana de garantía y retiro

Hasta la aprobación del informe final, Andres conserva un acceso residual. En la fecha escrita en el acta se retiran sus claims, su IAM y el colaborador adicional del repositorio. Lo hace la Universidad o Andres.

## 7. Opcional: organización de Google Cloud

Solo si la Universidad lo exige, y después de revisar sus políticas de organización: `iam.allowedPolicyMemberDomains` puede rechazar los principales de WIF y `gcp.resourceLocations` también puede afectar. Sin esa exigencia, los proyectos se quedan donde están.

## 8. Cierre

Se completa el acta de entrega (fechas, quién recibe, evidencia), se actualizan los propietarios en `docs/seguridad/inventario-secretos.md` y se firma.
