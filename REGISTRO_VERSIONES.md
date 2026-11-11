# 📋 Registro de Versiones del Sistema (Turnos Web)

**Versión Global Actual:** `v14.90`  
**Última Actualización:** 2026-11-11  

---

## 📌 Regla de Versión Única
1. **Versión Única Global**: Todo el sistema comparte un único número de versión global (ej. `v14.75`).
2. **Incremento ante cambios**: Cada vez que se realice una modificación en cualquier módulo, script, estilo o componente del sistema, se incrementará la versión global (ej. `v14.75` -> `v14.76`).
3. **Invalidación de Caché**: La nueva versión se reflejará en las llamadas de carga de scripts (`?v=...`) en los HTML (`admin.html`, `index.html`, etc.) de los módulos modificados y del orquestador principal (`admin.js`).
4. **Registro Obligatorio**: Cada cambio debe registrarse en la tabla histórica de este documento indicando:
   - **Versión**: Nueva versión global asignada.
   - **Fecha**: Fecha de la modificación (AAAA-MM-DD).
   - **Módulos / Archivos Modificados**: Qué archivos cambiaron.
   - **Descripción**: Resumen de los cambios realizados.

---

## 📜 Historial de Versiones

| Versión | Fecha | Módulos / Archivos Modificados | Descripción del Cambio |
| :---: | :---: | :--- | :--- |
| **`v14.90`** | 2026-11-11 | `admin.css`, `admin.html`, `admin.js` | Menú lateral minimizable y fechas del cuadrante en formato dd/mes/aa |
| **`v14.89`** | 2026-11-09 | `admin.html`, `index.html`, `live.mobile.html`, `package.json`, `service-worker.js`, `sw.js`, `paygold-config.js`, `paygold-server.js`, `paygold-service.js`, `paygold.html` | Modulo e interfaz PayGold Redsys REST para Hotel Guadiana (168355840) |
| **`v14.88`** | 2026-11-09 | `admin.html`, `index.html`, `live.mobile.html`, `service-worker.js`, `sw.js` | Correccion critica en Service Worker: evitar interceptar Supabase/admin y eliminar TypeError convert Response |
| **`v14.87`** | 2026-11-09 | `admin.html`, `admin.js`, `data/v9_excel_order_map.js`, `data/v9_excel_order_map.json`, `index.html`, `live.mobile.html`, `scripts/apply_guadiana_16nov_shifts.js`, `scripts/assign_vacante_guadiana_marcos.js` | Asignacion definitiva vacante Guadiana a Marcos (EMP-0020) desde 23/11/2026 |
| **`v14.86`** | 2026-11-09 | `scripts/apply_guadiana_16nov_shifts.js` | Reasignacion turnos semana 16/11/2026 Guadiana: Elena asume turnos Natalio y Marcos asume Elena |
| **`v14.85`** | 2026-11-09 | `scripts/apply_guadiana_09nov_shifts.js`, `scripts/inspect_cells.js`, `scripts/inspect_full_pub.js`, `scripts/inspect_guadiana_09nov.js` | Ajuste turnos 09/11/2026 Guadiana: Macarena Manana, Elena Tarde, Dani Noche (v158) |
| **`v14.84`** | 2026-11-09 | `admin.html`, `admin.js`, `index.html`, `live.mobile.html` | Mejora guardado y publicacion Modo Excel con resolucion de aliases e invalidacion de cache |
| **`v14.83`** | 2026-11-09 | Módulos del sistema | --help |
| **`v14.82`** | 2026-11-04 | `scripts/apply_federico_natalio_shifts.js` | Reasignacion turnos semana 09/11/2026: Federico asume turnos de Natalio en Cumbria |
| **`v14.81`** | 2026-10-28 | `admin.html`, `admin.js`, `index.html`, `live.mobile.html` | Correccion de falso positivo en deteccion de turno de noche sin cobertura en dashboard |
| **`v14.80`** | 2026-10-28 | `index.html` | Fecha de ultima modificacion general y por hotel en vista publica, seguimiento de noches/descansos para Diana y verificacion de vacaciones 2-8 nov |
| **`v14.79`** | 2026-10-28 | `admin.js`, `js/hide-publication.js` | Correccion de flechas para cambiar posicion de empleados y compatibilidad en ocultar turnos publicados |
| **`v14.78`** | 2026-10-28 | `admin.js`, `turnos-rules.js` | Ocultar en cuadrante y vistas a empleados sin turnos ni ausencias en la semana (Natalio) |
| **`v14.77`** | 2026-10-27 | Módulos del sistema | Prueba de bump automático |
| **`v14.76`** | 2026-10-27 | `.agents/AGENTS.md`, `CHECKLIST_ANTES_DE_CERRAR.md`, `package.json`, `scripts/bump-version.js` | Implementación del sistema automático de versionado global y registro de cambios |
| **`v14.75`** | 2026-10-27 | `admin.js`, `index.html`, `supabase-dao.js`, `service-worker.js` | Filtrado estricto de cuadrantes para validar que la semana inicie en lunes y ajustes en sincronización de peticiones anuladas. |
| **`v14.74`** | 2026-10-24 | `admin.js`, `cambios-module.js` | Corrección en sincronización de peticiones aprobadas para no revivir eventos anulados intencionadamente. |
| **`v14.73`** | 2026-09-22 | `data/v9_excel_order_map.js`, `admin.js` | Actualización de mapeo canónico de empleados e integración con vista previa anual. |
