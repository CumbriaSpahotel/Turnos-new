# Reglas de desarrollo específicas del proyecto Turnos Web

## Identidades y resolución de turnos
- Al verificar la pertenencia de eventos a empleados (por ejemplo, en intercambios o sustituciones en `shift-resolver.js`), siempre se deben comparar las identidades resolviendo posibles aliases. 
- Utiliza siempre el mapa de aliases (`baseIndex.aliasesEmpleado`) para asegurar que los nombres crudos de los empleados (ej. `'Sandra'`) coincidan correctamente con sus IDs de base de datos o códigos internos (ej. `'EMP-0017'`), y viceversa.
- Pasa siempre el `context` completo que contiene la `baseIndex` a funciones auxiliares de comprobación de identidad como `eventoPerteneceAEmpleado` y `isTitularOfAbsence`.
