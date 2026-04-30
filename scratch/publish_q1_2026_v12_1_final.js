const fs = require('fs');
const path = require('path');
const https = require('https');

const SUPABASE_URL = 'https://drvmxranbpumianmlzqr.supabase.co';
const SUPABASE_KEY = 'sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ'; // Anon Key

const STRUCTURE_PATH = path.join(__dirname, '..', 'temp_node', 'excel_structure_2026.json');
const AUDIT_PATH = path.join(__dirname, 'audit_q1_2026_v12_1.json');

const TURNO_LABELS = {
    'M':'Mañana','T':'Tarde','N':'Noche','D':'Descanso',
    'VAC':'Vacaciones','BAJA':'Baja','PERM':'Permiso','FORM':'Formación'
};
const ABSENCE_TYPES = new Set(['VAC','BAJA','PERM','FORM','IT']);

async function request(method, path, body) {
    return new Promise((resolve, reject) => {
        const url = `${SUPABASE_URL}/rest/v1/${path}`;
        const options = {
            method,
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            }
        };
        const req = https.request(url, options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch(e) { resolve(data); }
            });
        });
        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function fetchFromSupabase(table, query) {
    return request('GET', `${table}?${query}`);
}

function addDays(dateStr, n) {
    const d = new Date(dateStr + 'T12:00:00');
    d.setDate(d.getDate() + n);
    return d.toISOString().split('T')[0];
}

function buildCell(code, extra = {}) {
    let c = (code || '').toUpperCase().trim();
    if (c.startsWith('VAC')) c = 'VAC';
    else if (c.startsWith('BAJA')) c = 'BAJA';
    else if (c.startsWith('PERM')) c = 'PERM';
    else if (c.startsWith('FORM')) c = 'FORM';

    const isAbsence = ABSENCE_TYPES.has(c);
    return {
        code: c || '—',
        label: TURNO_LABELS[c] || (c || '—'),
        type: isAbsence ? c : 'NORMAL',
        isAbsence,
        icons: extra.icons || [],
        origen: extra.origen || 'BASE',
        sustituto: extra.sustituto || null,
        titular_cubierto: extra.titular_cubierto || null
    };
}

