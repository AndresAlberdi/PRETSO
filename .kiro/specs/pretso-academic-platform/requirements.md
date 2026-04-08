# Documento de Requisitos

## Introducción

PRETSO (Plataforma de Recursos para el Estudio del Teatro del Siglo de Oro) es una plataforma académica digital destinada a centralizar, curar y difundir el corpus histórico del teatro hispanoamericano de los siglos XVI y XVII. El modelo conceptual gira en torno a la entidad **Transacción** como nodo conector de todo el corpus: contratos de compañías, salarios, pagos del Corpus Christi, indicadores económicos y bibliografía.

La plataforma se despliega sobre infraestructura GCP Free Tier (Cloud Run + Firestore/Cloud SQL) y ofrece dos módulos diferenciados: uno público para investigadores y público general, y uno privado para el equipo central de investigación del proyecto THIS.

Los datos de partida son siete tablas CSV que cubren actividad teatral en España (Toledo, Sevilla, Badajoz, Madrid, Valladolid) y México (Ciudad de México) entre 1575 y 1608.

---

## Glosario

- **Plataforma**: El sistema PRETSO en su totalidad.
- **Portal_Público**: El módulo de acceso abierto de la Plataforma, destinado a historiadores, filólogos, investigadores y público general.
- **Panel_Privado**: El módulo de acceso restringido de la Plataforma, destinado al equipo central de investigación.
- **Transacción**: Entidad central del modelo de datos que vincula compañías, personas, documentos, montos económicos y eventos. Identificada por claves del tipo `Tra-N`.
- **Registro_Maestro**: Cualquier entrada de datos validada y publicada en la Plataforma, vinculada a una Transacción.
- **Motor_de_Búsqueda**: El componente de la Plataforma que procesa consultas textuales y semánticas sobre el corpus histórico.
- **ETL**: Proceso de extracción, transformación y carga de datos desde las tablas CSV de origen hacia la base de datos de la Plataforma.
- **Estado_de_Publicación**: Ciclo de vida de un Registro_Maestro: `Borrador` → `En Revisión` → `Publicado`.
- **Investigador_Registrado**: Usuario del Portal_Público que ha completado el pre-registro académico.
- **Editor**: Miembro del equipo de investigación con acceso al Panel_Privado y permisos de creación y edición de registros.
- **Revisor**: Miembro del equipo de investigación con acceso al Panel_Privado y permisos de aprobación de registros.
- **Administrador**: Miembro del equipo con acceso completo al Panel_Privado, incluyendo gestión de usuarios y configuración del sistema.
- **Regla_de_Lanzamiento_Cero**: Restricción de sistema que mantiene el Portal_Público inactivo hasta que existan al menos 100 Registros_Maestros en estado `Publicado`.
- **API_Pública**: Interfaz de programación de acceso abierto y solo lectura que expone el corpus de la Plataforma.
- **Embedding**: Representación vectorial de un texto generada por un modelo de lenguaje, utilizada para la búsqueda semántica.
- **Código_Documento**: Identificador de un documento histórico fuente, del tipo `[Doc. N]`.
- **Indicador_de_Registro**: Clave primaria de cada tabla CSV de origen (CM-N, CS-N, CC-N, IdI-N, I-N, Com-N, B-N).
- **THIS**: Proyecto de investigación académica al que pertenece el equipo central de PRETSO.

---

## Requisitos

### Requisito 1: Modelo de datos centrado en la Transacción

**Historia de usuario:** Como investigador, quiero que todos los registros del corpus estén vinculados a una Transacción central, para poder navegar el corpus de forma coherente y descubrir relaciones entre compañías, personas, documentos y datos económicos.

#### Criterios de aceptación

1. THE Plataforma SHALL almacenar cada Registro_Maestro vinculado a exactamente una Transacción identificada por una clave única del tipo `Tra-N`.
2. THE Plataforma SHALL mantener referencias cruzadas entre Transacciones y los registros de las siete tablas de origen mediante los campos `Indicador_de_Registro` y `Código_Documento`.
3. WHEN un usuario accede a una Transacción, THE Portal_Público SHALL mostrar todos los registros vinculados a esa Transacción en las tablas de compañías, salarios, Corpus Christi, indicadores y bibliografía.
4. THE Plataforma SHALL preservar la integridad referencial entre Transacciones y Registros_Maestros, de modo que no pueda existir un Registro_Maestro sin Transacción asociada.
5. WHEN se elimina una Transacción, THE Panel_Privado SHALL requerir confirmación explícita del Administrador y SHALL registrar la operación en el log de auditoría antes de ejecutar la eliminación.

