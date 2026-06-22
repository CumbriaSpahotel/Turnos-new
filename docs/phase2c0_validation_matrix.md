# Phase 2C.0 Validation Matrix

## VALIDADO_OFFLINE
*   Normalización CSV.
*   Hash físico.
*   Hash canónico.
*   Rechazo de columnas.
*   Validación de fechas.
*   Validación de números.
*   Validación de booleanos.
*   Aislamiento del CLI.
*   Ausencia de referencias operativas en UI (comprobado en `admin.js`, `admin.html`, etc.).
*   Ausencia de `service_role`.
*   Ausencia de permisos SQL manifiestamente abiertos (`USING (true)`).
*   Firmas declaradas de RPC completas y auditadas.
*   Regresiones JavaScript superadas sin degradación.

## SIMULADO
*   Transiciones del lote (DRAFT -> VALIDATED -> APPROVED -> APPLYING -> APPLIED/FAILED).
*   Roles y permisos internos.
*   Autoaprobación evitada.
*   Aplicación.
*   Fallo controlado.
*   Rollback (lógico).
*   Sustitución.
*   Idempotencia.
*   Inmutabilidad lógica.

## PENDIENTE_DE_POSTGRESQL
*   Sintaxis real de migraciones.
*   Compilación de funciones PL/pgSQL.
*   Constraints reales.
*   RLS real.
*   `auth.uid()` real.
*   `SECURITY DEFINER`.
*   `search_path`.
*   Permisos efectivos.
*   `FOR UPDATE`.
*   Concurrencia.
*   Atomicidad.
*   Rollback transaccional.
*   Resolución de claves foráneas.
*   Triggers.
*   Excepciones SQL.
*   Bloqueo de modificaciones reales.
*   Integración Auth/PostgREST.