async function runPublication() {
    console.log('\n=============================================');
    console.log('   PUBLICACIÓN CONTROLADA Q1 2026 (V12.1)');
    console.log('=============================================\n');

    const audit = JSON.parse(fs.readFileSync(AUDIT_PATH, 'utf8'));
    const structure = JSON.parse(fs.readFileSync(STRUCTURE_PATH, 'utf8'));

    const aptaWeeks = audit.weeks.filter(w => w.status === 'APTA');
    console.log(`Cargadas ${aptaWeeks.length} semanas APTAS para publicación.`);

    // 1. Cargar datos maestros para regeneración
    console.log('Cargando datos maestros...');
    const todosTurnos = await fetchFromSupabase('turnos', 'fecha=gte.2025-12-29&fecha=lte.2026-04-05&limit=20000');
    const eventosRaw = await fetchFromSupabase('eventos_cuadrante', 'fecha_inicio=gte.2025-12-29&fecha_inicio=lte.2026-04-05&limit=5000');
    const eventos = (eventosRaw || []).filter(ev => !/anulad|rechazad/i.test(ev.estado || ''));

    const turnoMap = {};
    todosTurnos.forEach(t => {
        turnoMap[`${t.hotel_id}::${t.empleado_id}::${t.fecha}`] = t;
    });

    const ausenciaMap = {};
    const cambioMap = {};
    eventos.forEach(ev => {
        const tipo = (ev.tipo || '').toUpperCase().trim();
        const hotel = ev.hotel_origen || ev.hotel;
        const sustituto = ev.sustituto_id || ev.sustituto || ev.empleado_destino_id || null;
        let d = ev.fecha_inicio;
        while (d <= ev.fecha_fin) {
            const key = `${hotel}::${ev.empleado_id}::${d}`;
            if (ABSENCE_TYPES.has(tipo.startsWith('VAC') ? 'VAC' : (tipo.startsWith('BAJA') ? 'BAJA' : (tipo.startsWith('PERM') ? 'PERM' : tipo)))) {
                ausenciaMap[key] = { tipo, sustituto };
            } else if (tipo.includes('CAMBIO') || tipo.includes('INTERCAMBIO')) {
                cambioMap[key] = ev;
                if (ev.empleado_destino_id) cambioMap[`${hotel}::${ev.empleado_destino_id}::${d}`] = ev;
            }
            d = addDays(d, 1);
        }
    });

    const results = {
        published: [],
        skipped: [],
        logs: []
    };

    for (const weekInfo of aptaWeeks) {
        const { hotel, weekStart } = weekInfo;
        if (hotel === 'Cumbria Spa&Hotel' && weekStart === '2026-03-29') {
            console.log(`Skipping blocked week: ${hotel} [${weekStart}]`);
            continue;
        }

        console.log(`Procesando ${hotel} [${weekStart}]...`);

        // A. Buscar rollback_target y version
        const existing = await fetchFromSupabase('publicaciones_cuadrante', `hotel=eq.${encodeURIComponent(hotel)}&semana_inicio=eq.${weekStart}&order=version.desc&limit=1`);
        const rollback_target = existing.length > 0 ? existing[0].id : null;
        const lastVersion = existing.length > 0 ? (existing[0].version || 0) : 0;
        const nextVersion = Math.max(121, lastVersion + 1);

        // B. Generar Snapshot
        const weekDates = [0,1,2,3,4,5,6].map(i => addDays(weekStart, i));
        const baseOrder = structure[hotel][weekStart];
        const operationalRows = [];
        const absentRows = [];
        const assignedEmps = new Set();
        const weekAbsences = new Map();

        baseOrder.forEach(titular => {
            weekDates.forEach(fecha => {
                const abs = ausenciaMap[`${hotel}::${titular}::${fecha}`];
                if (abs) weekAbsences.set(titular, abs);
            });
        });

        baseOrder.forEach((titular, idx) => {
            const absInfo = weekAbsences.get(titular);
            if (absInfo) {
                const diasInformativos = {};
                weekDates.forEach(fecha => {
                    const abs = ausenciaMap[`${hotel}::${titular}::${fecha}`];
                    diasInformativos[fecha] = buildCell(abs ? abs.tipo : '—', { origen: 'EVENTO' });
                });
                absentRows.push({
                    empleado_id: titular, nombre: titular, nombreVisible: titular,
                    rowType: 'ausencia_informativa',
                    puestoOrden: 900 + idx,
                    cells: diasInformativos
                });

                const sustituto = absInfo.sustituto;
                if (sustituto && !assignedEmps.has(sustituto)) {
                    const diasSustituto = {};
                    weekDates.forEach(fecha => {
                        const tTitular = turnoMap[`${hotel}::${titular}::${fecha}`];
                        const cambio = cambioMap[`${hotel}::${sustituto}::${fecha}`];
                        diasSustituto[fecha] = buildCell(tTitular?.turno || '', { 
                            titular_cubierto: titular,
                            icons: cambio ? ['🔄'] : []
                        });
                    });
                    operationalRows.push({
                        empleado_id: sustituto, nombre: sustituto, nombreVisible: sustituto,
                        rowType: 'operativo',
                        puestoOrden: idx + 1,
                        cells: diasSustituto
                    });
                    assignedEmps.add(sustituto);
                } else {
                    operationalRows.push({
                        empleado_id: 'VACANTE', nombre: 'Sin cubrir', nombreVisible: 'Sin cubrir',
                        rowType: 'operativo',
                        puestoOrden: idx + 1,
                        cells: weekDates.reduce((a,v) => ({...a, [v]: buildCell('')}), {})
                    });
                }
            } else {
                if (!assignedEmps.has(titular)) {
                    const dias = {};
                    weekDates.forEach(fecha => {
                        const t = turnoMap[`${hotel}::${titular}::${fecha}`];
                        const cambio = cambioMap[`${hotel}::${titular}::${fecha}`];
                        dias[fecha] = buildCell(t?.turno || '', {
                            icons: cambio ? ['🔄'] : []
                        });
                    });
                    operationalRows.push({
                        empleado_id: titular, nombre: titular, nombreVisible: titular,
                        rowType: 'operativo',
                        puestoOrden: idx + 1,
                        cells: dias
                    });
                    assignedEmps.add(titular);
                }
            }
        });

        const snapshotData = {
            hotel,
            week_start: weekStart,
            week_end: weekDates[6],
            rows: [...operationalRows, ...absentRows]
        };

        const dbRecord = {
            hotel,
            semana_inicio: weekStart,
            semana_fin: weekDates[6],
            snapshot_json: snapshotData,
            version: nextVersion,
            estado: 'publicado',
            publicado_por: 'AGENT_AI_STABILIZER'
        };

        // C. Publicar
        const res = await request('POST', 'publicaciones_cuadrante', dbRecord);
        if (res && res.length > 0 && res[0].id) {
            const snapId = res[0].id;
            results.published.push({ id: snapId, hotel, weekStart, rollback_target, version: nextVersion });
            console.log(`   ✅ Publicado ID: ${snapId} (v${nextVersion})`);
        } else {
            console.error(`   ❌ Error publicando:`, res);
            results.skipped.push({ hotel, weekStart, error: res });
        }
    }

    // D. Log Global
    if (results.published.length > 0) {
        const logEntry = {
            usuario: 'AGENT_AI_STABILIZER',
            resumen: `Publicación Masiva Q1 2026 V12.1. Total: ${results.published.length} semanas.`,
            cambios_json: { published: results.published.map(p => p.id) },
            cambios_totales: results.published.length
        };
        await request('POST', 'publicaciones_log', logEntry);
    }

    fs.writeFileSync('scratch/publication_results_q1.json', JSON.stringify(results, null, 2));
    console.log(`\nPROCESO FINALIZADO.`);
    console.log(`Publicados: ${results.published.length}`);
    console.log(`Omitidos: ${results.skipped.length}`);
}

runPublication().catch(e => console.error('Error fatal:', e));
