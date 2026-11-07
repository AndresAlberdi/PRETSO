# Arquitectura del Sistema - PRETSO

Este documento describe la arquitectura y los patrones de diseño subyacentes de la aplicación PRETSO, a fin de guiar a los desarrolladores en la compresión de su estructura técnica y lógica de negocio.

## 1. Visión General del Sistema

PRETSO utiliza una arquitectura **Serverless / Backend-as-a-Service (BaaS)** mediante **Firebase**. Toda la lógica de presentación y el ruteo ocurren en el cliente (SPA - Single Page Application), mientras que el almacenamiento de datos, autenticación y despliegue están delegados a la nube de Google.

### Diagrama de Alto Nivel
- **Frontend (React 19, TypeScript, Vite)**: Maneja la UI, estados de componentes y comunicación directa con la API de Firebase.
- **Firebase Authentication**: Gestiona las credenciales de usuarios.
- **Firebase Firestore (NoSQL)**: Almacena los registros estructurados en colecciones con reglas estrictas de seguridad.
- **Firebase Hosting**: Entrega el paquete compilado (archivos estáticos, CSS, JS).
- **Cloud Functions (2.ª generación)**: una sola función callable, `listAccounts` (véase la sección 5).
- **App Check (reCAPTCHA Enterprise)**: acredita que las peticiones a Firestore vienen de la aplicación; en monitoreo salvo que la consola indique otra cosa.

Hay dos ambientes: staging (`pretso-database`) y producción (`pretso-prod`); la configuración de cada uno está en `src/environments/<ambiente>/`.

## 2. Estructura del Directorio Frontend (`/src`)

El código fuente del frontend sigue una estructura modular orientada a componentes lógicos:

- `/src/components/`: Componentes de UI reutilizables (Modales, Tooltips, Tablas, Formularios de creación/edición, SearchBar).
- `/src/context/`: Contextos globales de React. `AdminContext` maneja el estado de la sesión, los permisos y habilita/deshabilita funciones de edición (modo lectura o administrador).
- `/src/pages/`: Componentes principales de enrutamiento que representan las vistas completas (ManejoCaja, Salarios, CorpusChristi, etc.).
- `/src/hooks/`: Hooks personalizados de React, destacando `useSortableTable` para unificar la lógica de ordenamiento de tablas.
- `/src/utils/`: Funciones puras compartidas (limpieza de datos de Firebase `utils.ts`, sistema de logs de auditoría `audit.ts`, `dataset/` para el ZIP de XML, `busquedaGuia/` para la búsqueda guiada, `backup.ts` para el volcado XML y la copia a Drive).
- `/functions/`: Cloud Functions (TypeScript, proyecto npm propio).
- `/scripts/`: utilidades operativas en Python (por ejemplo `asignar_claim_admin.py`).
- `/src/__tests__`: Batería de pruebas automatizadas (Vitest + jsdom).

## 3. Patrones de Diseño Utilizados

### 3.1. Hook de Ordenamiento (`useSortableTable.ts`)
Toda la lógica compleja para ordenar arreglos de objetos por claves específicas está abstraída en este Hook. Devuelve los datos ordenados (`items`), la función para solicitar un cambio de orden (`requestSort`) y la configuración actual del ordenamiento (`sortConfig`).

### 3.2. Contexto de Administración (`AdminContext`)
Evita el *prop-drilling* del estado de autenticación. Escucha los cambios del estado de Firebase Auth (`onAuthStateChanged`) y expone un booleano `isEditMode`. El privilegio de administrador es el custom claim `admin === true` (asignado con `scripts/asignar_claim_admin.py`); `AdminContext` lo lee con `getIdTokenResult(user, true)` mediante `hasAdminClaim`, y las reglas de Firestore y la función `createReaderUser` aplican la misma condición. Quien no tiene el claim ve la aplicación en solo lectura.

