**Documento de Especificaciones Técnicas y Funcionales: Plataforma Académica PRETSO**

**1\. Arquitectura Base y Lógica Estructural**

* **Modelo Conceptual Centrado en la Transacción:** El esquema de la base de datos relacional/documental tiene como núcleo inmutable la "Transacción". Esta entidad actúa como el nodo conector que vincula todas las secciones del corpus histórico: autores, compañías, montos financieros, eventos de Corpus Christi, manejo de cajas y salarios del teatro de los siglos XVI y XVII.  
* **Infraestructura Cloud-Native (GCP):** Optimización estricta bajo los niveles gratuitos (Free Tier) de Google Cloud Platform. Uso de servicios como Cloud Run para la ejecución de contenedores sin servidor y Firestore o Cloud SQL (dependiendo de la cardinalidad de los metadatos) para soportar eficientemente hasta 5 GB de datos textuales.  
* **Multilingüismo y Usabilidad:** Interfaz de usuario (UX/UI) diseñada bajo el estándar i18n, asegurando que la navegación y la terminología sean accesibles e intuitivas para la comunidad global de humanidades, inspirada en la eficiencia de catcom.uv.es/consulta/ pero con un enfoque modernizado.

---

**2\. Módulo de Acceso Público (Interfaz de Consulta y Difusión)**

*Este entorno está destinado a usuarios finales: historiadores, filólogos, investigadores internacionales y público general interesado en el teatro aurisecular.*

* **Motor de Búsqueda Académica impulsado por IA:**  
  * Implementación de búsqueda semántica mediante la generación de embeddings textuales y bases de datos vectoriales.  
  * Capacidad de interpretar el lenguaje y contexto del siglo XVII, permitiendo a los académicos encontrar relaciones implícitas entre documentos, como la conexión entre los 8000 reales pagados en México en 1592 y los salarios de la compañía de Ganassa en España.  
* **Visualización Estructurada de Datos Históricos:**  
  * Vistas detalladas de registros bibliográficos, índices de compañías (ej. Antonio Granados y Pedro de Valdés), indicadores de inflación/costos y análisis de salarios.  
  * Navegación cruzada: un usuario podrá acceder a una compañía y desplegar automáticamente todas las transacciones vinculadas a ella (penas por incumplimiento, raciones diarias, costos de hato y comedias).  
* **Sección de Interacción y Difusión Académica:**  
  * Tablón de anuncios integrado en el frontend público para la publicación de enlaces a nuevos artículos, noticias relevantes del proyecto THIS y convocatorias a eventos o congresos académicos.  
* **Interoperabilidad a través de Web Services (API):**  
  * Acceso público a endpoints RESTful o GraphQL en modo solo lectura (Read-Only) para investigadores o instituciones que requieran extraer y procesar la información de PRETSO de manera automatizada para sus propios estudios cuantitativos.  
* **Pre-registro Académico Sencillo:**  
  * Sistema de acceso autorizado básico para rastrear el uso académico y permitir a los usuarios guardar consultas frecuentes o historiales de investigación.

---

**3\. Módulo de Acceso Privado (Panel del Investigador y Administración)**

*Este entorno es de acceso estrictamente restringido, diseñado para el equipo central de investigación y consultoría.*

* **Gestión de Datos (Sistema de Edición Compleja):**  
  * Interfaces de ingreso de datos (CRUD) diseñadas paramétricamente alrededor del nodo "Transacción".  
  * Capacidad para cargar, modificar y curar información proveniente de actas de cabildo, escrituras y cartas de pago originales (ej. transcripciones de San Román, documentos de DICAT o del Archivo Zabálburu).  
* **Control de Estados y Flujo de Publicación:**  
  * Sistema de visibilidad condicional. Los registros ingresados mantendrán un estado de "Borrador" o "En Revisión" hasta que el equipo de investigación los apruebe.  
  * *Regla de Lanzamiento Cero:* Configuración de seguridad a nivel de base de datos que mantiene el portal público completamente inactivo u oculto hasta que el equipo logre cargar y validar un mínimo de 100 entradas maestras, momento en el cual se activará el despliegue de la versión Beta pública.  
* **Migración y Limpieza de Datos Tabulares (ETL):**  
  * Herramientas de importación interna para estructurar masivamente datos provenientes de matrices estáticas (como la estructura de la tabla 'Hacia PRETSO', índices de compañías y corpus de salarios).  
* **Seguridad y Autenticación:**  
  * Implementación de Google Identity Platform o Firebase Authentication para proteger el panel privado con políticas de contraseñas robustas y control de acceso basado en roles (RBAC), evitando alteraciones no deseadas o vulneraciones a la integridad del corpus histórico.