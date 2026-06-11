# Estructura de la Base de Datos Firestore

PRETSO utiliza Google Cloud Firestore como base de datos NoSQL documental. La base de datos está organizada de manera plana o estructurada según colecciones principales, donde la colección clave es `records` (que consolida los registros maestros).

---

## 1. Colecciones Principales

### A. `records` (Registros Maestros)
Es la colección central de la plataforma. Cada documento en `records` tiene un identificador único que sigue el formato `(Tipo)-(Autoincremental)` (ej. `CM-102`, `CS-14`, `CC-85`).

El esquema JSON en Firestore contiene:

| Campo | Tipo | Validación | Descripción |
| :--- | :--- | :--- | :--- |
| `id` | String | `^(CM\|CS\|CC\|IdI\|I\|Com\|B)-\d+$` | Identificador del registro maestro. |
| `transaction_id` | String | `^Tra-\d+$` | Identificador de transacción único. |
| `source_table` | String | `CM`, `CS`, `CC`, `IdI`, `I`, `Com`, `B` | Tipo de datos o tabla fuente del registro. |
| `status` | String | `borrador`, `en_revision`, `publicado` | Estado en el flujo de publicación. |
| `city` | String | Obligatorio | Ciudad del registro histórico (ej. `Sevilla`). |
| `year` | Integer | `1500` - `1700` | Año del registro histórico. |
| `noticia` | String | Obligatorio | Extracto o resumen histórico. |
| `fuente_bibliografica` | String | Obligatorio | Referencia bibliográfica original. |
| `documento_codigo` | String (Opt) | - | Signatura o código del documento de archivo. |
| `transcripcion` | String (Opt) | - | Transcripción paleográfica literal. |
| `monto_reales` | Float (Opt) | - | Monto convertido en reales de plata. |
| `monto_maravedis` | Float (Opt) | - | Monto equivalente en maravedís. |
| `compania_id` | String (Opt) | - | ID de compañía de teatro asociada. |
| `embedding` | Array[Float] (Opt) | Vector de 384 dimensiones | Embedding vectorial para la búsqueda semántica. |
| `created_by` | String | - | ID del usuario creador (Firebase UID). |
| `created_at` | Timestamp | - | Fecha de creación del registro. |
| `updated_at` | Timestamp | - | Fecha de última edición. |
| `published_at` | Timestamp (Opt) | - | Fecha de publicación en producción. |
| `rejection_comment`| String (Opt) | - | Mensaje de rechazo de un revisor. |

#### Campos Específicos según `source_table`
* **Caja de Madrid (`CM`)**:
  * `tipo_pago` (String): Concepto o tipo de desembolso.
  * `concepto_caja` (String): Subcuenta de contabilidad.
* **Cargos y Salarios (`CS`)**:
  * `nombre_actor` (String): Nombre del histrión o comediante.
  * `cargo` (String): Especialidad o rol (ej. `primer galán`).
  * `salario_diario` (Float): Salario diario en reales.
* **Corpus Christi (`CC`)**:
  * `festividad` (String): Nombre o tipo de festividad (ej. `Corpus Christi`).
  * `numero_autos` (Integer): Cantidad de piezas sacramentales representadas.
* **Indicadores (`IdI` / `I`)**:
  * `tipo_indicador` (String): Categoría del indicador económico.
  * `valor_indicador` (String): Valor medido o registrado.
  * `unidad` (String): Unidad de medida.
* **Compañías (`Com`)**:
  * `siglas` (String): Siglas asignadas a la agrupación.
  * `autor_principal` (String): Autor o director de comedias de la compañía.
  * `ambito` (String): Alcance territorial (ej. `América`, `Península`).
* **Bibliografía (`B`)**:
  * `autor_bib` (String): Autor del estudio o edición bibliográfica.
  * `titulo` (String): Título de la obra o artículo.
  * `anio_publicacion` (Integer): Año de edición moderna.
  * `editorial` (String): Casa editora.

---

### B. `companies` (Compañías de Teatro)
Almacena la base de datos de agrupaciones y directores teatrales (autores de comedias).
* Campos principales: `id`, `siglas`, `nombre`, `autor_principal`, `ambito`, `created_at`.

### C. `announcements` (Noticias y Anuncios)
Utilizada para difundir convocatorias y noticias académicas en el portal principal.
* Campos principales: `id`, `title`, `content`, `category` (`articulo`, `noticia_proyecto`, `convocatoria`), `published_at`.

### D. `audit_logs` (Registro de Auditoría)
Almacena un historial inmutable de todas las acciones del flujo de trabajo y edición de registros para garantizar la trazabilidad académica.
* Campos principales: `id`, `record_id`, `action` (`create`, `update`, `submit`, `approve`, `reject`, `delete`), `user_id`, `timestamp`, `details`.

---

## 2. Reglas de Seguridad (`firestore.rules`)

El portal utiliza una configuración cerrada de seguridad de base de datos directa cliente-Firestore:

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

**Justificación**: Toda la lógica de negocio, autenticación, autorización y validación semántica pasa exclusivamente a través de la API REST del backend en FastAPI utilizando permisos privilegiados del Firebase Admin SDK. Ningún cliente frontend puede leer o escribir directamente en la base de datos sin pasar por la API REST, mitigando riesgos de seguridad e inyección de datos inconsistentes.