---

### Requisito 2: Importación ETL desde tablas CSV

**Historia de usuario:** Como editor del equipo de investigación, quiero importar los datos de las siete tablas CSV existentes hacia la base de datos de la Plataforma, para no tener que ingresar manualmente los registros ya documentados.

#### Criterios de aceptación

1. THE Panel_Privado SHALL proporcionar una herramienta ETL capaz de procesar las siete tablas CSV de origen: `Indice de companias`, `Companias caja`, `Companias salarios`, `Corpus Christi`, `Identificacion de indicadores`, `Indicadores` y `Bibliografia`.
2. WHEN se ejecuta el proceso ETL sobre un archivo CSV válido, THE Panel_Privado SHALL crear los Registros_Maestros correspondientes en estado `Borrador` y SHALL asociar cada registro a su Transacción mediante el campo `Transacción` del CSV.
3. IF un archivo CSV contiene filas con campos obligatorios vacíos o claves de Transacción malformadas, THEN THE Panel_Privado SHALL rechazar esas filas, SHALL registrar cada error con el número de fila y el motivo, y SHALL continuar procesando las filas restantes.
4. WHEN el proceso ETL finaliza, THE Panel_Privado SHALL mostrar un resumen que incluya: número de registros importados correctamente, número de registros rechazados y lista de errores.
5. THE Panel_Privado SHALL permitir ejecutar el proceso ETL de forma incremental, de modo que una segunda ejecución sobre el mismo CSV no duplique registros ya existentes, identificando duplicados por `Indicador_de_Registro`.

---

### Requisito 3: Gestión CRUD de Registros_Maestros

**Historia de usuario:** Como editor del equipo de investigación, quiero crear, editar y eliminar registros del corpus directamente desde el Panel_Privado, para mantener el corpus actualizado con nuevos hallazgos documentales.

#### Criterios de aceptación

1. THE Panel_Privado SHALL permitir al Editor crear un nuevo Registro_Maestro proporcionando al menos: Transacción asociada, tabla de origen, ciudad, año, noticia y fuente bibliográfica.
2. THE Panel_Privado SHALL permitir al Editor modificar cualquier campo de un Registro_Maestro en estado `Borrador` o `En Revisión`.
3. IF un Editor intenta modificar un Registro_Maestro en estado `Publicado`, THEN THE Panel_Privado SHALL requerir que el registro sea devuelto al estado `En Revisión` antes de permitir la edición.
4. THE Panel_Privado SHALL permitir al Administrador eliminar un Registro_Maestro en cualquier estado, previa confirmación explícita.
5. WHEN se crea o modifica un Registro_Maestro, THE Panel_Privado SHALL registrar en el log de auditoría: el identificador del registro, el usuario que realizó la acción, la fecha y hora en formato ISO 8601, y el tipo de acción (creación, modificación, cambio de estado, eliminación).
6. THE Panel_Privado SHALL permitir adjuntar a cada Registro_Maestro la transcripción del documento histórico fuente identificado por su `Código_Documento`.

---

### Requisito 4: Flujo de publicación por estados

**Historia de usuario:** Como revisor del equipo de investigación, quiero que los registros pasen por un ciclo de revisión antes de ser publicados, para garantizar la calidad académica del corpus visible al público.

#### Criterios de aceptación

1. THE Plataforma SHALL gestionar el Estado_de_Publicación de cada Registro_Maestro siguiendo el ciclo: `Borrador` → `En Revisión` → `Publicado`.
2. WHEN un Editor envía un Registro_Maestro a revisión, THE Panel_Privado SHALL cambiar su estado de `Borrador` a `En Revisión` y SHALL notificar a los Revisores disponibles.
3. WHEN un Revisor aprueba un Registro_Maestro en estado `En Revisión`, THE Panel_Privado SHALL cambiar su estado a `Publicado` y SHALL hacer el registro visible en el Portal_Público.
4. WHEN un Revisor rechaza un Registro_Maestro en estado `En Revisión`, THE Panel_Privado SHALL devolver el registro al estado `Borrador` y SHALL requerir que el Revisor proporcione un comentario de rechazo de al menos 10 caracteres.
5. THE Portal_Público SHALL mostrar únicamente Registros_Maestros en estado `Publicado`.

