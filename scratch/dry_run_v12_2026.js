async function runAnnualDryRun() {
    const hotels = ["Cumbria Spa&Hotel", "Sercotel Guadiana"];
    const startYear = 2026;
    
    // Generar lunes de 2026
    const mondays = [];
    let current = new Date(`${startYear}-01-05T12:00:00`); // Primer lunes de 2026
    while (current.getFullYear() === startYear) {
        mondays.push(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 7);
    }

    const audit = {
        total_weeks: mondays.length,
        analisis: [],
        resumen_por_mes: {},
        resumen_por_hotel: {},
        bloqueadas: [],
        aptas: 0,
        aptas_con_avisos: 0,
        bloqueadas_count: 0
    };

    console.log(`[DRY RUN] Iniciando auditoría anual 2026 para ${mondays.length} semanas...`);

    for (const week of mondays) {
        const month = week.substring(0, 7);
        if (!audit.resumen_por_mes[month]) audit.resumen_por_mes[month] = { aptas: 0, bloqueadas: 0, errores: 0 };

        try {
            // 1. Generar snapshots para los hoteles autorizados
            const snapshots = await window.buildPublicationSnapshotPreview(week, 'all');
            const authSnapshots = snapshots.filter(s => hotels.includes(s.hotel_id));

            if (authSnapshots.length === 0) {
                console.warn(`[DRY RUN] Semana ${week} no tiene datos para los hoteles autorizados.`);
                continue;
            }

            // 2. Validar
            const validation = await window.validatePublicationSnapshot(authSnapshots);
            
            // 3. Clasificar
            const status = validation.ok ? (validation.warnings?.length > 0 ? 'APTA CON AVISOS' : 'APTA') : 'BLOQUEADA';
            
            const weekResult = {
                week,
                status,
                hotels: authSnapshots.map(s => ({
                    hotel: s.hotel_id,
                    rows: s.rows.length,
                    extras: s.rows.filter(r => r.rowType === 'refuerzo' || r.rowType === 'extra' || r.origenOrden === 'auto_extra').length,
                    vacaciones: s.rows.filter(r => Object.values(r.cells).some(c => c.code === 'VAC' || c.code.includes('🏖️'))).length
                })),
                errors: validation.errors || [],
                warnings: validation.warnings || []
            };

            audit.analisis.push(weekResult);

            if (status === 'BLOQUEADA') {
                audit.bloqueadas_count++;
                audit.resumen_por_mes[month].bloqueadas++;
                if (audit.bloqueadas.length < 20) {
                    audit.bloqueadas.push({ week, errors: validation.errors });
                }
            } else {
                if (status === 'APTA') audit.aptas++;
                else audit.aptas_con_avisos++;
                audit.resumen_por_mes[month].aptas++;
            }

            // Estadísticas por hotel
            authSnapshots.forEach(s => {
                if (!audit.resumen_por_hotel[s.hotel_id]) audit.resumen_por_hotel[s.hotel_id] = { total: 0, bloqueadas: 0 };
                audit.resumen_por_hotel[s.hotel_id].total++;
                if (!validation.ok) audit.resumen_por_hotel[s.hotel_id].bloqueadas++;
            });

        } catch (err) {
            console.error(`[DRY RUN] Error fatal en semana ${week}:`, err);
            audit.resumen_por_mes[month].errores++;
            audit.analisis.push({ week, status: 'ERROR TÉCNICO', error: err.message });
        }
    }

    return audit;
}

window.runAnnualDryRun = runAnnualDryRun;
console.log("Función window.runAnnualDryRun() cargada.");
