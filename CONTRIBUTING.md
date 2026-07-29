# Contribuir a PRETSO

¡Gracias por tu interés en contribuir al proyecto PRETSO! Este documento describe las normas, el estilo de código y el flujo de trabajo estándar (workflow) requerido para colaborar.

## Flujo de Trabajo (Workflow)

El repositorio usa un flujo de integración simple pero estricto:

1. **Ramas (Branches)**: Realiza tus cambios en una rama específica o localmente si estás trabajando como desarrollador único, pero nunca alteres el código de producción sin ejecutar el pipeline de verificación.
2. **Pruebas (Tests)**: Toda nueva funcionalidad que afecte lógica compleja de manipulación de datos o seguridad debe estar respaldada por una prueba unitaria en `/src/__tests__`. Se usa Vitest y React Testing Library.
3. **Validación**: Debes correr `npm run test` antes de enviar (commit) cualquier código. Todas las pruebas (security, utils, etc) deben pasar de forma exitosa (100%).
4. **Seguridad**: Al añadir dependencias nuevas en el `package.json`, debes correr `snyk test` para asegurar que el paquete no introduce vulnerabilidades críticas al sistema.
5. **Despliegue (Deploy)**: La subida de los archivos a producción y el commit a la rama maestra principal está completamente unificada por el script de despliegue. No subas archivos manuales a Firebase Hosting. Para desplegar y subir tus cambios, usa exclusivamente:
   ```bash
   npm run deploy
   ```

## Estilo de Código y Buenas Prácticas

### Convenciones de React
- **Hooks Personalizados**: Si abstraes lógica reutilizable, ubica tu archivo en la carpeta `/src/hooks/` (ej. `useSortableTable.ts`).
- **Componentes de UI Funcionales**: Los componentes deben desarrollarse como "Arrow functions" y usar TypeScript explícito. No uses componentes de clase. 
- **Modales Genéricos**: Si necesitas desarrollar una vista que involucra la creación/edición de datos de una nueva colección, reutiliza e integra `GenericCreateModal` y `GenericEditModal` en lugar de programar formularios desde cero.

### TypeScript
- Asegúrate de tipar los parámetros explícitamente y evita el uso del tipo `any` en partes críticas.
- Mantén la limpieza de errores y advertencias de tu editor de código. No silencies advertencias de dependencias externas a no ser que el reporte de Typescript sea erróneo o se trate de una declaración huérfana de un módulo.

### CSS y Diseño
- Respeta las variables de CSS ubicadas en `/src/index.css` (ej. `var(--primary-color)`) para mantener la homogeneidad visual y premium del sitio.
- Usa tooltips (`Tooltip.tsx`) para la información densa o para extender el contexto de campos que no sean intuitivos de primera mano.

### Reportar y Resolver Errores
- Si experimentas problemas con un entorno local o de Cloud Functions (por ejemplo compatibilidad de versiones de NodeJS 20), actualiza tus dependencias e interactúa usando `firebase-tools@latest`.
- Recuerda que Firestore exige el despliegue iterativo de sus reglas de seguridad, si modificas los permisos, estas deben publicarse automáticamente con `npm run deploy` y probarse en la batería `security.test.ts`.

Una vez más, gracias por ayudar a mantener y potenciar las capacidades históricas de esta plataforma.
