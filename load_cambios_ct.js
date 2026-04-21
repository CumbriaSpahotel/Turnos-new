/**
 * SCRIPT DE CARGA MASIVA - CAMBIOS DE TURNO (CT)
 * Ejecutar en la consola del navegador desde admin.html
 * 
 * Datos extraídos de la imagen de Excel.
 * Columnas: hotel_id, fecha (YYYY-MM-DD), empleado_id, sustituto, turno (turno original), tipo_ausencia (nota)
 * tipo = 'CT' (Cambio de Turno)
 */
(async () => {
    const records = [
        // Hotel, Fecha, Empleado (ausente), Sustituto, Turno Original, Nota
        ["Sercotel Guadiana",  "2025-09-08", "Diana",          "Esther",          "", ""],
        ["Sercotel Guadiana",  "2025-09-15", "Macarena",       "Sergio Sánchez",  "", ""],
        ["Sercotel Guadiana",  "2025-09-19", "Diana",          "Dani",            "", ""],
        ["Cumbria Spa&Hotel",  "2025-10-01", "Cristina",       "Miriam",          "", ""],
        ["Cumbria Spa&Hotel",  "2025-10-04", "Sergio",         "",                "", ""],
        ["Cumbria Spa&Hotel",  "2025-10-05", "Cristina",       "Sergio",          "", ""],
        ["Cumbria Spa&Hotel",  "2025-10-06", "Cristina",       "Sergio",          "", ""],
        ["Cumbria Spa&Hotel",  "2025-10-08", "Cristina",       "",                "", ""],
        ["Sercotel Guadiana",  "2025-10-09", "Dani",           "Macarena",        "", ""],
        ["Sercotel Guadiana",  "2025-10-11", "Diana",          "Sergio Sánchez",  "", ""],
        ["Sercotel Guadiana",  "2025-10-12", "Diana",          "Macarena",        "", ""],
        ["Sercotel Guadiana",  "2025-10-13", "Macarena",       "",                "", ""],
        ["Cumbria Spa&Hotel",  "2025-10-15", "Valentín",       "Miriam",          "", ""],
        ["Cumbria Spa&Hotel",  "2025-10-16", "Miriam",         "Natalia",         "", ""],
        ["Cumbria Spa&Hotel",  "2025-10-17", "Valentín",       "Miriam",          "", ""],
        ["Sercotel Guadiana",  "2025-10-18", "Miriam",         "Valentín",        "", ""],
        ["Sercotel Guadiana",  "2025-10-19", "Valentín",       "Miriam",          "", ""],
        ["Sercotel Guadiana",  "2025-10-19", "Valentín",       "Miriam",          "", ""],
        ["Cumbria Spa&Hotel",  "2025-10-22", "Macarena",       "Diana",           "", ""],
        ["Sercotel Guadiana",  "2025-10-28", "Dani",           "Federico",        "", ""],
        ["Sercotel Guadiana",  "2025-10-30", "Dani",           "Federico",        "", ""],
        ["Sercotel Guadiana",  "2025-10-31", "Federico",       "Diana",           "", ""],
        ["Sercotel Guadiana",  "2025-11-06", "Federico",       "Diana",           "", ""],
        ["Cumbria Spa&Hotel",  "2025-11-07", "Cristina",       "Miriam",          "", ""],
        ["Sercotel Guadiana",  "2025-11-07", "Diana",          "Dani",            "", ""],
        ["Sercotel Guadiana",  "2025-11-07", "Diana",          "",                "", ""],
        ["Sercotel Guadiana",  "2025-11-10", "Dani",           "Diana",           "", ""],
        ["Sercotel Guadiana",  "2025-11-12", "Diana",          "Dani",            "", ""],
        ["Sercotel Guadiana",  "2025-11-14", "Diana",          "Dani",            "", ""],
        ["Sercotel Guadiana",  "2025-11-15", "Diana",          "Dani",            "", ""],
        ["Sercotel Guadiana",  "2025-11-17", "Diana",          "Dani",            "", ""],
        ["Sercotel Guadiana",  "2025-11-18", "Diana",          "Dani",            "", ""],
        ["Sercotel Guadiana",  "2025-11-19", "Diana",          "Dani",            "", ""],
        ["Sercotel Guadiana",  "2025-11-20", "Diana",          "Dani",            "", ""],
        ["Sercotel Guadiana",  "2025-11-21", "Diana",          "Dani",            "", ""],
        ["Sercotel Guadiana",  "2025-11-22", "Diana",          "Dani",            "", "Comida Familiar"],
        ["Sercotel Guadiana",  "2025-11-26", "Macarena",       "Federico",        "", ""],
        ["Sercotel Guadiana",  "2025-11-27", "Macarena",       "Diana",           "", ""],
        ["Sercotel Guadiana",  "2025-11-28", "Macarena",       "Diana",           "", ""],
        ["Sercotel Guadiana",  "2025-12-04", "Diana",          "Dani",            "", ""],
        ["Sercotel Guadiana",  "2025-12-05", "Macarena",       "Diana",           "", "Muerte del Padre"],
        ["Sercotel Guadiana",  "2025-12-06", "Macarena",       "Diana",           "", "Muerte del Padre"],
        ["Sercotel Guadiana",  "2025-12-13", "Macarena",       "Dani",            "Noche", ""],
        ["Sercotel Guadiana",  "2025-12-14", "Macarena",       "Dani",            "Noche", ""],
        ["Sercotel Guadiana",  "2025-12-15", "Macarena",       "Dani",            "Noche", ""],
        ["Sercotel Guadiana",  "2025-12-16", "Macarena",       "Dani",            "Noche", ""],
        ["Sercotel Guadiana",  "2025-12-26", "Dani",           "Macarena",        "", ""],
        ["Sercotel Guadiana",  "2025-12-29", "Macarena",       "Diana",           "", "REHABILITACION"],
        ["Sercotel Guadiana",  "2026-01-05", "Sergio Sánchez", "Dani",            "", ""],
        ["Sercotel Guadiana",  "2026-01-28", "Sergio Sánchez", "Natalia",         "", ""],
        ["Sercotel Guadiana",  "2026-02-04", "Isabel Hidalgo", "",                "", "Celebración cumpleaños"],
        ["Sercotel Guadiana",  "2026-02-07", "Diana",          "Macarena",        "", ""],
        ["Cumbria Spa&Hotel",  "2026-02-07", "Isabel Hidalgo", "Natalia",         "", ""],
        ["Sercotel Guadiana",  "2026-02-10", "Dani",           "Diana",           "", "Conciliación familiar"],
        ["Cumbria Spa&Hotel",  "2026-02-14", "Cristina",       "Isabel Hidalgo",  "", ""],
        ["Cumbria Spa&Hotel",  "2026-02-15", "Sergio",         "Natalia",         "", ""],
        ["Sercotel Guadiana",  "2026-02-19", "Dani",           "Cristina",        "", ""],
        ["Sercotel Guadiana",  "2026-02-21", "Diana",          "Macarena",        "", ""],
        ["Sercotel Guadiana",  "2026-02-22", "Diana",          "Macarena",        "", ""],
        ["Sercotel Guadiana",  "2026-02-25", "Macarena",       "Federico",        "", ""],
        ["Cumbria Spa&Hotel",  "2026-02-28", "Miriam",         "Cristina",        "", ""],
        ["Cumbria Spa&Hotel",  "2026-03-01", "Diana",          "Isabel Hidalgo",  "", ""],
        ["Sercotel Guadiana",  "2026-03-03", "Cristina",       "Isabel Hidalgo",  "", ""],
        ["Sercotel Guadiana",  "2026-03-07", "Macarena",       "Dani",            "", ""],
        ["Cumbria Spa&Hotel",  "2026-03-09", "Dani",           "",                "", ""],
        ["Sercotel Guadiana",  "2026-03-10", "Macarena",       "Dani",            "", ""],
        ["Sercotel Guadiana",  "2026-03-14", "Dani",           "Macarena",        "", ""],
        ["Cumbria Spa&Hotel",  "2026-03-18", "Sergio",         "Esther",          "", ""],
        ["Cumbria Spa&Hotel",  "2026-03-19", "Sergio",         "Esther",          "", ""],
        ["Sercotel Guadiana",  "2026-03-26", "Dani",           "Macarena",        "", ""],
        ["Cumbria Spa&Hotel",  "2026-04-01", "Cristina",       "Miriam",          "", ""],
        ["Cumbria Spa&Hotel",  "2026-04-06", "Diana",          "Dani",            "", ""],
        ["Cumbria Spa&Hotel",  "2026-04-15", "Miriam",         "Cristina",        "", ""],
        ["Cumbria Spa&Hotel",  "2026-04-16", "Miriam",         "Cristina",        "", ""],
        ["Cumbria Spa&Hotel",  "2026-04-18", "Miriam",         "Cristina",        "", ""],
        ["Cumbria Spa&Hotel",  "2026-04-19", "Dani",           "Macarena",        "", ""],
        ["Sercotel Guadiana",  "2026-04-19", "Diana",          "Macarena",        "", ""],
        ["Sercotel Guadiana",  "2026-04-25", "Dani",           "Macarena",        "", ""],
        ["Sercotel Guadiana",  "2026-04-26", "Dani",           "Macarena",        "", ""],
        ["Sercotel Guadiana",  "2026-05-02", "Diana",          "Dani",            "", ""],
        ["Sercotel Guadiana",  "2026-05-03", "Macarena",       "Dani",            "", "Cumpleaños"],
        ["Sercotel Guadiana",  "2026-05-04", "Diana",          "Dani",            "", "Ampliación descanso"],
        ["Sercotel Guadiana",  "2026-05-06", "Diana",          "Dani",            "", ""],
        ["Sercotel Guadiana",  "2026-05-08", "Diana",          "Dani",            "", ""],
    ];

    const client = window.supabase;
    if (!client) { alert("Sin conexión a Supabase. Ejecuta desde admin.html"); return; }

    const { data: { session } } = await client.auth.getSession();
    const userEmail = session?.user?.email || 'CT_IMPORT';

    const payload = records.map(([hotel_id, fecha, empleado_id, sustituto, turno, nota]) => ({
        hotel_id,
        fecha,
        empleado_id,
        sustituto: sustituto || null,
        turno: turno || nota || '',  // guardamos nota en turno como referencia
        tipo: 'CT',
        updated_by: userEmail,
        updated_at: new Date().toISOString()
    }));

    console.log(`Insertando ${payload.length} cambios de turno...`);

    // Insertar en lotes de 20
    const BATCH = 20;
    let ok = 0, fail = 0;
    for (let i = 0; i < payload.length; i += BATCH) {
        const batch = payload.slice(i, i + BATCH);
        const { error } = await client
            .from('turnos')
            .upsert(batch, { onConflict: 'empleado_id,fecha' });
        if (error) {
            console.error(`Lote ${i}-${i+BATCH} FALLIDO:`, error.message);
            fail += batch.length;
        } else {
            ok += batch.length;
            console.log(`✅ Lote ${i}-${i+BATCH} OK`);
        }
    }

    alert(`✅ Cambios de Turno cargados:\n${ok} exitosos / ${fail} fallidos\n\nRecarga cambios.html para verlos.`);
})();
