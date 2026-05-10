# Checklist obligatorio antes de cerrar una tarea

## Errores de consola

- [ ] No hay Uncaught SyntaxError
- [ ] No hay Illegal return statement
- [ ] No hay ReferenceError
- [ ] No hay "is not defined"
- [ ] No hay Unexpected token
- [ ] No hay Cannot read properties of undefined
- [ ] No hay Failed to load module
- [ ] No hay errores 400 de Supabase
- [ ] No hay fecha=lte.null ni fecha=gte.null

## Visualización

- [ ] Baja se ve como Baja 🩺
- [ ] Permiso se ve como Permiso 🗓️
- [ ] No hay emojis duplicados
- [ ] Descanso se ve rojo suave
- [ ] Noche mantiene 🌙
- [ ] Mañana mantiene verde
- [ ] Tarde mantiene amarillo
- [ ] Vacaciones mantiene su estilo

## Sustituciones

- [ ] Sustituto de Baja lleva 📌
- [ ] Sustituto de Permiso lleva 📌
- [ ] Sustituto de Vacaciones no lleva 📌

## Cambios / intercambios

- [ ] Intercambio activo se aplica
- [ ] Ambos participantes muestran 🔄
- [ ] Caso Dani ↔ Próximamente:
      Dani = Tarde 🔄
      Próximamente = Mañana 🔄

## Estados

- [ ] Activos se aplican
- [ ] Anulados no se aplican
- [ ] Anulados se ven en admin con filtro Anulados o Ver Todos

## Snapshot

- [ ] Snapshot usa matriz final resuelta
- [ ] No aparece destino ¿?
- [ ] No se permite publicar con destino desconocido
- [ ] No faltan iconos 🔄 en intercambios activos

## Codificación

- [ ] No hay mojibake en textos visibles
- [ ] No hay caracteres Ã, Â ni  en archivos fuente relevantes
- [ ] HTML contiene meta charset UTF-8

## Técnica

- [ ] node --check admin.js
- [ ] node --check shift-resolver.js
- [ ] node --check supabase-dao.js
- [ ] node --check script.js si existe
- [ ] node --check mobile.js si existe
- [ ] npm run build si existe
- [ ] npm test si existe
- [ ] npm run regression-check si existe
