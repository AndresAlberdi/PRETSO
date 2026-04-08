# Plan de Implementación: Plataforma Académica PRETSO

## Visión General

Implementación incremental de la plataforma PRETSO sobre GCP Free Tier (Cloud Run + Firestore + Firebase Auth), con un backend FastAPI en Python y un frontend React + Vite + TypeScript. Las tareas siguen el orden: infraestructura base → modelos de datos → backend (público y privado) → ETL → frontend → integración final.

## Tareas

- [x] 1. Configurar estructura del proyecto e infraestructura base
  - Crear la estructura de directorios `backend/` y `frontend/` con sus archivos de configuración iniciales (`pyproject.toml` / `requirements.txt`, `vite.config.ts`, `tsconfig.json`).
  - Configurar el cliente Firestore en `backend/src/db/firestore.py` con las credenciales de servicio GCP.
  - Configurar Firebase Auth en el backend (`backend/src/api/auth.py`) con verificación de JWT y extracción de `custom_claims` de rol.
  - Crear el archivo `Dockerfile` para el backend Cloud Run con arranque en frío < 2 s.
  - Crear `backend/src/main.py` con la aplicación FastAPI, CORS configurado y el router base.
  - _Requisitos: 11.1, 13.1, 13.3_

- [x] 2. Implementar modelos de datos Pydantic y esquema de serialización
  - [x] 2.1 Crear modelos Pydantic en `backend/src/models/`
    - Implementar `RecordMaestro` con todos los campos comunes y los campos específicos por tabla de origen (CM, CS, CC, IdI, I, Com, B).
    - Implementar `Transaction`, `Company`, `Announcement`, `User`, `AuditLog` y `LaunchRule`.
    - Implementar la validación del patrón `Tra-\d+` en `transaction_id` y del patrón de `Indicador_de_Registro`.
    - _Requisitos: 1.1, 1.4, 14.1, 14.2_

  - [ ]* 2.2 Escribir prueba de propiedad P14: Round-trip de serialización
    - **Propiedad 14: Round-trip de serialización de Registros_Maestros**
    - Usar `hypothesis` con `st.builds(RecordMaestro)` para verificar que `deserializar(serializar(r)) == r` para todos los campos, incluyendo arrays de floats (embeddings).
    - **Valida: Requisitos 14.1, 14.2, 14.3**

  - [ ]* 2.3 Escribir prueba de propiedad P15: Error en deserialización inválida
    - **Propiedad 15: Deserialización de JSON inválido produce error descriptivo**
    - Usar `hypothesis` con `st.builds(InvalidJson)` para verificar que la deserialización de JSON con campos obligatorios ausentes o de tipo incorrecto devuelve un error que identifica el campo problemático.
    - **Valida: Requisito 14.4**

  - [ ]* 2.4 Escribir prueba de propiedad P1: Invariante de vinculación Registro–Transacción
    - **Propiedad 1: Invariante de vinculación Registro–Transacción**
    - Usar `hypothesis` con `st.builds(RecordMaestro)` para verificar que `transaction_id` es no nulo, cumple `Tra-\d+` y referencia una transacción existente.
    - **Valida: Requisitos 1.1, 1.4**

- [x] 3. Implementar capa de acceso a Firestore y lógica de auditoría
  - [x] 3.1 Implementar repositorios Firestore en `backend/src/db/`
    - Crear funciones CRUD genéricas para colecciones `records`, `transactions`, `companies`, `announcements`, `users`, `audit_log` y `config`.
    - Implementar reintentos con backoff exponencial (3 intentos: 1 s / 2 s / 4 s) ante errores transitorios de Firestore.
    - _Requisitos: 1.4, 13.2_

  - [x] 3.2 Implementar servicio de auditoría en `backend/src/services/audit_service.py`
    - Escribir la función `log_operation(record_id, user_uid, action, details)` que crea una entrada en `audit_log` de forma atómica junto con la operación sobre el registro.
    - _Requisitos: 3.5, 1.5_

  - [ ]* 3.3 Escribir prueba de propiedad P10: Auditoría completa de operaciones
    - **Propiedad 10: Auditoría completa de operaciones**
    - Usar `hypothesis` con `st.builds(AuditableOperation)` para verificar que toda operación de creación, modificación, cambio de estado o eliminación genera exactamente una entrada en `audit_log` con todos los campos requeridos.
    - **Valida: Requisito 3.5**

