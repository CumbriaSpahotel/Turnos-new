const fs = require('fs');

const replacements = [
    [/sincronizaciÃ³n/g, 'sincronización'],
    [/producciÃ³n/g, 'producción'],
    [/publicaciÃ³n/g, 'publicación'],
    [/selecciÃ³n/g, 'selección'],
    [/mÃ³vil/g, 'móvil'],
    [/PÃºblica/g, 'Pública'],
    [/pÃºblica/g, 'pública'],
    [/versiÃ³n/g, 'versión'],
    [/VERSIÃ“N/g, 'VERSIÓN'],
    [/VERSIÃ³N/g, 'VERSIÓN'],
    [/Ãºltima/g, 'última'],
    [/Ã©xito/g, 'éxito'],
    [/CRÃTICO/g, 'CRÍTICO'],
    [/crÃtico/g, 'crítico'],
    [/CRÃTICOS/g, 'CRÍTICOS'],
    [/crÃticos/g, 'críticos'],
    [/operaciÃ³n/g, 'operación'],
    [/informaciÃ³n/g, 'información'],
    [/validaciÃ³n/g, 'validación'],
    [/confirmaciÃ³n/g, 'confirmación'],
    [/cancelaciÃ³n/g, 'cancelación'],
    [/acciÃ³n/g, 'acción'],
    [/prÃ³ximo/g, 'próximo'],
    [/tambiÃ³n/g, 'también'],
    [/tambiÃ©n/g, 'también'],
    [/estÃ¡n/g, 'están'],
    [/estÃ¡/g, 'está'],
    [/dÃa/g, 'día'],
    [/dÃ­a/g, 'día'],
    [/compaÃ±ero/g, 'compañero'],
    [/aÃ±o/g, 'año'],
    [/espaÃ±ol/g, 'español'],
    [/maÃ±ana/g, 'mañana'],
    [/MAÃ‘ANA/g, 'MAÑANA'],
    [/baÃ±o/g, 'baño'],
    [/niÃ±o/g, 'niño'],
    [/Â¿/g, '¿'],
    [/Â¡/g, '¡'],
    [/â€“/g, '–'],
    [/â€”/g, '—'],
    [/â€œ/g, '“'],
    [/â€\x9D/g, '”'],
    [/â€˜/g, '‘'],
    [/â€™/g, '’'],
    [/â€¢/g, '•'],
    [/â€¦/g, '…'],
    [/ÃšNICO/g, 'ÚNICO'],
    [/RESOLUCIÃ“N/g, 'RESOLUCIÓN'],
    [/DetecciÃ³n/g, 'Detección'],
    [/VerificaciÃ³n/g, 'Verificación'],
    [/raÃ­z/g, 'raíz'],
    [/anulaciÃ³n/g, 'anulación'],
    [/explÃ­cita/g, 'explícita'],
    [/mÃºltiples/g, 'múltiples'],
    [/lÃ³gica/g, 'lógica'],
    [/LÃ“GICA/g, 'LÓGICA'],
    [/MÃ¡xima/g, 'Máxima'],
    [/MÃ­nima/g, 'Mínima'],
    [/posiciÃ³n/g, 'posición'],
    [/PosiciÃ³n/g, 'Posición'],
    [/SÃ­/g, 'Sí'],
    [/diagnÃ³stico/g, 'diagnóstico'],
    [/especÃ­f/g, 'específ'],
    [/OcupaciÃ³n/g, 'Ocupación'],
    [/RECONSTRUCCIÃ“N/g, 'RECONSTRUCCIÓN'],
    [/resoluciÃ³n/g, 'resolución'],
    [/confusiÃ³n/g, 'confusión'],
    [/ÃNDICES/g, 'ÍNDICES'],
    [/REGRESIÃ“N/g, 'REGRESIÓN'],
    [/funciÃ³n/g, 'función'],
    [/FunciÃ³n/g, 'Función'],
    [/AÃ±adir/g, 'Añadir'],
    [/aÃ±adir/g, 'añadir'],
    [/MÃ¡s/g, 'Más'],
    [/mÃ¡s/g, 'más'],
    [/Ãš/g, 'Ú'],
    [/Ã“/g, 'Ó'],
    [/Ã /g, 'Á'],
    [/Ã¡/g, 'á'],
    [/Ã©/g, 'é'],
    [/Ã­/g, 'í'],
    [/Ã³/g, 'ó'],
    [/Ãº/g, 'ú'],
    [/Ã±/g, 'ñ'],
    [/Ã‘/g, 'Ñ'],
    // specific to admin.html / admin.js legacy:
    [/ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â /g, '—'],
    [/MaÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â±ana/g, 'Mañana']
];

const files = ['shift-resolver.js', 'mobile.app.js', 'publish_v8.js', 'supabase-dao.js', 'admin.js', 'admin.html', 'index.html', 'live.mobile.html', 'cambios-module.js', 'turnos-rules.js'];

files.forEach(file => {
    if (!fs.existsSync(file)) return;
    let content = fs.readFileSync(file, 'utf8');
    let changed = false;
    
    replacements.forEach(([regex, repl]) => {
        if (regex.test(content)) {
            content = content.replace(regex, repl);
            changed = true;
        }
    });

    if (changed) {
        fs.writeFileSync(file, content, 'utf8');
        console.log(`Updated mojibake in ${file}`);
    }
});
