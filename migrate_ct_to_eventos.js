/**
 * MIGRACIÓN: turnos.tipo='CT' → eventos_cuadrante
 * 
 * Convierte registros legacy de cambio de turno (tipo CT en tabla turnos)
 * a eventos reales en eventos_cuadrante con estado 'activo'.
 * 
 * USO: Cargar este script desde la consola del navegador en cualquier
 * página que tenga supabase-config.js cargado, o incluirlo temporalmente
 * en admin.html.
 * 
 * Ejecutar: window.migrateCTtoEventos()
 */

window.migrateCTtoEventos = async function() {
    const client = window.supabase;
    if (!client) {
        console.error('❌ Supabase no disponible.');
        return;
    }

    console.log('🚀 Iniciando migración CT → eventos_cuadrante...');

    // 1. Leer TODOS los registros con tipo CT de la tabla turnos
    const { data: ctRows, error } = await client
        .from('turnos')
        .select('*')
        .eq('tipo', 'CT')
        .order('fecha', { ascending: true });

    if (error) {
        console.error('❌ Error leyendo turnos CT:', error);
        return;
    }

    if (!ctRows || ctRows.length === 0) {
        console.log('ℹ️ No hay registros CT legacy para migrar.');
        return;
    }

    console.log(`📋 Encontrados ${ctRows.length} registros CT.`);

    // 2. Agrupar por pares de intercambio (fecha + empleados ordenados)
    const grouped = new Map();

    ctRows.forEach(row => {
        const emp = String(row.empleado_id || '').trim();
        const sust = String(row.sustituto || '').trim();
        const fecha = String(row.fecha || '').split('T')[0];

        if (!emp || !fecha) return;

        if (sust) {
            // Es un intercambio bilateral: agrupar por pareja
            const pair = [emp, sust].sort();
            const key = `${fecha}|${pair[0]}|${pair[1]}`;
            if (!grouped.has(key)) {
                grouped.set(key, {
                    tipo: 'INTERCAMBIO_TURNO',
                    empleado_id: pair[0],
                    empleado_destino_id: pair[1],
                    fecha,
                    hotel_id: row.hotel_id || 'General',
                    observaciones: 'Migrado desde CT legacy',
                    turno_emp: null,
                    turno_dest: null
                });
            }
            // Guardar turno de cada empleado
            const entry = grouped.get(key);
            if (emp === pair[0]) entry.turno_emp = row.turno;
            else entry.turno_dest = row.turno;
        } else {
            // Cambio unilateral
            const key = `${fecha}|${emp}|solo`;
            if (!grouped.has(key)) {
                grouped.set(key, {
                    tipo: 'CAMBIO_TURNO',
                    empleado_id: emp,
                    empleado_destino_id: null,
                    fecha,
                    hotel_id: row.hotel_id || 'General',
                    turno_nuevo: row.turno || '',
                    observaciones: 'Migrado desde CT legacy'
                });
            }
        }
    });

    console.log(`🔗 Agrupados en ${grouped.size} eventos únicos.`);

    // 3. Verificar cuáles ya existen en eventos_cuadrante
    const { data: existingEvents } = await client
        .from('eventos_cuadrante')
        .select('empleado_id, empleado_destino_id, fecha_inicio, tipo, estado')
        .in('tipo', ['INTERCAMBIO_TURNO', 'CAMBIO_TURNO']);

    const existingKeys = new Set();
    (existingEvents || []).forEach(e => {
        if (e.estado === 'anulado') return; // No contar anulados como existentes
        const f = String(e.fecha_inicio || '').split('T')[0];
        const pair = [e.empleado_id, e.empleado_destino_id].filter(Boolean).sort();
        existingKeys.add(`${f}|${pair.join('|')}`);
    });

    // 4. Insertar solo los que NO existen
    const toInsert = [];

    grouped.forEach((entry, key) => {
        const checkKey = `${entry.fecha}|${[entry.empleado_id, entry.empleado_destino_id].filter(Boolean).sort().join('|')}`;
        if (existingKeys.has(checkKey)) {
            console.log(`  ⏭ Saltando (ya existe): ${checkKey}`);
            return;
        }

        toInsert.push({
            tipo: entry.tipo,
            estado: 'activo',
            empleado_id: entry.empleado_id,
            empleado_destino_id: entry.empleado_destino_id,
            fecha_inicio: entry.fecha,
            fecha_fin: entry.fecha,
            hotel_origen: entry.hotel_id,
            turno_nuevo: entry.turno_nuevo || entry.turno_dest || '',
            turno_original: entry.turno_emp || '',
            observaciones: entry.observaciones,
            updated_at: new Date().toISOString(),
            updated_by: 'MIGRACION_CT'
        });
    });

    if (toInsert.length === 0) {
        console.log('✅ Todos los registros CT ya están migrados. No hay nada nuevo.');
        return;
    }

    console.log(`📦 Insertando ${toInsert.length} eventos nuevos...`);

    // Insertar en lotes de 50
    const BATCH = 50;
    let inserted = 0;
    for (let i = 0; i < toInsert.length; i += BATCH) {
        const batch = toInsert.slice(i, i + BATCH);
        const { error: insertError } = await client
            .from('eventos_cuadrante')
            .insert(batch);

        if (insertError) {
            console.error(`❌ Error insertando lote ${i / BATCH + 1}:`, insertError);
        } else {
            inserted += batch.length;
            console.log(`  ✅ Lote ${Math.floor(i / BATCH) + 1}: ${batch.length} eventos insertados.`);
        }
    }

    console.log(`\n🎉 Migración completa: ${inserted}/${toInsert.length} eventos creados en eventos_cuadrante.`);
    console.log('ℹ️ Recarga cambios.html para verlos.');
};

console.log('📦 Script de migración CT cargado. Ejecuta: window.migrateCTtoEventos()');
