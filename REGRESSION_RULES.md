# Reglas protegidas del proyecto Turnos Web

## Visualización de turnos

1. Mañana mantiene estilo verde.
2. Tarde mantiene estilo amarillo.
3. Noche debe mostrarse como: Noche 🌙
4. Descanso debe tener fondo rojo suave, texto rojo oscuro y borde rojo suave.
5. Vacaciones mantiene su estilo actual y su emoji actual.
6. Permiso debe mostrarse exactamente como: Permiso 🗓️
7. Baja debe mostrarse exactamente como: Baja 🩺
8. Permiso y Baja deben compartir estilo lila/morado claro.
9. No puede haber emojis duplicados:
   - No Permiso 🗓️ 🗓️
   - No Baja 🩺 🩺

## Sustituciones

10. El símbolo 📌 solo se coloca en la persona que sustituye una Baja o un Permiso.
11. El símbolo 📌 no se usa en sustitutos de Vacaciones.
12. El símbolo 📌 no se coloca en la persona ausente.
13. La persona ausente muestra su ausencia:
    - Baja 🩺
    - Permiso 🗓️
    - Vacaciones

## Cambios e intercambios

14. Un cambio/intercambio activo debe aplicarse a la matriz semanal final.
15. Un intercambio debe marcar con 🔄 a ambos participantes.
16. Un intercambio con sustituto operativo debe aplicarse contra el ocupante visible, no solo contra empleados base del Excel.
17. Caso protegido obligatorio:
    Hotel: Sercotel Guadiana
    Semana: 2026-10-19 al 2026-10-25
    Fecha: 2026-10-21
    Intercambio: Dani ↔ Próximamente
    Resultado obligatorio:
    - Dani = Tarde 🔄
    - Próximamente = Mañana 🔄

## Estados e histórico

18. Los eventos activos se aplican al cuadrante.
19. Los eventos anulados o denegados no se aplican al cuadrante.
20. Los eventos anulados o denegados sí deben verse en el panel administrativo si el filtro lo permite.
21. No se deben borrar físicamente registros operativos; deben conservarse como histórico mediante estado.

## Snapshot / publicación

22. El snapshot debe validarse contra la matriz final ya resuelta.
23. Si un intercambio tiene destino desconocido, la publicación debe bloquearse.
24. No se permite publicar ignorando destino:
    - ¿?
    - DESCONOCIDO
    - null
    - undefined
    - vacío
25. El destino del intercambio Dani ↔ Próximamente debe resolverse como Próximamente.
26. No se puede publicar si faltan iconos 🔄 en un intercambio activo.

## Codificación

27. No puede reaparecer mojibake:
    - Ãƒ
    - Ã‚
    - �
    - CrÃƒticos
    - GestiÃƒÂ³n
    - versiÃƒÂ³n
    - RÃƒÂ¡pidas
28. Todos los HTML principales deben tener:
    <meta charset="UTF-8">
29. Los archivos deben estar guardados como UTF-8.

## Rango de fechas

30. Nunca se puede consultar Supabase con:
    - fecha=lte.null
    - fecha=gte.null
    - fecha=lte.undefined
    - fecha=gte.undefined
    - Invalid Date
31. startISO y endISO deben ser siempre fechas ISO válidas YYYY-MM-DD.
32. El Panel General debe mostrar claramente qué semana/rango está auditando.

## Vistas

33. Las reglas visuales deben aplicarse en:
    - admin
    - index
    - mobile
    - vista previa
    - snapshot/publicación si renderiza celdas
34. No se puede corregir una vista y dejar otra rota.
