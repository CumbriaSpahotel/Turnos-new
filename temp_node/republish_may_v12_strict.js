/**
 * REPUBLICACIÓN V12.1 — Cumbria Spa&Hotel — Mayo 2026
 * ESTRUCTURA ESTRICTA SEGÚN EXCEL V.9
 * 
 * Reglas:
 * 1. El orden viene del Excel para cada semana.
 * 2. Si el titular está de VAC, Miriam ocupa su puesto original.
 * 3. El titular de VAC baja al final (Ausencia Informativa).
 * 4. Miriam NO aparece dos veces.
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const SUPABASE_URL = 'https://drvmxranbpumianmlzqr.supabase.co';
const SUPABASE_KEY = 'sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ';
const client = createClient(SUPABASE_URL, SUPABASE_KEY);

const HOTEL = 'Cumbria Spa&Hotel';
const SUSTITUTA = 'Miriam';

// ORDEN EXACTO DEL EXCEL V.9 PARA ESTAS SEMANAS
const EXCEL_STRUCTURE = {
    '2026-05-04': ['Esther', 'Sergio', 'Cristina', 'Valentín', 'Isabel Hidalgo'],
    '2026-05-11': ['Cristina', 'Esther', 'Sergio', 'Valentín', 'Isabel Hidalgo'],
    '2026-05-18': ['Sergio', 'Cristina', 'Esther', 'Valentín', 'Isabel Hidalgo'],
    '2026-05-25': ['Esther', 'Sergio', 'Cristina', 'Valentín', 'Isabel Hidalgo']
};

const TURNO_LABELS = {
    'M':'Mañana','T':'Tarde','N':'Noche','D':'Descanso',
    'VAC':'Vacaciones','BAJA':'Baja','PERM':'Permiso','FORM':'Formación'
};
const ABSENCE_TYPES = new Set(['VAC','BAJA','PERM','FORM','IT']);

const DRY_RUN = false; // Activado para publicación definitiva

function addDays(dateStr, n) {
    const d = new Date(dateStr + 'T12:00:00');
    d.setDate(d.getDate() + n);
    return d.toISOString().split('T')[0];
}

function buildCell(code, extra = {}) {
    const c = (code || '').toUpperCase().trim();
    const isAbsence = ABSENCE_TYPES.has(c);
    return {
        code: c || '—',
        label: TURNO_LABELS[c] || (c || '—'),
        type: isAbsence ? c : 'NORMAL',
        isAbsence,
        icons: [],
        origen: 'BASE',
        sustituto: extra.sustituto || null,
        titular_cubierto: extra.titular_cubierto || null
    };
}

async function main() {
    console.log('\n===========================================');
    console.log('  REPUBLICACIÓN V12.1 — ESTRUCTURA EXCEL');
    console.log('  MODO:', DRY_RUN ? 'DRY-RUN (solo preview)' : '⚠️  PUBLICACIÓN REAL');
    console.log('===========================================\n');

    const { data: todosTurnos } = await client.from('turnos')
        .select('empleado_id,fecha,turno,tipo')
        .eq('hotel_id', HOTEL)
        .gte('fecha','2026-05-04').lte('fecha','2026-05-31');

    const { data: eventosRaw } = await client.from('eventos_cuadrante')
        .select('empleado_id,tipo,fecha_inicio,fecha_fin,estado')
        .lte('fecha_inicio','2026-05-31')
        .gte('fecha_fin','2026-05-04');

    const eventos = (eventosRaw || []).filter(ev =>
        !/anulad|rechazad/i.test(ev.estado || '') &&
        ABSENCE_TYPES.has((ev.tipo || '').toUpperCase())
    );

    const turnoMap = {};
    (todosTurnos || []).forEach(t => {
        turnoMap[`${t.empleado_id}::${t.fecha}`] = t;
    });

    const ausenciaMap = {};
    eventos.forEach(ev => {
        const tipo = (ev.tipo || '').toUpperCase();
        let d = ev.fecha_inicio;
        while (d <= ev.fecha_fin) {
            ausenciaMap[`${ev.empleado_id}::${d}`] = tipo;
            d = addDays(d, 1);
        }
    });

    for (const weekStart of Object.keys(EXCEL_STRUCTURE)) {
        const weekDates = [0,1,2,3,4,5,6].map(i => addDays(weekStart, i));
        const baseOrder = EXCEL_STRUCTURE[weekStart];

        const operationalRows = [];
        const absentRows = [];
        const assignedEmps = new Set();

        // REGLA: Primero detectamos ausencias de titulares
        baseOrder.forEach((titular, idx) => {
            let isAbsentThisWeek = false;
            weekDates.forEach(fecha => {
                const aus = ausenciaMap[`${titular}::${fecha}`];
                const t = turnoMap[`${titular}::${fecha}`];
                if (aus || (t && (t.tipo || '').toUpperCase().startsWith('VAC'))) {
                    isAbsentThisWeek = true;
                }
            });

            if (isAbsentThisWeek) {
                // TITULAR AUSENTE -> Se va al final
                const diasAusente = {};
                weekDates.forEach(fecha => {
                    const aus = ausenciaMap[`${titular}::${fecha}`];
                    const t = turnoMap[`${titular}::${fecha}`];
                    const code = aus || (t && (t.tipo || '').toUpperCase().startsWith('VAC') ? 'VAC' : '—');
                    diasAusente[fecha] = buildCell(code);
                });

                absentRows.push({
                    empleado_id: titular,
                    nombre: titular,
                    rowType: 'ausencia_informativa',
                    puestoOrden: 100 + idx, // Al final
                    orden: 100 + idx,
                    dias: diasAusente
                });

                // Miriam toma su puesto operativo
                if (!assignedEmps.has(SUSTITUTA)) {
                    const diasMiriam = {};
                    weekDates.forEach(fecha => {
                        const tTitular = turnoMap[`${titular}::${fecha}`];
                        diasMiriam[fecha] = buildCell(tTitular?.turno || '', { titular_cubierto: titular });
                    });

                    operationalRows.push({
                        empleado_id: SUSTITUTA,
                        nombre: SUSTITUTA,
                        rowType: 'operativo',
                        puestoOrden: idx + 1,
                        orden: idx + 1,
                        dias: diasMiriam
                    });
                    assignedEmps.add(SUSTITUTA);
                } else {
                    // Si Miriam ya está asignada (raro en Cumbria), queda vacante
                    operationalRows.push({
                        empleado_id: 'VACANTE',
                        nombre: 'Sin cubrir',
                        rowType: 'operativo',
                        puestoOrden: idx + 1,
                        orden: idx + 1,
                        dias: weekDates.reduce((a,v) => ({...a, [v]: buildCell('')}), {})
                    });
                }
            } else {
                // TITULAR ACTIVO -> Se queda en su puesto
                if (!assignedEmps.has(titular)) {
                    const dias = {};
                    weekDates.forEach(fecha => {
                        const t = turnoMap[`${titular}::${fecha}`];
                        dias[fecha] = buildCell(t?.turno || '');
                    });

                    operationalRows.push({
                        empleado_id: titular,
                        nombre: titular,
                        rowType: 'operativo',
                        puestoOrden: idx + 1,
                        orden: idx + 1,
                        dias: dias
                    });
                    assignedEmps.add(titular);
                }
            }
        });

        const snapshot = {
            hotel: HOTEL,
            semana_inicio: weekStart,
            semana_fin: weekDates[6],
            empleados: [...operationalRows, ...absentRows],
            metadata: { version_builder: 'V12.1-EXCEL-STRICT', published_at: new Date().toISOString() }
        };

        console.log(`\n=== SEMANA ${weekStart} ===`);
        snapshot.empleados.forEach(r => {
            const mark = r.rowType === 'ausencia_informativa' ? '🔘' : '✅';
            console.log(`  ${mark} PO=${r.puestoOrden} ${r.nombre.padEnd(15)} ${Object.values(r.dias).map(c=>c.code).join(' ')}`);
        });

        if (!DRY_RUN) {
            const { data: current } = await client.from('publicaciones_cuadrante')
                .select('id,version').eq('hotel', HOTEL).eq('semana_inicio', weekStart)
                .eq('estado','activo').order('version',{ascending:false}).limit(1);

            const nextVersion = (current?.[0]?.version || 0) + 1;
            const lastId = current?.[0]?.id || null;

            const { data: newSnap, error } = await client.from('publicaciones_cuadrante')
                .insert([{
                    semana_inicio: weekStart, semana_fin: weekDates[6], hotel: HOTEL,
                    snapshot_json: { ...snapshot, metadata: { ...snapshot.metadata, rollback_target: lastId } },
                    resumen: { emps: snapshot.empleados.length },
                    publicado_por: 'V12.1-EXCEL-STRICT', version: nextVersion, estado: 'activo'
                }]).select().single();

            if (error) { console.error('❌ Error:', error.message); continue; }

            await client.from('publicaciones_cuadrante')
                .update({ estado: 'reemplazado', updated_at: new Date().toISOString() })
                .eq('hotel', HOTEL).eq('semana_inicio', weekStart).eq('estado','activo').neq('id', newSnap.id);

            console.log(`  🚀 PUBLICADO v${nextVersion}`);
        }
    }
}

main().catch(console.error);
