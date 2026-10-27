# Reglas de desarrollo específicas del proyecto Turnos Web

## Identidades y resolución de turnos
- Al verificar la pertenencia de eventos a empleados (por ejemplo, en intercambios o sustituciones en `shift-resolver.js`), siempre se deben comparar las identidades resolviendo posibles aliases. 
- Utiliza siempre el mapa de aliases (`baseIndex.aliasesEmpleado`) para asegurar que los nombres crudos de los empleados (ej. `'Sandra'`) coincidan correctamente con sus IDs de base de datos o códigos internos (ej. `'EMP-0017'`), y viceversa.
- Pasa siempre el `context` completo que contiene la `baseIndex` a funciones auxiliares de comprobación de identidad como `eventoPerteneceAEmpleado` y `isTitularOfAbsence`.

## Control de versión única global del sistema (AUTOMÁTICO E IMPERATIVO)
- El sistema utiliza una **única versión global** para todo el proyecto (ej. `v14.75`).
- **Automatización obligatoria en cada mejora/modificación**: En CADA sesión o tarea en la que se realice una modificación, mejora o corrección en cualquier módulo, vista, script o estilo:
  1. Ejecutar de forma automática e imperativa: `node scripts/bump-version.js "<descripción concisa del cambio>"`.
  2. Dicho script incrementa la versión global, actualiza [REGISTRO_VERSIONES.md](file:///c:/Users/comun/Documents/GitHub/Turnos-new/REGISTRO_VERSIONES.md) con la fecha y lista de archivos modificados, y sincroniza las etiquetas `?v=...` en `admin.html`, `index.html` y demás vistas para invalidar la caché de los clientes.
  3. Ninguna tarea debe cerrarse sin haber ejecutado automáticamente este proceso si hubo cambios de código.
