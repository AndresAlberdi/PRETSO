PLATAFORMA ACADÉMICA PRETSO - ÍNDICE DE ARCHIVOS DE DATOS (CSV / XML)
===================================================================

Este directorio contiene los conjuntos de datos históricos en formatos CSV y XML (convertidos a XML estándar) correspondientes a la plataforma PRETSO (Plataforma Académica del Teatro del Siglo de Oro). A continuación, se detalla el contenido, propósito y estructura de cada uno de los archivos:

1. Hacia PRETSO Companias caja.csv / .xml
------------------------------------------
* Propósito: Registrar los movimientos y flujos de caja, contabilidad interna y patrimonio de las compañías teatrales.
* Campos Principales:
  - Indicador de registro: Identificador único de registro (CM-X).
  - Transacción: ID de la transacción vinculada (Tra-X).
  - Noticia: Descripción histórica del hecho.
  - Ciudad: Ciudad donde ocurrió el registro.
  - Compañía: Siglas de la compañía teatral involucrada.
  - Data / Cargo / Otros bienes de la compañía: Detalles de ingresos, egresos y activos.
  - Código documento: Código del documento de archivo (notarial, etc.).

2. Hacia PRETSO Companias salarios.csv / .xml
----------------------------------------------
* Propósito: Detallar la compensación económica de los representantes, comediantes y autores de comedias, incluyendo raciones y pagos por representaciones.
* Campos Principales:
  - Indicador de registro: Identificador único de registro (CS-X).
  - Transacción: ID de la transacción vinculada (Tra-X).
  - Monto a pagar / Ración diaria / Pago por representación: Detalles de remuneración monetaria.
  - Pagador / Beneficiario: Sujetos de la transacción económica.
  - Compañía: Siglas de la compañía.
  - Número de representaciones por año: Frecuencia de la actividad.

3. Hacia PRETSO Corpus Christi.csv / .xml
------------------------------------------
* Propósito: Documentar la participación y contratación de las compañías teatrales para las celebraciones religiosas y representaciones del Corpus Christi.
* Campos Principales:
  - Indicador de registro: Identificador único de registro (CC-X).
  - Transacción: ID de la transacción vinculada (Tra-X).
  - Encargo / Encargado: Obra o auto sacramental encargado y responsable.
  - Monto a pagar / Fondos: Financiamiento del festejo por parte de los ayuntamientos o cofradías.
  - Compañía: Siglas de la compañía participante.

4. Hacia PRETSO Identificacion de indicadores.csv / .xml
---------------------------------------------------------
* Propósito: Servir de base documental intermedia para identificar y catalogar indicadores socioeconómicos del teatro a partir de noticias notariales.
* Campos Principales:
  - Indicador de registro: Identificador único de registro (IdI-X).
  - Transacción: ID de la transacción vinculada (Tra-X).
  - Categorías / Concepto / Monto: Información categorizada para la construcción de métricas económicas.
  - Compañía: Siglas de la compañía asociada.

5. Hacia PRETSO Indicadores.csv / .xml
---------------------------------------
* Propósito: Almacenar indicadores económicos consolidados para análisis estadístico (precios, costos de licencias, etc.).
* Campos Principales:
  - Indicador de registro: Identificador único de registro (I-X).
  - Indicador / Concepto: Nombre del indicador económico.
  - Ciudad / Años / Monto: Datos cuantitativos y espaciotemporales asociados al indicador.

6. Hacia PRETSO Indice de companias.csv / .xml
-----------------------------------------------
* Propósito: Catálogo maestro de las compañías de teatro del Siglo de Oro estudiadas en la plataforma.
* Campos Principales:
  - Indicador de registro: Identificador único de registro (Com-X).
  - Siglas: Abreviatura identificadora de la compañía (ej. AG-PV, GA).
  - Autores: Nombre de los directores o autores de comedias al mando de la compañía.
  - Temporadas teatrales: Años de actividad conocidos.
  - España / América: Ámbito geográfico de actuación.

7. Hacia PRETSO bibliografia.csv / .xml
----------------------------------------
* Propósito: Recopilar las fuentes documentales, libros y publicaciones académicas que sustentan históricamente los datos del portal PRETSO.
* Campos Principales:
  - Indicador de registro: Identificador único de registro (B-X).
  - Autores: Investigadores o historiadores autores de la fuente.
  - Referencias bibliográficas: Detalle bibliográfico de la publicación (título, año, editorial, etc.).
