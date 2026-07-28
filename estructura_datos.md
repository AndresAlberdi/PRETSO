# Estructura de Datos (Base de Datos) - PRETSO

Esta documentación describe las colecciones principales en Firestore utilizadas por la plataforma PRETSO, sus campos esperados y relaciones.

## Colecciones y Esquemas

### 1. `companias` (Índice de Compañías)
Almacena el registro maestro de las compañías, corporaciones o gremios registrados.
*   **`Sigla Compañía`** (String): Identificador corto, por ejemplo "GA-AR-MR". (Llave foránea utilizada en otras colecciones).
*   **`Nombre Compañía`** (String): Nombre descriptivo o completo.
*   **`Autores`** (String): Nombres de las personas o directores asociados.
*   **`Temporadas teatrales`** (String): Años en los que la compañía tuvo actividad relevante.
*   **`Ámbito`** (String): Ubicación general de operaciones.
*   **`Indicador de registro`** (Number): Campo usado para preservar el orden original de inserción.

### 2. `manejo_de_caja`
Registra ingresos, egresos y el manejo de bienes económicos asociados a las compañías.
*   **`Sigla Compañía`** (String): Relación a `companias`.
*   **`Ciudad`** (String): Ciudad donde ocurrió la operación de caja.
*   **`Año`** (String): Año de la operación.
*   **`Ingresos`** (String): Valor numérico o texto indicando los ingresos obtenidos.
*   **`Egresos`** (String): Gastos registrados.
*   **`Otros bienes de la compañía`** (String): Descripción de otros activos.
*   **`Transacción`** (Number/String): Código de vínculo con la colección `transacciones`.

### 3. `salarios`
Registros de salarios o pagos emitidos a individuos, autores o miembros del gremio.
*   **`Sigla Compañía`** (String): Relación a `companias`.
*   **`Ciudad`** (String): Ciudad de pago.
*   **`Año`** (String): Año del salario.
*   **`Beneficiario `** (String): Persona que recibe el pago.
*   **`Encargo`** (String): Motivo, labor u ocupación justificada del pago.
*   **`Monto a pagar`** (String): Valor liquidado.
*   **`Moneda`** (String): Divisa empleada.
*   **`Transacción`** (Number/String): Código de vínculo con `transacciones`.

### 4. `corpus_christi`
Registros históricos sobre representaciones, contratos y gastos por las festividades de Corpus Christi.
*   **`Ciudad`** (String): Ciudad de la celebración.
*   **`Año`** (String): Año de la celebración.
*   **`Encargo`** (String): Labor encomendada (e.g. elaboración de carros, danza, etc.).
*   **`Encargado `** (String): Persona contratada o responsable.
*   **`Compañía`** a **`Compañía10`** (String): Múltiples columnas (también llamadas `Cmp1`, `Cmp2`) que vinculan `Sigla Compañía` involucradas.
*   **`Monto a pagar`** (String): Valor acordado.
*   **`Fondos`** (String): Origen de los fondos.
*   **`Transacción`** (Number/String): Código de vínculo con `transacciones`.

### 5. `indicadores`
Registros financieros consolidados categorizados para su análisis métrico (Indicadores Económicos).
*   **`Categorías`** (String): Categoría principal del indicador.
*   **`Ciudad`** (String): Localidad aplicable.
*   **`Años`** (String): Período temporal.
*   **`Concepto`** (String): Concepto específico del indicador (sub-categoría).
*   **`Monto`** (String): Valor del indicador.
*   **`Nota`** (String): Notas aclaratorias adicionales.
*   **`Sigla Compañía`** (String): Relación a `companias` (opcional).
*   **`Transacción`** (Number/String): Código de vínculo con `transacciones`.

### 6. `transacciones`
Almacena el detalle histórico, orígenes de datos y anotaciones bibliográficas relacionadas con una acción, contrato o movimiento reportado en otras colecciones.
*   **`Num`** (Number): Identificador único de la transacción. (Llave principal, a la que hacen referencia las otras colecciones mediante la columna `Transacción`).
*   **`Noticia`** (String): Texto descriptivo del evento o transacción documentada.
*   **`Fuentes para la generación del dato`** (String): Cita o referencia de donde se extrajo la información.
*   **`Doc1`** a **`Doc10`** (Number): Códigos vinculando a los documentos primarios transcritos en la colección `documentos`.

### 7. `documentos`
Textos primarios transcritos que respaldan la información.
*   **`Doc`** (Number): Identificador único del documento (Llave primaria referenciada por `transacciones.DocX`).
*   **`Documento`** (String): Transcripción paleográfica o texto del documento original en extenso.

## Flujo Relacional Típico

1.  Una vista maestra (e.g., `IndiceCompanias`) lista `companias`.
2.  Desde allí, se busca en `manejo_de_caja`, `salarios` o `corpus_christi` registros donde `Sigla Compañía` coincida.
3.  El registro de detalle tiene un campo `Transacción`.
4.  Si el usuario desea más contexto, consulta `transacciones` donde `Num == Transacción`.
5.  La `Transacción` específica puede contener referencias a uno o más documentos (campos `Doc1...Doc10`), los cuales se consultan en la colección `documentos`.
