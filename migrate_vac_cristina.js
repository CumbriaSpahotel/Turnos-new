/**
 * MIGRACIÓN PUNTUAL: VAC Cristina (turnos legacy → eventos_cuadrante)
 *
 * CONDICIONES DE SEGURIDAD:
 *  - NO borra ni modifica la tabla `turnos`.
 *  - Es idempotente: comprueba duplicados antes de insertar.
 *  - Alcance: solo empleado_id que contenga 'cristina' (case-insensitive).
 *  - Payload documenta origen = 'legacy_turnos'.
 *
 * USO: Cargar en cualquier página con supabase-config.js y ejecutar:
 *   window.migrateVacCristina()
 */

window.migrateVacCristina = async function () {
    const client = window.supabase;
    if (!client) {
        console.error('❌ Supabase no disponible.');
        return { ok: false, error: 'supabase no disponible' };
    }

    console.group('🚀 MIGRACIÓN VAC CRISTINA — inicio');

    // ─── PASO 1: Leer registros VAC de Cristina en `turnos` ───────────────────
    const { data: vacRows, error: readError } = await client
        .from('turnos')
        .select('*')
        .ilike('empleado_id', '%cristina%')
        .ilike('tipo', 'VAC%')
        .order('fecha', { ascending: true });

    if (readError) {
        console.error('❌ Error leyendo turnos VAC:', readError);
        console.groupEnd();
        return { ok: false, error: readError };
    }

    if (!vacRows || vacRows.length === 0) {
        console.warn('⚠️ No se encontraron registros VAC de Cristina en tabla `turnos`.');
        console.groupEnd();
        return { ok: false, error: 'sin datos legacy' };
    }

    console.log(`📋 Registros VAC legacy encontrados: ${vacRows.length}`);
    console.table(vacRows.map(r => ({
        id: r.id,
        empleado_id: r.empleado_id,
        fecha: r.fecha,
        tipo: r.tipo,
        turno: r.turno,
        sustituto: r.sustituto,
        hotel_id: r.hotel_id
    })));

    // ─── PASO 2: Agregar en un periodo continuo ────────────────────────────────
    // Los registros de `turnos` son 1 fila por día; necesitamos agruparlos
    // en periodos fecha_inicio / fecha_fin para eventos_cuadrante.

    // Primero normalizar empleado_id y hotel
    const empId = vacRows[0].empleado_id; // "Cristina" o variante exacta del registro
    const hotelId = vacRows[0].hotel_id || 'Cumbria Spa&Hotel';
    const sustituto = vacRows[0].sustituto || null;

    // Agrupar días contiguos en periodos
    const periodos = [];
    let periodoActual = null;

    for (const row of vacRows) {
        const fecha = String(row.fecha || '').split('T')[0];
        if (!fecha) continue;

        if (!periodoActual) {
            periodoActual = { inicio: fecha, fin: fecha, hotel: row.hotel_id || hotelId, sustituto: row.sustituto || sustituto };
        } else {
            // ¿Es día siguiente?
            const prev = new Date(periodoActual.fin + 'T12:00:00');
            const curr = new Date(fecha + 'T12:00:00');
            const diffDays = Math.round((curr - prev) / 86400000);
            if (diffDays <= 1) {
                periodoActual.fin = fecha;
                if (row.sustituto) periodoActual.sustituto = row.sustituto;
            } else {
                periodos.push({ ...periodoActual });
                periodoActual = { inicio: fecha, fin: fecha, hotel: row.hotel_id || hotelId, sustituto: row.sustituto || sustituto };
            }
        }
    }
    if (periodoActual) periodos.push(periodoActual);

    console.log(`🗓️ Periodos agrupados (${periodos.length}):`);
    console.table(periodos);

    // ─── PASO 3: Verificar duplicados en eventos_cuadrante ────────────────────
    const { data: existentes, error: checkError } = await client
        .from('eventos_cuadrante')
        .select('id, empleado_id, fecha_inicio, fecha_fin, tipo, estado')
        .ilike('empleado_id', '%cristina%')
        .ilike('tipo', 'VAC%');

    if (checkError) {
        console.error('❌ Error verificando duplicados:', checkError);
        console.groupEnd();
        return { ok: false, error: checkError };
    }

    const existentesActivos = (existentes || []).filter(e => e.estado !== 'anulado');
    console.log(`🔍 Eventos VAC de Cristina ya en eventos_cuadrante: ${existentesActivos.length}`);
    if (existentesActivos.length > 0) console.table(existentesActivos);

    // ─── PASO 4: Construir payloads a insertar (solo no-duplicados) ───────────
    const toInsert = [];
    const skipped = [];

    for (const periodo of periodos) {
        const isDuplicate = existentesActivos.some(e => {
            const fi = String(e.fecha_inicio || '').split('T')[0];
            const ff = String(e.fecha_fin || e.fecha_inicio || '').split('T')[0];
            // Solapamiento: inicio del nuevo <= fin existente Y fin del nuevo >= inicio existente
            return periodo.inicio <= ff && periodo.fin >= fi;
        });

        if (isDuplicate) {
            console.log(`  ⏭ Omitido por duplicado: ${periodo.inicio} – ${periodo.fin}`);
            skipped.push(periodo);
            continue;
        }

        const payload = {
            tipo: 'VAC',
            estado: 'activo',
            empleado_id: empId,
            empleado_destino_id: periodo.sustituto || null,
            hotel_origen: periodo.hotel,
            fecha_inicio: periodo.inicio,
            fecha_fin: periodo.fin,
            turno_nuevo: null,
            turno_original: null,
            observaciones: 'Migrado desde turnos legacy',
            payload: {
                origen: 'legacy_turnos',
                sustituto_nombre: periodo.sustituto || null,
                migrado_en: new Date().toISOString()
            },
            updated_at: new Date().toISOString(),
            updated_by: 'MIGRACION_VAC_CRISTINA'
        };

        console.log(`  📦 A insertar: ${periodo.inicio} – ${periodo.fin}`);
        console.log('     Payload:', JSON.stringify(payload, null, 2));
        toInsert.push(payload);
    }

    if (toInsert.length === 0) {
        console.log('✅ Sin nuevos registros a insertar (todos ya existen o están cubiertos).');
        console.groupEnd();
        return { ok: true, inserted: 0, skipped: skipped.length, message: 'ya existían' };
    }

    // ─── PASO 5: Insertar ─────────────────────────────────────────────────────
    console.log(`\n📥 Insertando ${toInsert.length} evento(s) en eventos_cuadrante...`);

    const { data: insertResult, error: insertError } = await client
        .from('eventos_cuadrante')
        .insert(toInsert)
        .select('id, tipo, empleado_id, fecha_inicio, fecha_fin, estado');

    if (insertError) {
        console.error('❌ Error en inserción:', insertError);
        console.groupEnd();
        return { ok: false, error: insertError };
    }

    console.log(`✅ Insertado(s) correctamente:`);
    console.table(insertResult);

    // ─── PASO 6: Verificar que `turnos` sigue intacto ─────────────────────────
    const { data: checkTurnos } = await client
        .from('turnos')
        .select('id, empleado_id, fecha, tipo')
        .ilike('empleado_id', '%cristina%')
        .ilike('tipo', 'VAC%')
        .limit(5);

    console.log(`🔒 Tabla turnos intacta — primeros 5 registros VAC Cristina siguen ahí:`, checkTurnos?.length, 'encontrados');
    if (checkTurnos) console.table(checkTurnos);

    console.log('\n🎉 MIGRACIÓN COMPLETA');
    console.log(`  Insertados: ${insertResult?.length || 0}`);
    console.log(`  Omitidos (duplicados): ${skipped.length}`);
    console.log(`  Tabla turnos: NO MODIFICADA`);
    console.log('\n➡️  Recarga admin.html y navega a Vista Previa > Cumbria > Semana 20/04/26');

    console.groupEnd();
    return {
        ok: true,
        inserted: insertResult?.length || 0,
        skipped: skipped.length,
        insertedIds: insertResult?.map(r => r.id),
        payload: toInsert
    };
};

console.log('📦 migrateVacCristina cargado. Ejecuta: window.migrateVacCristina()');