### 3.3. Modales Genéricos
La creación y edición de registros comparte mucha estructura repetitiva. Se implementaron `GenericCreateModal` y `GenericEditModal`.
Estos componentes reciben dinámicamente el nombre de la colección objetivo, leen un esquema visual (`fieldDefinitions`) e iteran para generar dinámicamente los formularios (inputs de texto, numéricos o textareas). Esto previene la duplicación masiva de código en cada pantalla (Salarios, Transacciones, etc).

## 4. Gestión de Datos y Búsqueda

### Fetching (Obtención de Datos)
Los componentes de página en `/pages` usan el hook `useEffect` para consultar las colecciones de Firestore al montarse. Los datos en crudo (documentos de Firebase) pasan por la función utilitaria `cleanFirebaseData` que unifica los tipos y mapea el `id` para el frontend.

### Motor de Búsqueda (SearchBar)
El componente `SearchBar` se introdujo para permitir el filtrado por múltiples factores simultáneos.
Mantiene un arreglo de "filtros" aplicados (por ejemplo: `[{ category: 'Ciudad', query: 'Lima' }, { category: 'Año', query: '1600' }]`). El componente padre evalúa este arreglo cruzándolo con los datos en memoria para generar el subconjunto `searchResults`.

## 5. Roles y Reglas de Seguridad (Firestore)
Roles reales:
- **Visitante** (sin sesión): lectura pública de solo lectura del corpus. `[[PENDIENTE: vigente cuando se fusionen las reglas y las rutas del plan de lectura pública; hoy las reglas exigen sesión y la aplicación pide ingresar]]`.
- **Lector**: custom claim `reader === true`; solo lectura.
- **Administración**: custom claim `admin === true`; lectura y escritura, y acceso a Auditoría, Gestión de Usuarios y Administración.

Las reglas están en `firestore.rules` en la raíz del proyecto. Estas aseguran que:
- La lectura exige hoy el claim `admin` o `reader`; `logs` y `users` solo los lee la administración. Un usuario autenticado sin claim no lee nada.
- Solamente la administración (claim `admin`) escribe, actualiza o elimina en las colecciones; `logs` solo admite altas válidas (autor = correo del token, hora del servidor).
- Bloquea interacciones no autorizadas a nivel de servidor, independientemente de la interfaz que use el cliente.

### Lista de cuentas (`listAccounts`)
La pantalla «Gestión de Usuarios» muestra las cuentas (correo, rol, acceso con Google o contraseña, estado y último acceso) a partir de la función callable `listAccounts` (`functions/src/index.ts`, 2.ª generación, `us-central1`). Solo responde si el token trae `admin === true`; no recibe parámetros y no devuelve uid, hashes ni claims crudos (contrato en `functions/src/accounts.ts`, validado en `src/utils/accounts.ts`). Corre con la cuenta de servicio `fn-usuarios@<proyecto>`, que solo lee Authentication (`roles/firebaseauth.viewer`). Se despliega solo con `functions:listAccounts`, y la antigua `createReaderUser` se eliminó del código (2026-11-02); la CSP de `firebase.json` permite solo los hosts de esa función.

## 6. Despliegue y Pipeline CI/CD

El despliegue lo hace GitHub Actions (`.github/workflows/ci-node-firebase.yml`), con federación de identidad (WIF/OIDC) y sin claves de larga duración:
1. **Pull request**: pruebas (Vitest), lint (oxlint), build (`tsc` y Vite) y análisis de seguridad estático.
2. **Fusión a `main`** (squash): despliegue automático a staging (por defecto Hosting y reglas de Firestore; las Functions entran según la variable de repositorio `FIREBASE_DEPLOY_ONLY`; `[[PENDIENTE: confirmar su valor actual con gh variable list]]`).
3. **Tag `vX.Y.Z`**: despliegue a producción tras la aprobación humana del Environment `production`.

`deploy.sh staging` permite el despliegue manual a staging. Detalle de operación y rollback: `docs/operacion/runbook-operacion.md` y `docs/produccion/runbook-rollback.md`. Secretos, variables y WIF: `docs/seguridad/inventario-secretos.md`.