- [x] 4. Implementar máquina de estados de publicación y Regla de Lanzamiento Cero
  - [x] 4.1 Implementar `backend/src/services/publication_service.py`
    - Codificar las transiciones válidas: `borrador → en_revision`, `en_revision → publicado`, `en_revision → borrador`.
    - Rechazar cualquier transición fuera del grafo con error `INVALID_STATE_TRANSITION` (HTTP 422).
    - Implementar la validación del comentario de rechazo (mínimo 10 caracteres), devolviendo `REJECTION_COMMENT_TOO_SHORT` si no se cumple.
    - _Requisitos: 4.1, 4.3, 4.4, 3.3_

  - [ ]* 4.2 Escribir prueba de propiedad P7: Máquina de estados de publicación
    - **Propiedad 7: Máquina de estados de publicación**
    - Usar `hypothesis` con `st.sampled_from(PublicationStatus)` para verificar que solo las transiciones válidas son aceptadas y que las inválidas son rechazadas con error.
    - **Valida: Requisitos 3.3, 4.1**

  - [ ]* 4.3 Escribir prueba de propiedad P8: Comentario de rechazo mínimo
    - **Propiedad 8: Comentario de rechazo mínimo**
    - Usar `hypothesis` con `st.text()` para verificar que comentarios con longitud < 10 son rechazados y los de longitud ≥ 10 son aceptados y almacenados.
    - **Valida: Requisito 4.4**

  - [x] 4.4 Implementar `backend/src/services/launch_rule.py`
    - Leer y actualizar el contador `published_count` en `/config/launch_rule` de Firestore.
    - Implementar la lógica de activación/desactivación del portal según el umbral de 20 registros publicados.
    - Notificar al Administrador si `published_count` desciende por debajo de 20 tras una eliminación.
    - _Requisitos: 5.1, 5.2, 5.4_

  - [ ]* 4.5 Escribir prueba de propiedad P6: Umbral de Lanzamiento Cero
    - **Propiedad 6: Umbral de Lanzamiento Cero**
    - Usar `hypothesis` con `st.integers(min_value=0, max_value=50)` para verificar que `published_count < 20` implica portal inactivo y `published_count >= 20` implica portal activo.
    - **Valida: Requisitos 5.1, 5.2, 5.4**

- [x] 5. Punto de control — Verificar que todas las pruebas pasan
  - Asegurarse de que todas las pruebas unitarias y de propiedad implementadas hasta aquí pasan. Consultar al usuario si surgen dudas.

- [x] 6. Implementar servicio de embeddings y búsqueda semántica
  - [x] 6.1 Implementar `backend/src/services/embedding_service.py`
    - Cargar el modelo `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` en el arranque del contenedor.
    - Exponer la función `generate_embedding(text: str) -> list[float]`.
    - _Requisitos: 6.2_

  - [x] 6.2 Implementar `backend/src/services/search_service.py`
    - Implementar la recuperación de candidatos por filtros (ciudad, rango de años, tabla de origen, compañía) antes del cálculo de similitud coseno.
    - Implementar el cálculo de similitud coseno sobre los candidatos y ordenar resultados de forma no creciente por score.
    - Devolver al menos: `Indicador_de_Registro`, `transaction_id`, ciudad, año y fragmento de `noticia`.
    - Implementar la sugerencia de términos alternativos cuando no hay resultados por encima del umbral mínimo.
    - _Requisitos: 6.1, 6.3, 6.4, 6.5_

  - [ ]* 6.3 Escribir prueba de propiedad P11: Ordenación de resultados por relevancia
    - **Propiedad 11: Ordenación de resultados de búsqueda por relevancia**
    - Usar `hypothesis` con `st.text(min_size=1)` para verificar que los scores de similitud en la respuesta están ordenados de forma no creciente: `score[i] >= score[i+1]`.
    - **Valida: Requisito 6.3**

