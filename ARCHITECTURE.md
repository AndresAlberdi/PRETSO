# Arquitectura del Sistema - PRETSO

Este documento describe la arquitectura y los patrones de diseño subyacentes de la aplicación PRETSO, a fin de guiar a los desarrolladores en la compresión de su estructura técnica y lógica de negocio.

## 1. Visión General del Sistema

PRETSO utiliza una arquitectura **Serverless / Backend-as-a-Service (BaaS)** mediante **Firebase**. Toda la lógica de presentación y el ruteo ocurren en el cliente (SPA - Single Page Application), mientras que el almacenamiento de datos, autenticación y despliegue están delegados a la nube de Google.

### Diagrama de Alto Nivel
- **Frontend (React)**: Maneja la UI, estados de componentes y comunicación directa con la API de Firebase.
- **Firebase Authentication**: Gestiona las credenciales de usuarios.
- **Firebase Firestore (NoSQL)**: Almacena los registros estructurados en colecciones con reglas estrictas de seguridad.
- **Firebase Hosting**: Entrega el paquete compilado (archivos estáticos, CSS, JS).

## 2. Estructura del Directorio Frontend (`/src`)

El código fuente del frontend sigue una estructura modular orientada a componentes lógicos:

- `/src/components/`: Componentes de UI reutilizables (Modales, Tooltips, Tablas, Formularios de creación/edición, SearchBar).
- `/src/context/`: Contextos globales de React. `AdminContext` maneja el estado de la sesión, los permisos y habilita/deshabilita funciones de edición (modo lectura o administrador).
- `/src/pages/`: Componentes principales de enrutamiento que representan las vistas completas (ManejoCaja, Salarios, CorpusChristi, etc.).
- `/src/hooks/`: Hooks personalizados de React, destacando `useSortableTable` para unificar la lógica de ordenamiento de tablas.
- `/src/utils/`: Funciones puras compartidas (limpieza de datos de Firebase `utils.ts`, sistema de logs de auditoría `audit.ts`).
- `/src/__tests__`: Batería de pruebas automatizadas (Vitest + jsdom).

## 3. Patrones de Diseño Utilizados

### 3.1. Hook de Ordenamiento (`useSortableTable.ts`)
Toda la lógica compleja para ordenar arreglos de objetos por claves específicas está abstraída en este Hook. Devuelve los datos ordenados (`items`), la función para solicitar un cambio de orden (`requestSort`) y la configuración actual del ordenamiento (`sortConfig`).

### 3.2. Contexto de Administración (`AdminContext`)
Evita el *prop-drilling* del estado de autenticación. Escucha los cambios del estado de Firebase Auth (`onAuthStateChanged`) y expone un booleano `isEditMode`. Si el usuario es `pretsodatabase@gmail.com`, `isEditMode` es `true`. Si es `lector@pretso.com`, la vista es solo de lectura.

### 3.3. Modales Genéricos
La creación y edición de registros comparte mucha estructura repetitiva. Se implementaron `GenericCreateModal` y `GenericEditModal`.
Estos componentes reciben dinámicamente el nombre de la colección objetivo, leen un esquema visual (`fieldDefinitions`) e iteran para generar dinámicamente los formularios (inputs de texto, numéricos o textareas). Esto previene la duplicación masiva de código en cada pantalla (Salarios, Transacciones, etc).

## 4. Gestión de Datos y Búsqueda

### Fetching (Obtención de Datos)
Los componentes de página en `/pages` usan el hook `useEffect` para consultar las colecciones de Firestore al montarse. Los datos en crudo (documentos de Firebase) pasan por la función utilitaria `cleanFirebaseData` que unifica los tipos y mapea el `id` para el frontend.

### Motor de Búsqueda (SearchBar)
El componente `SearchBar` se introdujo para permitir el filtrado por múltiples factores simultáneos.
Mantiene un arreglo de "filtros" aplicados (por ejemplo: `[{ category: 'Ciudad', query: 'Lima' }, { category: 'Año', query: '1600' }]`). El componente padre evalúa este arreglo cruzándolo con los datos en memoria para generar el subconjunto `searchResults`.

## 5. Reglas de Seguridad (Firestore)
Las reglas están ubicadas en `firestore.rules` en la raíz del proyecto. Estas aseguran que:
- Cualquier usuario autenticado (incluyendo lectores) puede leer los registros y el registro de auditoría (`audit_logs`).
- Solamente la cuenta designada como administradora tiene permisos de escritura, actualización o eliminación en las colecciones de la base de datos.
- Bloquea interacciones no autorizadas a nivel de servidor, independientemente de la interfaz que use el cliente.

## 6. Despliegue y Pipeline CI/CD

El proceso está condensado en un script shell (`deploy.sh`), invocado vía `npm run deploy`, el cual consta de cuatro pasos lineales estrictos:
1. **Pruebas Locales (Vitest)**: Garantizan la estabilidad de funciones internas y la persistencia de reglas de negocio.
2. **Seguridad (Snyk)**: Verifica el árbol de dependencias (`package-lock.json`) en busca de vulnerabilidades antes de avanzar.
3. **Build & Deploy**: Compila a través de Vite (modo producción) y hace *push* estático a Firebase (`firebase deploy --non-interactive`).
4. **Sincronización Git**: Automatiza el commit y el `git push` a la rama `master`.