---

### Requisito 5: Regla de Lanzamiento Cero

**Historia de usuario:** Como administrador del proyecto, quiero que el Portal_Público permanezca inactivo hasta alcanzar un umbral mínimo de registros validados, para evitar lanzar una plataforma con corpus insuficiente.

#### Criterios de aceptación

1. WHILE el número de Registros_Maestros en estado `Publicado` sea menor a 100, THE Portal_Público SHALL mostrar únicamente una página de presentación del proyecto sin acceso al corpus ni al motor de búsqueda.
2. WHEN el número de Registros_Maestros en estado `Publicado` alcanza 100, THE Plataforma SHALL activar automáticamente el acceso completo al Portal_Público sin intervención manual.
3. THE Panel_Privado SHALL mostrar en todo momento un indicador del progreso hacia el umbral de lanzamiento, expresado como el número de Registros_Maestros publicados sobre 100.
4. IF el número de Registros_Maestros en estado `Publicado` desciende por debajo de 100 tras una eliminación, THEN THE Plataforma SHALL desactivar automáticamente el acceso al corpus del Portal_Público y SHALL notificar al Administrador.

---

### Requisito 6: Motor de búsqueda académica con búsqueda semántica

**Historia de usuario:** Como investigador, quiero buscar en el corpus usando lenguaje natural, incluyendo términos del siglo XVII, para encontrar registros relevantes sin necesidad de conocer las claves exactas del sistema.

#### Criterios de aceptación

1. THE Motor_de_Búsqueda SHALL aceptar consultas en texto libre en español y SHALL devolver resultados en menos de 3 segundos para consultas sobre el corpus completo.
2. THE Motor_de_Búsqueda SHALL generar Embeddings de los campos textuales de los Registros_Maestros (noticia, concepto, documento) y SHALL utilizarlos para calcular similitud semántica entre la consulta y el corpus.
3. WHEN un usuario introduce una consulta, THE Motor_de_Búsqueda SHALL devolver los resultados ordenados por relevancia semántica descendente, mostrando al menos: Indicador_de_Registro, Transacción, ciudad, año y un fragmento del campo noticia.
4. THE Motor_de_Búsqueda SHALL admitir filtros combinables por: ciudad (Toledo, Sevilla, Badajoz, Madrid, Valladolid, Ciudad de México), rango de años (1575–1608), tabla de origen y compañía.
5. IF una consulta no produce resultados con similitud semántica superior al umbral mínimo configurado, THEN THE Motor_de_Búsqueda SHALL informar al usuario que no se encontraron resultados y SHALL sugerir términos alternativos basados en el vocabulario del corpus.
6. THE Motor_de_Búsqueda SHALL indexar los Embeddings de nuevos Registros_Maestros en estado `Publicado` en un plazo máximo de 60 segundos tras su publicación.

---

### Requisito 7: Visualización y navegación cruzada del corpus

**Historia de usuario:** Como investigador, quiero navegar desde una compañía hacia todas sus transacciones vinculadas, y desde una transacción hacia sus documentos fuente, para explorar el corpus de forma contextualizada.

#### Criterios de aceptación

1. THE Portal_Público SHALL mostrar una vista de detalle para cada compañía del Índice de Compañías que incluya: siglas, autores, temporadas, ámbito geográfico (España/América) y la lista de todas las Transacciones vinculadas a esa compañía.
2. WHEN un usuario selecciona una Transacción desde la vista de compañía, THE Portal_Público SHALL mostrar todos los registros de todas las tablas vinculados a esa Transacción.
3. THE Portal_Público SHALL mostrar vistas de listado para: bibliografía, índice de compañías, indicadores económicos y salarios, con paginación de 25 registros por página.
4. THE Portal_Público SHALL permitir la navegación cruzada entre registros relacionados mediante hipervínculos internos que preserven el contexto de navegación del usuario.
5. THE Portal_Público SHALL mostrar los montos económicos en reales como unidad principal, con conversión informativa a maravedís cuando el dato original esté expresado en maravedís.

