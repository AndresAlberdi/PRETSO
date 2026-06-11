# Documentación de la API REST de PRETSO

La API del backend está construida con FastAPI y cuenta con documentación interactiva integrada de tipo OpenAPI (Swagger UI) que se puede consultar en local o en producción añadiendo `/docs` o `/redoc` a la dirección raíz del backend.

Este documento proporciona una guía de referencia de los endpoints principales divididos en públicos y privados.

---

## Autenticación

Todos los endpoints (con raras excepciones como el estado del portal) requieren un token de portador JWT de Firebase Auth en el header HTTP `Authorization`:

```http
Authorization: Bearer <id_token_firebase>
```

---

## 1. Endpoints Públicos

Estos endpoints son accesibles por cualquier usuario autenticado en la plataforma.

### A. Búsqueda y Estadísticas
* **`GET /api/v1/search`**: Búsqueda semántica (búsqueda vectorial basada en embeddings de texto) y de texto completo.
  * **Parámetros de consulta (Query params)**:
    * `q` (string, opcional): Texto libre a buscar conceptualmente.
    * `city` (string, opcional): Filtrar por ciudad (ej. `Madrid`).
    * `year_from` / `year_to` (integer, opcional): Filtro por rango de años.
    * `source_table` (string, opcional): Nombre de la tabla fuente (ej. `PRECIOS_TEATRO`).
    * `company` (string, opcional): Filtrar por ID de compañía.
    * `page` (integer, por defecto `1`): Número de página.
    * `page_size` (integer, por defecto `25`): Elementos por página.
* **`GET /api/v1/search/stats`**: Obtiene estadísticas agregadas de los registros publicados para tableros y gráficas, como conteo agrupado por ciudades y años.
* **`GET /api/v1/search/export`**: Genera un archivo CSV con hasta 1000 registros coincidentes con los filtros de búsqueda proporcionados. Devuelve una descarga tipo `text/csv`.

### B. Registros y Transacciones
* **`GET /api/v1/records`**: Lista paginada de registros que se encuentran exclusivamente en estado `publicado`. Acepta los mismos filtros de ciudad, año, tabla y compañía.
* **`GET /api/v1/records/{record_id}`**: Detalle de un registro maestro en estado `publicado` incluyendo todos sus metadatos económicos.
* **`GET /api/v1/companies`**: Obtiene el catálogo completo de las compañías de teatro del Siglo de Oro.
* **`GET /api/v1/launch-status`**: Devuelve información sobre el estado actual de activación del portal.
  * **Retorno**:
    ```json
    {
      "published_count": 42,
      "threshold": 10,
      "portal_active": true
    }
    ```

---

## 2. Endpoints Privados (Administración)

Estos endpoints requieren que el usuario autenticado posea un rol con privilegios de escritura o revisión (como Administrador o Revisor).

### A. Gestión de Registros
* **`GET /api/v1/admin/records`**: Lista paginada de registros en cualquier estado (`borrador`, `en_revision`, `publicado`).
* **`POST /api/v1/admin/records`**: Crea un nuevo registro maestro vacío o pre-poblado.
* **`PUT /api/v1/admin/records/{record_id}`**: Actualiza los campos de un registro existente.
* **`DELETE /api/v1/admin/records/{record_id}`**: Elimina un registro de la base de datos Firestore.

### B. Flujo de Trabajo (Workflow)
* **`POST /api/v1/admin/records/{record_id}/submit`**: Envía un registro de estado `borrador` a revisión (`en_revision`).
* **`POST /api/v1/admin/records/{record_id}/approve`**: Aprueba un registro en revisión, cambiándolo a estado `publicado` y recalculando el estado de lanzamiento.
* **`POST /api/v1/admin/records/{record_id}/reject`**: Rechaza un registro en revisión, retornándolo a estado `borrador` para su corrección.

### C. Importación de Datos (ETL)
* **`POST /api/v1/admin/etl/upload`**: Recibe un archivo adjunto tipo `multipart/form-data` con la extensión `.csv` que contiene registros maestros. Realiza un parsing, validador de tipos y los guarda en Firestore en estado `borrador` para revisión manual.
