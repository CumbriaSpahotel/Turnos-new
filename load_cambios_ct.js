/**
 * Sincroniza Cambios de turno.xlsx contra Supabase.
 * Ejecutar en la consola del navegador desde admin.html o cambios.html.
 * Fuente: Cambios de turno.xlsx normalizado el 2026-04-22.
 *
 * Reglas:
 * - El Excel es la fuente de verdad entre 2025-09-08 y 2026-05-15.
 * - Inserta/actualiza un registro CT por empleado-fecha.
 * - Borra CT sobrantes de ese rango que no est?n en el Excel.
 * - Anula eventos modernos REGULARIZACION_CT_EXCEL para evitar duplicados.
 */
(async () => {
    const records = [
        [
                "Sercotel Guadiana",
                "2025-09-08",
                "Diana",
                "Esther"
        ],
        [
                "Sercotel Guadiana",
                "2025-09-15",
                "Macarena",
                "Sergio Sánchez"
        ],
        [
                "Sercotel Guadiana",
                "2025-09-15",
                "Sergio Sánchez",
                "Dani"
        ],
        [
                "Cumbria Spa&Hotel",
                "2025-10-01",
                "Cristina",
                "Miriam"
        ],
        [
                "Cumbria Spa&Hotel",
                "2025-10-04",
                "Cristina",
                "Sergio"
        ],
        [
                "Cumbria Spa&Hotel",
                "2025-10-05",
                "Cristina",
                "Sergio"
        ],
        [
                "Cumbria Spa&Hotel",
                "2025-10-06",
                "Cristina",
                "Sergio"
        ],
        [
                "Cumbria Spa&Hotel",
                "2025-10-08",
                "Cristina",
                "Miriam"
        ],
        [
                "Sercotel Guadiana",
                "2025-10-10",
                "Dani",
                "Macarena"
        ],
        [
                "Sercotel Guadiana",
                "2025-10-11",
                "Diana",
                "Sergio Sánchez"
        ],
        [
                "Sercotel Guadiana",
                "2025-10-12",
                "Diana",
                "Sergio Sánchez"
        ],
        [
                "Sercotel Guadiana",
                "2025-10-13",
                "Dani",
                "Macarena"
        ],
        [
                "Cumbria Spa&Hotel",
                "2025-10-15",
                "Valentín",
                "Miriam"
        ],
        [
                "Cumbria Spa&Hotel",
                "2025-10-16",
                "Valentín",
                "Natalio"
        ],
        [
                "Cumbria Spa&Hotel",
                "2025-10-18",
                "Miriam",
                "Valentín"
        ],
        [
                "Cumbria Spa&Hotel",
                "2025-10-18",
                "Valentín",
                "Natalio"
        ],
        [
                "Cumbria Spa&Hotel",
                "2025-10-19",
                "Miriam",
                "Valentín"
        ],
        [
                "Cumbria Spa&Hotel",
                "2025-10-19",
                "Valentín",
                "Miriam"
        ],
        [
                "Sercotel Guadiana",
                "2025-10-22",
                "Macarena",
                "Diana"
        ],
        [
                "Sercotel Guadiana",
                "2025-10-28",
                "Dani",
                "Federico"
        ],
        [
                "Sercotel Guadiana",
                "2025-10-29",
                "Dani",
                "Federico"
        ],
        [
                "Sercotel Guadiana",
                "2025-10-30",
                "Dani",
                "Federico"
        ],
        [
                "Sercotel Guadiana",
                "2025-10-31",
                "Dani",
                "Federico"
        ],
        [
                "Sercotel Guadiana",
                "2025-11-06",
                "Federico",
                "Diana"
        ],
        [
                "Cumbria Spa&Hotel",
                "2025-11-07",
                "Cristina",
                "Miriam"
        ],
        [
                "Sercotel Guadiana",
                "2025-11-09",
                "Macarena",
                "Diana"
        ],
        [
                "Sercotel Guadiana",
                "2025-11-10",
                "Dani",
                "Diana"
        ],
        [
                "Sercotel Guadiana",
                "2025-11-12",
                "Dani",
                "Diana"
        ],
        [
                "Sercotel Guadiana",
                "2025-11-13",
                "Diana",
                "Dani"
        ],
        [
                "Sercotel Guadiana",
                "2025-11-14",
                "Diana",
                "Dani"
        ],
        [
                "Sercotel Guadiana",
                "2025-11-15",
                "Diana",
                "Dani"
        ],
        [
                "Sercotel Guadiana",
                "2025-11-16",
                "Diana",
                "Dani"
        ],
        [
                "Sercotel Guadiana",
                "2025-11-17",
                "Diana",
                "Dani"
        ],
        [
                "Sercotel Guadiana",
                "2025-11-18",
                "Diana",
                "Dani"
        ],
        [
                "Sercotel Guadiana",
                "2025-11-19",
                "Diana",
                "Dani"
        ],
        [
                "Sercotel Guadiana",
                "2025-11-20",
                "Diana",
                "Dani"
        ],
        [
                "Sercotel Guadiana",
                "2025-11-21",
                "Diana",
                "Dani"
        ],
        [
                "Sercotel Guadiana",
                "2025-11-25",
                "Diana",
                "Dani"
        ],
        [
                "Sercotel Guadiana",
                "2025-11-26",
                "Diana",
                "Federico"
        ],
        [
                "Sercotel Guadiana",
                "2025-11-26",
                "Macarena",
                "Federico"
        ],
        [
                "Sercotel Guadiana",
                "2025-11-27",
                "Macarena",
                "Diana"
        ],
        [
                "Sercotel Guadiana",
                "2025-11-28",
                "Macarena",
                "Diana"
        ],
        [
                "Sercotel Guadiana",
                "2025-12-04",
                "Macarena",
                "Diana"
        ],
        [
                "Sercotel Guadiana",
                "2025-12-05",
                "Macarena",
                "Diana"
        ],
        [
                "Sercotel Guadiana",
                "2025-12-13",
                "Macarena",
                "Dani"
        ],
        [
                "Sercotel Guadiana",
                "2025-12-14",
                "Macarena",
                "Dani"
        ],
        [
                "Sercotel Guadiana",
                "2025-12-15",
                "Macarena",
                "Dani"
        ],
        [
                "Sercotel Guadiana",
                "2025-12-16",
                "Macarena",
                "Dani"
        ],
        [
                "Sercotel Guadiana",
                "2025-12-26",
                "Dani",
                "Diana"
        ],
        [
                "Sercotel Guadiana",
                "2025-12-29",
                "Macarena",
                "Diana"
        ],
        [
                "Sercotel Guadiana",
                "2026-01-01",
                "Sergio Sánchez",
                "Dani"
        ],
        [
                "Cumbria Spa&Hotel",
                "2026-01-06",
                "Isabel Hidalgo",
                "Natalio"
        ],
        [
                "Sercotel Guadiana",
                "2026-01-06",
                "Sergio Sánchez",
                "Dani"
        ],
        [
                "Cumbria Spa&Hotel",
                "2026-01-07",
                "Cristina",
                "Isabel Hidalgo"
        ],
        [
                "Sercotel Guadiana",
                "2026-01-07",
                "Diana",
                "Macarena"
        ],
        [
                "Sercotel Guadiana",
                "2026-01-10",
                "Diana",
                "Dani"
        ],
        [
                "Cumbria Spa&Hotel",
                "2026-01-14",
                "Cristina",
                "Isabel Hidalgo"
        ],
        [
                "Cumbria Spa&Hotel",
                "2026-01-15",
                "Isabel Hidalgo",
                "Cristina"
        ],
        [
                "Sercotel Guadiana",
                "2026-01-15",
                "Sergio Sánchez",
                "Natalio"
        ],
        [
                "Sercotel Guadiana",
                "2026-01-29",
                "Federico",
                "Diana"
        ],
        [
                "Cumbria Spa&Hotel",
                "2026-02-04",
                "Miriam",
                "Cristina"
        ],
        [
                "Sercotel Guadiana",
                "2026-02-07",
                "Diana",
                "Dani"
        ],
        [
                "Sercotel Guadiana",
                "2026-02-08",
                "Diana",
                "Dani"
        ],
        [
                "Sercotel Guadiana",
                "2026-02-09",
                "Diana",
                "Dani"
        ],
        [
                "Sercotel Guadiana",
                "2026-02-10",
                "Diana",
                "Dani"
        ],
        [
                "Sercotel Guadiana",
                "2026-02-11",
                "Diana",
                "Dani"
        ],
        [
                "Sercotel Guadiana",
                "2026-02-13",
                "Diana",
                "Dani"
        ],
        [
                "Cumbria Spa&Hotel",
                "2026-02-14",
                "Miriam",
                "Cristina"
        ],
        [
                "Sercotel Guadiana",
                "2026-02-15",
                "Diana",
                "Macarena"
        ],
        [
                "Sercotel Guadiana",
                "2026-02-16",
                "Diana",
                "Macarena"
        ],
        [
                "Sercotel Guadiana",
                "2026-02-17",
                "Diana",
                "Federico"
        ],
        [
                "Cumbria Spa&Hotel",
                "2026-02-18",
                "Cristina",
                "Isabel Hidalgo"
        ],
        [
                "Cumbria Spa&Hotel",
                "2026-02-21",
                "Cristina",
                "Miriam"
        ],
        [
                "Sercotel Guadiana",
                "2026-02-21",
                "Diana",
                "Macarena"
        ],
        [
                "Sercotel Guadiana",
                "2026-02-22",
                "Diana",
                "Macarena"
        ],
        [
                "Sercotel Guadiana",
                "2026-02-25",
                "Macarena",
                "Federico"
        ],
        [
                "Cumbria Spa&Hotel",
                "2026-02-28",
                "Miriam",
                "Cristina"
        ],
        [
                "Sercotel Guadiana",
                "2026-02-28",
                "Diana",
                "Dani"
        ],
        [
                "Sercotel Guadiana",
                "2026-03-01",
                "Diana",
                "Macarena"
        ],
        [
                "Cumbria Spa&Hotel",
                "2026-03-03",
                "Cristina",
                "Isabel Hidalgo"
        ],
        [
                "Cumbria Spa&Hotel",
                "2026-03-07",
                "Cristina",
                "Miriam"
        ],
        [
                "Sercotel Guadiana",
                "2026-03-09",
                "Macarena",
                "Dani"
        ],
        [
                "Sercotel Guadiana",
                "2026-03-10",
                "Macarena",
                "Dani"
        ],
        [
                "Cumbria Spa&Hotel",
                "2026-03-14",
                "Cristina",
                "Esther"
        ],
        [
                "Cumbria Spa&Hotel",
                "2026-03-18",
                "Sergio",
                "Esther"
        ],
        [
                "Cumbria Spa&Hotel",
                "2026-03-19",
                "Sergio",
                "Esther"
        ],
        [
                "Cumbria Spa&Hotel",
                "2026-03-20",
                "Sergio",
                "Esther"
        ],
        [
                "Sercotel Guadiana",
                "2026-03-26",
                "Diana",
                "Macarena"
        ],
        [
                "Cumbria Spa&Hotel",
                "2026-04-01",
                "Cristina",
                "Miriam"
        ],
        [
                "Sercotel Guadiana",
                "2026-04-06",
                "Diana",
                "Macarena"
        ],
        [
                "Sercotel Guadiana",
                "2026-04-10",
                "Diana",
                "Dani"
        ],
        [
                "Cumbria Spa&Hotel",
                "2026-04-15",
                "Miriam",
                "Cristina"
        ],
        [
                "Cumbria Spa&Hotel",
                "2026-04-16",
                "Miriam",
                "Cristina"
        ],
        [
                "Cumbria Spa&Hotel",
                "2026-04-17",
                "Miriam",
                "Cristina"
        ],
        [
                "Sercotel Guadiana",
                "2026-04-18",
                "Dani",
                "Macarena"
        ],
        [
                "Sercotel Guadiana",
                "2026-04-19",
                "Dani",
                "Macarena"
        ],
        [
                "Sercotel Guadiana",
                "2026-04-25",
                "Dani",
                "Macarena"
        ],
        [
                "Sercotel Guadiana",
                "2026-04-26",
                "Dani",
                "Macarena"
        ],
        [
                "Sercotel Guadiana",
                "2026-05-02",
                "Diana",
                "Dani"
        ],
        [
                "Sercotel Guadiana",
                "2026-05-03",
                "Diana",
                "Dani"
        ],
        [
                "Sercotel Guadiana",
                "2026-05-04",
                "Diana",
                "Dani"
        ],
        [
                "Sercotel Guadiana",
                "2026-05-05",
                "Diana",
                "Dani"
        ],
        [
                "Sercotel Guadiana",
                "2026-05-06",
                "Diana",
                "Dani"
        ],
        [
                "Sercotel Guadiana",
                "2026-05-08",
                "Diana",
                "Dani"
        ],
        [
                "Sercotel Guadiana",
                "2026-05-15",
                "Dani",
                "Diana"
        ]
];

    const duplicateExcelRows = [
        [
                [
                        "Cumbria Spa&Hotel",
                        "2025-11-07",
                        "Cristina",
                        "Miriam"
                ],
                [
                        "Cumbria Spa&Hotel",
                        "2025-11-07",
                        "Cristina",
                        "Miriam"
                ]
        ],
        [
                [
                        "Sercotel Guadiana",
                        "2026-02-28",
                        "Diana",
                        "Macarena"
                ],
                [
                        "Sercotel Guadiana",
                        "2026-02-28",
                        "Diana",
                        "Dani"
                ]
        ]
];

    const client = window.supabase;
    if (!client) { alert('Sin conexi?n a Supabase. Ejecuta desde admin.html o cambios.html.'); return; }

    const clean = value => String(value || '').replace(/[​-‍﻿]/g, '').trim().replace(/\s+/g, ' ');
    const norm = value => clean(value).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const keyFor = (fecha, empleado) => `${fecha}|${norm(empleado)}`;
    const now = new Date().toISOString();

    const desired = new Map();
    records.forEach(([hotel_id, fecha, empleado_id, sustituto]) => {
        desired.set(keyFor(fecha, empleado_id), {
            hotel_id,
            fecha,
            empleado_id: clean(empleado_id),
            sustituto: clean(sustituto),
            turno: 'CT',
            tipo: 'CT',
            updated_by: 'CORRECCION_EXCEL_CT',
            updated_at: now
        });
    });

    const { data: currentTurnos, error: currentError } = await client
        .from('turnos')
        .select('*')
        .eq('tipo', 'CT')
        .gte('fecha', '2025-09-08')
        .lte('fecha', '2026-05-15');
    if (currentError) throw currentError;

    const desiredKeys = new Set(desired.keys());
    const extras = (currentTurnos || []).filter(row => !desiredKeys.has(keyFor(row.fecha, row.empleado_id)));
    for (const row of extras) {
        const { error } = await client.from('turnos').delete().eq('id', row.id);
        if (error) throw error;
    }

    const payload = Array.from(desired.values());
    const BATCH = 50;
    let ok = 0;
    for (let i = 0; i < payload.length; i += BATCH) {
        const batch = payload.slice(i, i + BATCH);
        const { error } = await client
            .from('turnos')
            .upsert(batch, { onConflict: 'empleado_id,fecha' });
        if (error) throw error;
        ok += batch.length;
    }

    const { data: events, error: eventsError } = await client
        .from('eventos_cuadrante')
        .select('*')
        .eq('updated_by', 'REGULARIZACION_CT_EXCEL')
        .neq('estado', 'anulado')
        .gte('fecha_inicio', '2025-09-08')
        .lte('fecha_inicio', '2026-05-15');
    if (!eventsError) {
        for (const event of (events || [])) {
            const { error } = await client
                .from('eventos_cuadrante')
                .update({ estado: 'anulado', updated_at: now, updated_by: 'CORRECCION_EXCEL_CT' })
                .eq('id', event.id);
            if (error) throw error;
        }
    }

    console.log({
        excelUnicos: payload.length,
        duplicadosExcelIgnorados: duplicateExcelRows.length,
        ctSobrantesEliminados: extras.length,
        ctInsertadosOActualizados: ok,
        eventosDuplicadosAnulados: events ? events.length : 0
    });
    alert(`Cambios de turno sincronizados: ${ok} CT actualizados. Sobrantes eliminados: ${extras.length}.`);
})();