- [-] 7. Implementar endpoints públicos de la API REST
  - [x] 7.1 Implementar `backend/src/api/public/records.py`
    - `GET /api/v1/records` con paginación (máx. 100 por página) y filtros por ciudad, año, tabla de origen y compañía. Solo devuelve registros con `status = "publicado"`.
    - `GET /api/v1/records/{id}` con detalle completo del registro.
    - _Requisitos: 9.1, 9.2, 9.3, 4.5_

  - [x] 7.2 Implementar `backend/src/api/public/transactions.py`
    - `GET /api/v1/transactions/{id}` devolviendo la transacción con todos sus registros vinculados (solo publicados).
    - _Requisitos: 1.3, 9.1_

  - [x] 7.3 Implementar `backend/src/api/public/companies.py`
    - `GET /api/v1/companies` con listado paginado.
    - `GET /api/v1/companies/{id}` con detalle de compañía y lista de transacciones vinculadas.
    - _Requisitos: 7.1, 7.2_

  - [x] 7.4 Implementar `backend/src/api/public/search.py`
    - `GET /api/v1/search` con parámetros `q`, `city`, `year_from`, `year_to`, `source_table`, `company`, `page`, `page_size`.
    - Integrar con `search_service.py` e indexar embeddings de nuevos registros publicados en ≤ 60 s.
    - _Requisitos: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [x] 7.5 Implementar `backend/src/api/public/announcements.py`
    - `GET /api/v1/announcements` con listado ordenado cronológicamente de forma descendente.
    - _Requisitos: 8.1_

  - [x] 7.6 Implementar middleware de rate limiting y control de métodos HTTP
    - Aplicar límite de 60 peticiones/minuto por IP con respuesta HTTP 429 y mensaje descriptivo.
    - Rechazar métodos distintos de GET u OPTIONS con HTTP 405 en todos los endpoints públicos.
    - Implementar el middleware de la Regla de Lanzamiento Cero: devolver HTTP 503 con `PORTAL_INACTIVE` si `portal_active = false`.
    - _Requisitos: 9.4, 9.6, 5.1_

  - [ ]* 7.7 Escribir prueba de propiedad P9: Visibilidad solo de registros publicados
    - **Propiedad 9: Visibilidad pública solo de registros publicados**
    - Usar `hypothesis` con `st.lists(st.builds(RecordMaestro))` para verificar que ningún endpoint público devuelve registros en estado `borrador` o `en_revision`.
    - **Valida: Requisito 4.5**

  - [ ]* 7.8 Escribir prueba de propiedad P12: Paginación no excede el límite
    - **Propiedad 12: Paginación de la API no excede el límite**
    - Usar `hypothesis` con `st.integers(min_value=1, max_value=500)` para verificar que la respuesta contiene `min(page_size, 100, disponibles)` registros.
    - **Valida: Requisito 9.3**

  - [ ]* 7.9 Escribir prueba de propiedad P13: API de solo lectura rechaza métodos de escritura
    - **Propiedad 13: API de solo lectura rechaza métodos de escritura**
    - Usar `hypothesis` con `st.sampled_from(["POST","PUT","DELETE","PATCH","HEAD"])` para verificar que todos los endpoints públicos devuelven HTTP 405.
    - **Valida: Requisito 9.6**

  - [ ]* 7.10 Escribir prueba de propiedad P2: Completitud de referencias cruzadas
    - **Propiedad 2: Completitud de referencias cruzadas**
    - Usar `hypothesis` con `st.lists(st.builds(RecordMaestro))` para verificar la bidireccionalidad: cada `record_id` en una transacción apunta de vuelta a esa transacción, y `GET /api/v1/transactions/{id}` devuelve exactamente esos registros.
    - **Valida: Requisitos 1.2, 1.3**

- [-] 8. Implementar endpoints privados de la API REST (Panel Privado)
  - [x] 8.1 Implementar middleware de autenticación en `backend/src/api/auth.py`
    - Verificar JWT de Firebase en el header `Authorization: Bearer <token>` para todas las rutas `/api/v1/admin/*`.
    - Extraer y validar el `custom_claim` de rol (`editor` | `revisor` | `administrador`).
    - Redirigir a autenticación y registrar el intento si el token es inválido o ausente.
    - _Requisitos: 11.1, 11.3_

  - [x] 8.2 Implementar `backend/src/api/private/records.py`
    - `POST /api/v1/admin/records` — crear registro (Editor), campos mínimos: transacción, tabla de origen, ciudad, año, noticia, fuente bibliográfica.
    - `PUT /api/v1/admin/records/{id}` — editar registro en estado `borrador` o `en_revision` (Editor); rechazar si está `publicado` con `INVALID_STATE_TRANSITION`.
    - `DELETE /api/v1/admin/records/{id}` — eliminar registro (Administrador), con confirmación explícita y entrada en `audit_log`.
    - Integrar con `publication_service.py` para cambios de estado y con `audit_service.py` para todas las operaciones.
    - _Requisitos: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 11.4_

  - [x] 8.3 Implementar `backend/src/api/private/announcements.py`
    - `POST /api/v1/admin/announcements` — crear entrada (Editor) con título, cuerpo, categoría y fecha de publicación.
    - `PUT /api/v1/admin/announcements/{id}` — editar entrada (Editor: solo las propias; Administrador: cualquiera).
    - `DELETE /api/v1/admin/announcements/{id}` — eliminar entrada (Editor: solo las propias; Administrador: cualquiera).
    - _Requisitos: 8.2, 8.3, 8.4_

  - [x] 8.4 Implementar `backend/src/api/private/users.py`
    - `GET /api/v1/admin/users` — listar usuarios (Administrador).
    - `POST /api/v1/admin/users` — crear usuario con rol (Administrador), asignando `custom_claims` en Firebase Auth.
    - `PUT /api/v1/admin/users/{uid}` — asignar o revocar rol (Administrador).
    - _Requisitos: 11.2, 11.4, 11.5_