---

### Requisito 8: Tablón de anuncios académico

**Historia de usuario:** Como miembro del equipo THIS, quiero publicar noticias, artículos y convocatorias en el Portal_Público, para mantener informada a la comunidad académica sobre el avance del proyecto.

#### Criterios de aceptación

1. THE Portal_Público SHALL mostrar un tablón de anuncios con entradas ordenadas cronológicamente de forma descendente.
2. THE Panel_Privado SHALL permitir al Editor crear entradas en el tablón con: título, cuerpo de texto, categoría (artículo, noticia del proyecto THIS, convocatoria) y fecha de publicación.
3. WHEN un Editor publica una entrada en el tablón, THE Portal_Público SHALL mostrarla de forma inmediata sin requerir aprobación adicional.
4. THE Panel_Privado SHALL permitir al Editor editar o eliminar cualquier entrada del tablón que haya creado, y al Administrador editar o eliminar cualquier entrada.
5. WHERE la Regla_de_Lanzamiento_Cero esté activa, THE Portal_Público SHALL mostrar el tablón de anuncios como único contenido accesible junto a la página de presentación del proyecto.

---

### Requisito 9: API pública de solo lectura

**Historia de usuario:** Como investigador externo, quiero acceder al corpus de PRETSO mediante una API programática, para integrar los datos en mis propios estudios cuantitativos sin depender de la interfaz web.

#### Criterios de aceptación

1. THE API_Pública SHALL exponer endpoints RESTful que permitan consultar Registros_Maestros en estado `Publicado` por: Transacción, tabla de origen, ciudad, rango de años y compañía.
2. THE API_Pública SHALL devolver las respuestas en formato JSON con una estructura de campos consistente y documentada.
3. THE API_Pública SHALL incluir paginación en todos los endpoints de listado, con un máximo de 100 registros por página y metadatos de paginación (página actual, total de páginas, total de registros).
4. THE API_Pública SHALL aplicar un límite de 60 peticiones por minuto por dirección IP y SHALL devolver el código HTTP 429 con un mensaje descriptivo cuando se supere ese límite.
5. THE API_Pública SHALL estar documentada mediante una especificación OpenAPI 3.0 accesible públicamente en la Plataforma.
6. THE API_Pública SHALL operar en modo solo lectura; IF se recibe una petición con método HTTP distinto de GET u OPTIONS, THEN THE API_Pública SHALL devolver el código HTTP 405.

---

### Requisito 10: Pre-registro académico e historial de investigación

**Historia de usuario:** Como investigador, quiero registrarme en el Portal_Público para guardar mis consultas frecuentes y llevar un historial de mi investigación en PRETSO.

#### Criterios de aceptación

1. THE Portal_Público SHALL permitir a cualquier usuario solicitar un pre-registro académico proporcionando: nombre completo, institución de afiliación y dirección de correo electrónico institucional.
2. WHEN un usuario completa el pre-registro, THE Plataforma SHALL enviar un correo de verificación a la dirección proporcionada y SHALL activar la cuenta únicamente tras la confirmación del enlace de verificación.
3. WHILE un Investigador_Registrado tiene sesión activa, THE Portal_Público SHALL guardar automáticamente cada consulta realizada en el Motor_de_Búsqueda en su historial personal, con fecha, hora y parámetros de búsqueda.
4. THE Portal_Público SHALL permitir al Investigador_Registrado guardar Registros_Maestros individuales en una lista de favoritos personal.
5. IF un Investigador_Registrado intenta acceder a su historial o favoritos sin sesión activa, THEN THE Portal_Público SHALL redirigirlo a la pantalla de inicio de sesión y SHALL retornar a la página solicitada tras la autenticación exitosa.

---

### Requisito 11: Autenticación y control de acceso basado en roles (RBAC)

**Historia de usuario:** Como administrador del sistema, quiero que el acceso al Panel_Privado esté protegido por autenticación robusta y roles diferenciados, para garantizar la integridad del corpus histórico.

#### Criterios de aceptación

