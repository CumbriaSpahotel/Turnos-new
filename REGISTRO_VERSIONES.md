# 📋 Registro de Versiones del Sistema (Turnos Web)

**Versión Global Actual:** `v14.77`  
**Última Actualización:** 2026-10-27  

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
| **`v14.77`** | 2026-10-27 | Módulos del sistema | Prueba de bump automático |
| **`v14.76`** | 2026-10-27 | `.agents/AGENTS.md`, `CHECKLIST_ANTES_DE_CERRAR.md`, `package.json`, `scripts/bump-version.js` | Implementación del sistema automático de versionado global y registro de cambios |
| **`v14.75`** | 2026-10-27 | `admin.js`, `index.html`, `supabase-dao.js`, `service-worker.js` | Filtrado estricto de cuadrantes para validar que la semana inicie en lunes y ajustes en sincronización de peticiones anuladas. |
| **`v14.74`** | 2026-10-24 | `admin.js`, `cambios-module.js` | Corrección en sincronización de peticiones aprobadas para no revivir eventos anulados intencionadamente. |
| **`v14.73`** | 2026-09-22 | `data/v9_excel_order_map.js`, `admin.js` | Actualización de mapeo canónico de empleados e integración con vista previa anual. |