- [x] 9. Implementar proceso ETL
  - [x] 9.1 Implementar `backend/src/services/etl_service.py`
    - Parsear y validar cada una de las siete tablas CSV (CM, CS, CC, IdI, I, Com, B) con sus esquemas específicos.
    - Crear `RecordMaestro` en estado `borrador` por cada fila válida, derivando `transaction_id` del campo `Transacción` del CSV.
    - Implementar idempotencia por `Indicador_de_Registro`: si el registro ya existe, omitirlo sin crear duplicado.
    - Acumular errores de filas inválidas (número de fila, campo problemático, motivo) sin abortar el proceso.
    - Devolver resumen: registros importados, registros rechazados, lista de errores.
    - _Requisitos: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 9.2 Implementar `backend/src/api/private/etl.py`
    - `POST /api/v1/admin/etl/run` — disparar el proceso ETL con el CSV subido (Administrador o Editor).
    - Devolver el resumen de la ejecución al finalizar.
    - _Requisitos: 2.1, 2.4_

  - [ ]* 9.3 Escribir prueba de propiedad P3: ETL produce registros en estado Borrador
    - **Propiedad 3: ETL produce registros en estado Borrador**
    - Usar `hypothesis` con `st.lists(st.builds(CsvRow), min_size=1)` para verificar que N filas válidas producen exactamente N registros en estado `borrador` con `transaction_id` correcto.
    - **Valida: Requisito 2.2**

  - [ ]* 9.4 Escribir prueba de propiedad P4: ETL particiona filas válidas e inválidas
    - **Propiedad 4: ETL particiona correctamente filas válidas e inválidas**
    - Usar `hypothesis` con `st.lists(st.one_of(valid_row, invalid_row))` para verificar que V filas válidas y R inválidas producen exactamente V registros importados y R rechazos con número de fila y motivo.
    - **Valida: Requisito 2.3**

  - [ ]* 9.5 Escribir prueba de propiedad P5: Idempotencia del ETL
    - **Propiedad 5: Idempotencia del ETL**
    - Usar `hypothesis` con `st.lists(st.builds(CsvRow))` para verificar que ejecutar el ETL dos veces sobre el mismo CSV produce el mismo número de registros que ejecutarlo una sola vez.
    - **Valida: Requisito 2.5**

- [x] 10. Punto de control — Verificar que todas las pruebas pasan
  - Asegurarse de que todas las pruebas unitarias y de propiedad del backend pasan. Consultar al usuario si surgen dudas.

- [ ] 11. Implementar frontend: estructura base e i18n
  - Crear la aplicación React + Vite + TypeScript con React Router para las rutas públicas y privadas.
  - Configurar `react-i18next` con los archivos `src/i18n/es.json` y `src/i18n/en.json`.
  - Implementar `LanguageSwitcher.tsx` que aplica el cambio de idioma de forma inmediata sin recargar datos.
  - Implementar la detección automática del idioma del navegador en la primera visita.
  - _Requisitos: 12.1, 12.2, 12.3, 12.4_