1. THE Panel_Privado SHALL requerir autenticación mediante Google Identity Platform / Firebase Authentication para todos los accesos.
2. THE Plataforma SHALL implementar tres roles en el Panel_Privado: `Editor`, `Revisor` y `Administrador`, con los permisos descritos en los requisitos 3 y 4.
3. WHEN un usuario no autenticado intenta acceder a cualquier ruta del Panel_Privado, THE Plataforma SHALL redirigirlo a la pantalla de autenticación y SHALL registrar el intento de acceso.
4. THE Plataforma SHALL aplicar el principio de mínimo privilegio: un Editor no SHALL poder aprobar registros, y un Revisor no SHALL poder gestionar usuarios ni configuración del sistema.
5. THE Administrador SHALL poder asignar y revocar roles a usuarios del Panel_Privado desde la interfaz de gestión de usuarios.
6. IF una sesión del Panel_Privado permanece inactiva durante más de 60 minutos, THEN THE Plataforma SHALL cerrar la sesión automáticamente y SHALL requerir nueva autenticación.

---

### Requisito 12: Interfaz multilingüe (i18n)

**Historia de usuario:** Como investigador internacional, quiero navegar la Plataforma en mi idioma, para acceder al corpus sin barreras lingüísticas en la interfaz.

#### Criterios de aceptación

1. THE Portal_Público SHALL soportar al menos dos idiomas de interfaz: español e inglés, con posibilidad de extensión a otros idiomas sin modificar el código fuente.
2. WHEN un usuario selecciona un idioma de interfaz, THE Portal_Público SHALL aplicar el cambio de forma inmediata a todos los elementos de navegación, etiquetas y mensajes del sistema, sin recargar los datos del corpus.
3. THE Plataforma SHALL mantener los contenidos del corpus (noticias históricas, transcripciones, bibliografía) en su idioma original, independientemente del idioma de interfaz seleccionado.
4. THE Portal_Público SHALL detectar el idioma preferido del navegador del usuario y SHALL seleccionar automáticamente el idioma de interfaz más cercano disponible en la primera visita.

---

### Requisito 13: Infraestructura GCP Free Tier

**Historia de usuario:** Como responsable técnico del proyecto, quiero que la Plataforma opere exclusivamente sobre recursos GCP always-free, para garantizar la sostenibilidad económica del proyecto académico sin costes de infraestructura.

#### Criterios de aceptación

1. THE Plataforma SHALL desplegarse sobre Cloud Run utilizando únicamente la cuota gratuita de 2 millones de solicitudes mensuales y 360.000 GB-segundos de CPU.
2. THE Plataforma SHALL utilizar Firestore en modo nativo o Cloud SQL en la instancia gratuita (db-f1-micro) como base de datos, con un volumen de datos que no supere 1 GB en Firestore o 10 GB en Cloud SQL dentro de los límites gratuitos.
3. THE Plataforma SHALL configurar los servicios Cloud Run con escalado a cero instancias cuando no haya tráfico, para minimizar el consumo de cuota gratuita.
4. IF el consumo mensual de cualquier servicio GCP se aproxima al 80% de la cuota gratuita, THEN THE Plataforma SHALL enviar una alerta al Administrador con el detalle del servicio y el porcentaje de consumo.

---

### Requisito 14: Serialización y parseo de datos del corpus (round-trip)

**Historia de usuario:** Como desarrollador del sistema, quiero que los datos del corpus puedan exportarse e importarse sin pérdida de información, para garantizar la portabilidad y respaldo del corpus histórico.

#### Criterios de aceptación

1. THE Plataforma SHALL serializar los Registros_Maestros a formato JSON siguiendo un esquema documentado que preserve todos los campos de las siete tablas de origen.
2. THE Plataforma SHALL deserializar correctamente cualquier JSON producido por la serialización descrita en el criterio anterior, reconstruyendo el Registro_Maestro con todos sus campos y relaciones.
3. FOR ALL Registros_Maestros válidos, serializar y luego deserializar SHALL producir un objeto equivalente al original (propiedad de round-trip).
4. IF se intenta deserializar un JSON que no cumple el esquema documentado, THEN THE Plataforma SHALL devolver un error descriptivo que identifique el campo inválido o ausente.
