# 📋 Registro de Versiones y Módulos del Sistema

Este documento mantiene el inventario centralizado de versiones y fechas de actualización de todos los módulos y componentes de **Turnos Web**.

> **Regla de mantenimiento obligatorio:**  
> Cada vez que se realice cualquier modificación en un módulo, se debe incrementar su versión, actualizar la fecha en esta tabla y reflejar el incremento de versión en los tags de carga HTML (`?v=...`) correspondientes para evitar problemas de caché en clientes y panel de administración.

---

## 📦 Inventario de Módulos

| Módulo / Archivo | Versión Actual | Fecha Actualización | Ubicación / Inclusión | Descripción / Responsabilidad |
| :--- | :---: | :---: | :--- | :--- |
| **`admin.js`** | `v14.75` | 2026-10-27 | `admin.html?v=14.75` | Orquestador principal del panel de administración y control operativo. |
| **`supabase-dao.js`** | `v13.32` | 2026-10-27 | `admin.html`, `index.html?v=13.32` | Capa de acceso a datos, API de Supabase, caché y persistencia de eventos/turnos. |
| **`shift-resolver.js`** | `v14.65` | 2026-10-24 | `admin.html`, `index.html?v=14.65` | Motor único de resolución de turnos (cruces de bajas, permisos, vacaciones, cambios). |
| **`cambios-module.js`** | `v14.75` | 2026-10-24 | `admin.html?v=14.75` | Gestión de peticiones e intercambios de turnos. |
| **`turnos-rules.js`** | `v14.10` | 2026-10-24 | `admin.html`, `index.html?v=14.10` | Reglas de negocio, validaciones y estilos visuales de turnos. |
| **`bajas-module.js`** | `v1.2` | 2026-08-06 | `admin.html?v=1.2` | Gestión de bajas médicas, permisos e IT. |
| **`vacaciones-module.js`** | `v1.3` | 2026-07-18 | `admin.html?v=1.3` | Módulo de gestión y solicitud de vacaciones. |
| **`turnos-engine.js`** | `v13.45` | 2026-06-08 | `admin.html?v=13.45` | Motor de cálculo base y transformaciones de cuadrante. |
| **`excel-loader.js`** | `v13.45` | 2026-08-07 | `admin.html?v=13.45` | Procesamiento e importación de cuadrantes desde Excel. |
| **`publication-snapshot.js`** | `v1.1` | 2026-04-26 | `admin.html`, `index.html?v=1.1` | Generación y formateo de snapshots inmutables para publicación. |
| **`supabase-config.js`** | `v13.8` | 2026-08-07 | `admin.html`, `index.html?v=13.8` | Configuración de credenciales y cliente Supabase. |
| **`sync-status.js`** | `v13.19` | 2026-08-24 | `admin.html?v=13.19` | Monitorización del estado de sincronización y conectividad en tiempo real. |
| **`sync-gaps.js`** | `v1.0` | 2026-05-19 | `admin.html?v=1.0` | Detección y corrección de discrepancias en eventos y turnos. |
| **`js/weekly-vacancy.js`** | `v1.0` | 2026-09-22 | `admin.html?v=1.0` | Gestión de vacantes y refuerzos semanales. |
| **`js/annual-publication.js`** | `v1.0` | 2026-09-22 | `admin.html?v=1.0` | Publicación anual y consolidación a largo plazo. |
| **`js/hide-publication.js`** | `v1.0` | 2026-09-22 | `admin.html?v=1.0` | Control de visibilidad y ocultación de semanas publicadas. |
| **`js/reassignment-module.js`** | `v1.0` | 2026-09-22 | `admin.html` | Módulo de reasignaciones operativas de personal. |
| **`data/v9_excel_order_map.js`** | `v14.73` | 2026-09-22 | `admin.html?v=14.73` | Mapa de orden canónico de empleados según Excel V9. |
| **`service-worker.js` / `sw.js`** | `v13.35` | 2026-10-27 | `index.html?v=13.35` | Cache offline y Service Worker de la aplicación pública. |
| **`virtualizer.js`** | `v1.0` | 2026-09-29 | `index.html` | Renderizado virtualizado de grandes volúmenes de turnos. |
