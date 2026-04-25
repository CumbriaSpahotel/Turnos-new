
/**
 * migrate_vacaciones_legacy.js
 * Migra todas las vacaciones detectadas en la tabla legacy 'turnos' a 'eventos_cuadrante'.
 * Sigue reglas de agrupación por periodos consecutivos e idempotencia.
 */

async function auditAndMigrateVacations() {
    const client = window.supabase;
    if (!client) {
        console.error("Supabase client not found");
        return;
    }

    console.log("🚀 Iniciando auditoría de vacaciones legacy...");

    // 1. Obtener todas las vacaciones de turnos (legacy)
    // Filtramos por tipo VAC o turno V
    const { data: legacyData, error: legacyErr } = await client
        .from('turnos')
        .select('id, empleado_id, hotel_id, fecha, turno, tipo, sustituto')
        .or('tipo.ilike.%vac%,turno.eq.V')
        .order('empleado_id', { ascending: true })
        .order('fecha', { ascending: true });

    if (legacyErr) {
        console.error("Error fetching legacy vacations:", legacyErr);
        return;
    }

    console.log(`📊 Encontrados ${legacyData.length} registros individuales en turnos (legacy).`);

    // 2. Obtener todas las vacaciones de eventos_cuadrante (actual)
    const { data: currentData, error: currentErr } = await client
        .from('eventos_cuadrante')
        .select('id, empleado_id, hotel_origen, fecha_inicio, fecha_fin, empleado_destino_id, observaciones, estado')
        .eq('tipo', 'VAC')
        .neq('estado', 'anulado');

    if (currentErr) {
        console.error("Error fetching current vacations:", currentErr);
        return;
    }

    console.log(`📊 Encontrados ${currentData.length} registros en eventos_cuadrante.`);

    // 3. Agrupar registros individuales en periodos
    const periods = [];
    let currentPeriod = null;

    for (const row of legacyData) {
        const fecha = row.fecha;
        const emp = row.empleado_id;
        const hotel = row.hotel_id;
        const sustRaw = (row.sustituto || '').trim();
        const sust = (sustRaw === '¿?' || sustRaw === '') ? null : sustRaw;
        
        if (currentPeriod && 
            currentPeriod.empleado_id === emp && 
            currentPeriod.hotel_id === hotel && 
            currentPeriod.sustituto === sust &&
            isConsecutive(currentPeriod.lastDate, fecha)) {
            
            currentPeriod.fecha_fin = fecha;
            currentPeriod.lastDate = fecha;
            currentPeriod.rawIds.push(row.id);
        } else {
            if (currentPeriod) {
                periods.push(currentPeriod);
            }
            currentPeriod = {
                empleado_id: emp,
                hotel_id: hotel,
                fecha_inicio: fecha,
                fecha_fin: fecha,
                lastDate: fecha,
                sustituto: sust,
                rawIds: [row.id]
            };
        }
    }
    if (currentPeriod) periods.push(currentPeriod);

    console.log(`📦 Grupos generados (agrupando días consecutivos): ${periods.length}`);

    // 4. Identificar faltantes e insertar
    const toInsert = [];
    const skipped = [];

    for (const p of periods) {
        // Check for duplicates
        // Criterio: mismo empleado, hotel, fechas (exactas o solapadas) y sustituto
        const isDuplicate = currentData.some(curr => 
            curr.empleado_id === p.empleado_id &&
            curr.hotel_origen === p.hotel_id &&
            curr.fecha_inicio === p.fecha_inicio &&
            curr.fecha_fin === p.fecha_fin &&
            (curr.empleado_destino_id || null) === (p.sustituto || null)
        );

        if (isDuplicate) {
            skipped.push(p);
            continue;
        }

        toInsert.push({
            tipo: "VAC",
            empleado_id: p.empleado_id,
            hotel_origen: p.hotel_id,
            fecha_inicio: p.fecha_inicio,
            fecha_fin: p.fecha_fin,
            empleado_destino_id: p.sustituto,
            estado: "activo",
            observaciones: "Migrado desde turnos legacy",
            payload: {
                fuente: "turnos_legacy",
                migrado_en: new Date().toISOString(),
                ids_origen: p.rawIds
            }
        });
    }

    console.log(`✨ Listos para insertar: ${toInsert.length}`);
    console.log(`⏩ Omitidos por duplicado: ${skipped.length}`);

    if (toInsert.length > 0) {
        const { data: inserted, error: insertErr } = await client
            .from('eventos_cuadrante')
            .insert(toInsert)
            .select();

        if (insertErr) {
            console.error("Error inserting vacations:", insertErr);
        } else {
            console.log(`✅ Insertados ${inserted.length} grupos de vacaciones.`);
            
            // Registro en publicaciones_log
            await client.from('publicaciones_log').insert({
                usuario: 'MIGRACION_VACACIONES_LEGACY',
                cambios_totales: toInsert.length,
                empleados_afectados: new Set(toInsert.map(r => r.empleado_id)).size,
                resumen_json: {
                    total_raw: legacyData.length,
                    grupos_generados: periods.length,
                    insertados: toInsert.length,
                    omitidos: skipped.length,
                    timestamp: new Date().toISOString()
                },
                estado: 'ok'
            });
        }
    } else {
        console.log("No hay vacaciones nuevas para migrar.");
    }

    return {
        legacy_count: legacyData.length,
        current_count: currentData.length,
        groups_generated: periods.length,
        inserted_count: toInsert.length,
        skipped_count: skipped.length,
        inserted_data: toInsert
    };
}

function isConsecutive(date1, date2) {
    const d1 = new Date(date1 + 'T12:00:00');
    const d2 = new Date(date2 + 'T12:00:00');
    const diff = Math.abs(d2 - d1);
    return diff <= 86400000; // 1 día
}

// Exportar para uso en consola
window.auditAndMigrateVacations = auditAndMigrateVacations;
