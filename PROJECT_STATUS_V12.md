# 📋 PROJECT_STATUS_V12 — Cumbria/Guadiana Scheduling

**Current Stable Version:** V12.5.34  
**Date:** 2026-05-02

---

## [V12.5.34 — MAYO PUBLICATION CLOSEOUT]
*   **Versión funcional:** V8 Mayo estabilizada (técnicamente desplegada como V134).
*   **Versión técnica activa:** **134** (Superpone a la V133 inicial por orden descendente).
*   **Alcance:** Cumbria Spa&Hotel y Sercotel Guadiana para todo el mes de Mayo 2026.
*   **Escrituras realizadas:** 20 inserts totales en `publicaciones_cuadrante` (10 V133 + 10 V134).
*   **Reglas visuales:** 100% de cumplimiento. Marcador 📌 exclusivo para Bajas/Permisos sobre turnos de trabajo.
*   **Deuda técnica:** V133 y V999 TEST persisten en DB pero son ignoradas por el motor de resolución público. Limpieza manual pendiente desde Dashboard.
*   **Estado:** ✅ **PUBLICACIÓN FINALIZADA Y BLOQUEADA.**

---

## Current Status (V12.5.29)
*   **Coverage Logic:** Fully stabilized. The coverage pin marker (📌) is correctly gated to medical/permission absences (BAJA, PERMISO, IT, FORMACION) and excluded for VACACIONES in both Admin and Public views.
*   **Resolution Engine:** `shift-resolver.js` now implements strict conditional marker assignment.
*   **Verification:** Validated via dry run for Sercotel Guadiana (April 2026) and Cumbria (May 2026). Natalio correctly shows 📌 for PERMISO; Miriam correctly shows no 📌 for VAC.
*   **Identity Mapping:** `admin.js` publication pipeline hardened to preserve `isCoverageMarker` and correct `empleado_id` in snapshots.

---

## 🚀 V12.5.25 — UI FIXES (CONSOLIDADO)
*   **Empty Rows:** hardened filtering logic in `admin.js` to exclude phantom/placeholder rows with invalid IDs or names.
*   **Descanso Style:** standardized to Red background / White text across all views (Admin, Public, Mobile).

---

## 🚀 Publication State: Mayo 2026
*   **Status:** ✅ PUBLISHED (Version 7)
*   **Snapshots:** 8 snapshots (4 weeks x 2 hotels)
*   **Version History:** V7 is the current canonical version for May 2026.
*   **Freeze:** Mayo V7 is frozen. Do not re-publish or overwrite without explicit authorization and version bump to V8.

---

## 🛠️ Active Modules & Architecture
1.  **Orchestrator (`admin.js`)**: Decentralized. Core logic moved to modules. Acts as a proxy bridge.
2.  **Cambios Module (`cambios-module.js`)**: Operative dashboard for shift swaps. Directs events to `eventos_cuadrante`.
3.  **Bajas Module (`bajas-module.js`)**: Management of sick leave and permissions. Directs events to `eventos_cuadrante`.
4.  **Vacaciones Module (`vacaciones-module.js`)**: Vacation management.
5.  **Shift Resolver (`shift-resolver.js`)**: Engine V12.5.21. Resolves final shifts using:
    `Excel (Base) + Eventos_Cuadrante (Incidencias/Cambios) = Final View`

---

## 🛑 Blocked / Deprecated Scripts
These scripts must **NOT** be executed under any circumstances as they write legacy data to the `turnos` table, which corrupts the V12 resolution engine.

*   `migrate_ct.js`: Blocked by flag.
*   `load_cambios_ct.js`: Blocked by confirmation.
*   `migrate_bajas_permisos_legacy.js`: Deprecated.
*   `migrate_vacaciones_legacy.js`: Deprecated.

---

## 📜 Master Protection Rules
1.  **Table `turnos`**: Represents the CLEAN Excel base. **NO** bajas, permisos, IT, vacations, or personal notes allowed here.
2.  **Table `eventos_cuadrante`**: Source of truth for all dynamic incidents (Bajas, Permisos, Cambios, Vacaciones).
3.  **Table `publicaciones_cuadrante`**: Immutable snapshots for public consumption.
4.  **Identity**: Employee IDs must be normalized (`window.normalizeId`) to prevent duplicate records.
5.  **Visual Markers**:
    *   🔄 (Sync Icon): Operative shift changes.
    *   📌 (Coverage Marker): Substitution for Bajas/Permisos/IT.
    *   🏖️ (Umbrella): Vacations.
    *   **CT**: Never use "CT" as a literal shift value in the database.

---

## ⚠️ Critical Warning: V12.5.22 Moratorium
The migration of 18 historical incidents (Bajas/Permisos) from the Excel file to `eventos_cuadrante` has been **COMPLETED**. 
**DO NOT RE-RUN `migrate_bajas.js`** without verifying the `payload.source` filter, as it will duplicate records.

---

---

## [V12.5.32 — V999 TEST CLEANUP ATTEMPT]
*   **Registro Auditado:**
    *   **id:** `eb448401-4949-4956-8dd4-f9feb8920f69`
    *   **hotel:** `TEST HOTEL`
    *   **semana:** `2026-04-27`
    *   **version:** `999`
    *   **payload:** `{ test: true }`
*   **Acción intentada:** DELETE controlado autorizado (02/05/2026).
*   **Resultado:** **FALLIDO** por políticas de Row Level Security (RLS) en `publicaciones_cuadrante`. La clave ANON no tiene permisos de borrado.
*   **Escrituras reales:** 0.
*   **Impacto:** **Nulo**. `index.html` ya filtra hoteles que empiezan por "TEST". v999 es invisible al público.
*   **Estado:** **DEUDA TÉCNICA**. Requiere limpieza manual desde el Supabase Dashboard con rol de administrador.
*   **Acción Futura:** Eliminar ID `eb448401...` manualmente. NO usar scripts de publicación para limpieza.

---

## 🏁 Checklist for Future Publications
- [x] Verify `eventos_cuadrante` for current month.
- [x] Validate Admin Preview for overlapping shifts.
- [x] Ensure version bump in `publish` logic (V133).
- [x] Confirm no administrative incidents exist in the `turnos` table.
- [x] Saneamiento de iconos premium (V12.5.31).
- [x] Regla definitiva de 📌 aplicada (V12.5.32).
- [x] Backup de v999 Test generado localmente.