- [ ] 12. Implementar páginas públicas del Portal
  - [ ] 12.1 Implementar `Home.tsx` y `Announcements.tsx`
    - `Home.tsx`: página de presentación del proyecto con `LaunchProgress.tsx` (contador de registros publicados sobre 20).
    - `Announcements.tsx`: tablón de anuncios ordenado cronológicamente de forma descendente.
    - Cuando `portal_active = false`, mostrar solo estas dos páginas.
    - _Requisitos: 5.1, 5.3, 8.1, 8.5_

  - [ ] 12.2 Implementar `Search.tsx` con `SearchFilters.tsx`
    - Formulario de búsqueda con campo de texto libre y filtros combinables: ciudad, rango de años, tabla de origen, compañía.
    - Mostrar resultados ordenados por relevancia con: `Indicador_de_Registro`, transacción, ciudad, año y fragmento de `noticia`.
    - Mostrar mensaje y sugerencias cuando no hay resultados.
    - _Requisitos: 6.1, 6.3, 6.4, 6.5_

  - [ ] 12.3 Implementar `CompanyDetail.tsx` y `TransactionDetail.tsx`
    - `CompanyDetail.tsx`: siglas, autores, temporadas, ámbito geográfico y lista de transacciones vinculadas con hipervínculos.
    - `TransactionDetail.tsx`: todos los registros de todas las tablas vinculados a la transacción, con montos en reales y conversión informativa a maravedís.
    - _Requisitos: 7.1, 7.2, 7.4, 7.5_

  - [ ] 12.4 Implementar `ApiDocs.tsx`
    - Página que embebe o enlaza la especificación OpenAPI 3.0 generada automáticamente por FastAPI.
    - _Requisito: 9.5_

- [ ] 13. Implementar autenticación de usuarios y pre-registro académico
  - Integrar Firebase Auth en el frontend para login/logout del Panel Privado.
  - Implementar el formulario de pre-registro académico (nombre, institución, correo) con envío de correo de verificación.
  - Implementar la redirección a login cuando se accede a rutas protegidas sin sesión, retornando a la página solicitada tras autenticación exitosa.
  - Implementar el cierre de sesión automático tras 60 minutos de inactividad en el Panel Privado.
  - _Requisitos: 10.1, 10.2, 10.5, 11.1, 11.3, 11.6_

- [ ] 14. Implementar historial de búsqueda y favoritos del investigador registrado
  - Guardar automáticamente cada consulta del Motor de Búsqueda en el historial personal del `Investigador_Registrado` (fecha, hora, parámetros).
  - Implementar la funcionalidad de guardar y eliminar registros en la lista de favoritos personal.
  - _Requisitos: 10.3, 10.4_

- [ ] 15. Implementar Panel Privado (Dashboard y gestión)
  - [ ] 15.1 Implementar `Dashboard.tsx`
    - Vista principal del Panel Privado con indicador de progreso hacia el umbral de lanzamiento.
    - Accesos directos a las secciones según el rol del usuario autenticado.
    - _Requisitos: 5.3, 11.2_

  - [ ] 15.2 Implementar `RecordEditor.tsx`
    - Formulario de creación y edición de `RecordMaestro` con campos dinámicos según la tabla de origen seleccionada.
    - Botones de acción según el estado del registro y el rol del usuario (enviar a revisión, aprobar, rechazar con comentario).
    - _Requisitos: 3.1, 3.2, 3.3, 4.2, 4.3, 4.4_

  - [ ] 15.3 Implementar `EtlUpload.tsx`
    - Formulario de carga de archivo CSV con selector de tabla de origen.
    - Mostrar el resumen de la ejecución ETL (importados, rechazados, lista de errores).
    - _Requisitos: 2.1, 2.4_

  - [ ] 15.4 Implementar `UserManagement.tsx`
    - Listado de usuarios del Panel Privado con sus roles.
    - Formulario para asignar y revocar roles (solo Administrador).
    - _Requisitos: 11.2, 11.5_

- [ ] 16. Punto de control final — Verificar integración completa
  - Asegurarse de que el flujo completo ETL → revisión → publicación → consulta pública funciona mediante pruebas de integración automatizadas.
  - Verificar la Regla de Lanzamiento Cero end-to-end.
  - Verificar que la cobertura del backend es ≥ 80%.
  - Consultar al usuario si surgen dudas antes de cerrar.

## Notas

- Las tareas marcadas con `*` son opcionales y pueden omitirse para un MVP más rápido.
- Cada tarea referencia los requisitos específicos para trazabilidad.
- Los puntos de control garantizan validación incremental.
- Las pruebas de propiedad validan invariantes universales con `hypothesis` (mínimo 100 iteraciones).
- Las pruebas unitarias validan comportamientos específicos y casos límite.
