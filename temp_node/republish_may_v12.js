/**
 * REPUBLICACIÓN V12.1 — Cumbria Spa&Hotel — Mayo 2026
 * Lógica:
 *  - Lee eventos_cuadrante para detectar VAC/BAJA/PERM
 *  - El titular en VAC → rowType='ausencia_informativa', puestoOrden alto (al final)
 *  - La sustituta (Miriam) → rowType='operativo', hereda posición del titular + sus turnos base
 *  - Solo incluye empleados con datos en la semana (filtra vacios totales)
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const SUPABASE_URL = 'https://drvmxranbpumianmlzqr.supabase.co';
const SUPABASE_KEY = 'sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ';
const client = createClient(SUPABASE_URL, SUPABASE_KEY);

const HOTEL = 'Cumbria Spa&Hotel';
const WEEKS = ['2026-05-04','2026-05-11','2026-05-18','2026-05-25'];

// Sustituta fija para Cumbria en mayo 2026
const SUSTITUTA = 'Miriam';

// Empleados a excluir del snapshot público (sin datos en tabla turnos ni eventos activos)
const EXCLUIR = new Set(['Natalio','Antonio','Gustavo Sánchez']);

const TURNO_LABELS = {
    'M':'Mañana','T':'Tarde','N':'Noche','D':'Descanso',
    'VAC':'Vacaciones','BAJA':'Baja','PERM':'Permiso','FORM':'Formación'
};
const ABSENCE_TYPES = new Set(['VAC','BAJA','PERM','FORM','IT']);

// Cambiar a false para publicar (requiere revisión del dry-run primero)
const DRY_RUN = false;

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
    console.log('  REPUBLICACIÓN V12.1 — CUMBRIA — MAYO');
    console.log('  MODO:', DRY_RUN ? 'DRY-RUN (solo preview)' : '⚠️  PUBLICACIÓN REAL');
    console.log('===========================================\n');

    // 1. Cargar empleados (orden del DB)
    const { data: empleados } = await client.from('empleados')
        .select('id,nombre,orden,tipo_personal')
        .eq('hotel_id', HOTEL).eq('activo', true)
        .order('orden', { ascending: true });

    // 2. Cargar todos los turnos de mayo
    const { data: todosTurnos } = await client.from('turnos')
        .select('empleado_id,fecha,turno,tipo')
        .eq('hotel_id', HOTEL)
        .gte('fecha','2026-05-04').lte('fecha','2026-05-31');

    // 3. Cargar eventos activos de mayo (vacaciones/bajas)
    const { data: eventosRaw } = await client.from('eventos_cuadrante')
        .select('empleado_id,tipo,fecha_inicio,fecha_fin,estado')
        .lte('fecha_inicio','2026-05-31')
        .gte('fecha_fin','2026-05-04');

    const eventos = (eventosRaw || []).filter(ev =>
        !/anulad|rechazad/i.test(ev.estado || '') &&
        ABSENCE_TYPES.has((ev.tipo || '').toUpperCase())
    );

    // Mapa de turnos: empleadoId+fecha → turno
    const turnoMap = {};
    (todosTurnos || []).forEach(t => {
        turnoMap[`${t.empleado_id}::${t.fecha}`] = t;
    });

    // Mapa de ausencias por empleado+fecha
    const ausenciaMap = {};
    eventos.forEach(ev => {
        const tipo = (ev.tipo || '').toUpperCase();
        let d = ev.fecha_inicio;
        while (d <= ev.fecha_fin) {
            const key = `${ev.empleado_id}::${d}`;
            ausenciaMap[key] = tipo;
            d = addDays(d, 1);
        }
    });

    const allPreviews = {};

    for (const weekStart of WEEKS) {
        const weekDates = [0,1,2,3,4,5,6].map(i => addDays(weekStart, i));
        const weekEnd = weekDates[6];

        // Detectar quién está de VAC esta semana (titular que pasa al final)
        const titularesEnVac = new Set();
        weekDates.forEach(fecha => {
            empleados.forEach(emp => {
                const key = `${emp.nombre}::${fecha}`;
                if (ausenciaMap[key] === 'VAC' || ausenciaMap[key] === 'BAJA' || ausenciaMap[key] === 'PERM') {
                    titularesEnVac.add(emp.nombre);
                }
            });
        });

        // También verificar si el día tiene VAC en turnos (tipo VAC%)
        weekDates.forEach(fecha => {
            empleados.forEach(emp => {
                const t = turnoMap[`${emp.nombre}::${fecha}`];
                if (t && (t.tipo || '').toUpperCase().startsWith('VAC')) {
                    titularesEnVac.add(emp.nombre);
                }
            });
        });

        // Titular que está de VAC esta semana (se espera 1 en Cumbria mayo)
        const titularVac = Array.from(titularesEnVac)[0] || null;

        // Turnos base del titular para que Miriam los herede
        const turnosTitular = {};
        if (titularVac) {
            weekDates.forEach(fecha => {
                const t = turnoMap[`${titularVac}::${fecha}`];
                turnosTitular[fecha] = t?.turno || '';
            });
        }

        const operativos = [];
        const ausenciaRows = [];
        let sustituPos = null;

        empleados.forEach((emp, idx) => {
            const nombre = emp.nombre;
            if (EXCLUIR.has(nombre)) return; // Filtrar sin datos

            const isVac = titularesEnVac.has(nombre);
            const isSustituta = nombre === SUSTITUTA;

            // Construir días para este empleado
            const dias = {};
            weekDates.forEach(fecha => {
                const ausKey = `${nombre}::${fecha}`;
                const t = turnoMap[`${nombre}::${fecha}`];
                const abs = ausenciaMap[ausKey];

                if (isVac) {
                    // Titular en VAC → todos sus días = VAC
                    dias[fecha] = buildCell('VAC');
                } else if (isSustituta && titularVac) {
                    // Miriam hereda los turnos del titular
                    const turnoBase = turnosTitular[fecha] || '';
                    dias[fecha] = buildCell(turnoBase, { titular_cubierto: titularVac });
                } else if (abs) {
                    dias[fecha] = buildCell(abs);
                } else if (t) {
                    const tipo = (t.tipo || '').toUpperCase();
                    const absType = tipo.startsWith('VAC') ? 'VAC'
                        : tipo === 'BAJA' ? 'BAJA'
                        : (tipo === 'PERM' || tipo === 'PERMISO') ? 'PERM'
                        : null;
                    dias[fecha] = buildCell(absType || t.turno || '');
                } else {
                    dias[fecha] = buildCell('');
                }
            });

            // Verificar si toda la semana está vacía (no incluir en snapshot)
            const codes = Object.values(dias).map(c => c.code);
            const allEmpty = codes.every(c => !c || c === '—');
            if (allEmpty && !isVac && !isSustituta) return; // Omitir filas vacías totales

            if (isVac) {
                ausenciaRows.push({
                    empleado_id: nombre,
                    nombre,
                    rowType: 'ausencia_informativa',
                    puestoOrden: 50 + ausenciaRows.length, // siempre < 900, siempre al final
                    orden: 50 + ausenciaRows.length,
                    tipo_personal: emp.tipo_personal || null,
                    dias
                });
            } else {
                // Si es la sustituta, le damos el puestoOrden del titular que cubre
                let puestoOrden = emp.orden || (idx + 1);
                if (isSustituta && titularVac) {
                    const titularEmp = empleados.find(e => e.nombre === titularVac);
                    puestoOrden = titularEmp ? (titularEmp.orden || puestoOrden) : puestoOrden;
                }
                operativos.push({
                    empleado_id: nombre,
                    nombre,
                    rowType: 'operativo',
                    puestoOrden,
                    orden: puestoOrden,
                    tipo_personal: emp.tipo_personal || null,
                    dias
                });
            }
        });

        // Ordenar operativos por puestoOrden
        operativos.sort((a, b) => a.puestoOrden - b.puestoOrden);

        const snapshot = {
            hotel: HOTEL,
            semana_inicio: weekStart,
            semana_fin: weekEnd,
            empleados: [...operativos, ...ausenciaRows],
            metadata: {
                version_builder: 'V12.1-node',
                published_at: new Date().toISOString(),
                titular_ausente: titularVac,
                sustituta: titularVac ? SUSTITUTA : null
            }
        };

        allPreviews[weekStart] = snapshot;

        // MOSTRAR PREVIEW
        console.log(`\n=== ${weekStart} | Titular en VAC: ${titularVac || 'ninguno'} ===`);
        snapshot.empleados.forEach(r => {
            const mark = r.rowType === 'ausencia_informativa' ? '🔘 [AUS]' : '✅ [OP] ';
            const codes = Object.entries(r.dias)
                .map(([d,c]) => d.slice(5)+':'+c.code).join(' ');
            const nota = r.nombre === SUSTITUTA && titularVac ? ` ← cubre a ${titularVac}` : '';
            console.log(`  ${mark} PO=${r.puestoOrden} ${r.nombre.padEnd(16)}${nota}`);
            console.log(`         ${codes}`);
        });

        // PUBLICAR (si no es dry-run)
        if (!DRY_RUN) {
            const { data: current } = await client.from('publicaciones_cuadrante')
                .select('id,version').eq('hotel', HOTEL).eq('semana_inicio', weekStart)
                .eq('estado','activo').order('version',{ascending:false}).limit(1);

            const lastId = current?.[0]?.id || null;
            const nextVersion = (current?.[0]?.version || 0) + 1;

            const { data: newSnap, error } = await client.from('publicaciones_cuadrante')
                .insert([{
                    semana_inicio: weekStart,
                    semana_fin: weekEnd,
                    hotel: HOTEL,
                    snapshot_json: { ...snapshot, metadata: { ...snapshot.metadata, rollback_target: lastId } },
                    resumen: { emps: snapshot.empleados.length, titular_vac: titularVac },
                    publicado_por: 'V12.1-republish',
                    version: nextVersion,
                    estado: 'activo'
                }]).select().single();

            if (error) { console.error('❌ Error publicando', weekStart, ':', error.message); continue; }

            // Marcar anteriores como reemplazados
            await client.from('publicaciones_cuadrante')
                .update({ estado: 'reemplazado', updated_at: new Date().toISOString() })
                .eq('hotel', HOTEL).eq('semana_inicio', weekStart)
                .eq('estado','activo').neq('id', newSnap.id);

            console.log(`  ✅ Publicado → v${nextVersion} (id: ${newSnap.id})`);
        }
    }

    fs.writeFileSync('republish_preview.json', JSON.stringify(allPreviews, null, 2));
    console.log('\n' + (DRY_RUN
        ? '⚠️  DRY-RUN. Revisa el preview y cambia DRY_RUN=false para publicar.'
        : '✅ Todas las semanas republicadas correctamente.'));
}

main().catch(e => { console.error('Error fatal:', e); process.exit(1); });
