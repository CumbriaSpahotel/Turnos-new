/**
 * MASTER PUBLISHER 2026 — TurnosWeb
 * 
 * Este script automatiza la generación de snapshots para TODO EL AÑO 2026
 * siguiendo la Regla de Oro (Estructura Excel + Sustituciones Heredadas).
 * 
 * FASES:
 * 1. Carga Estructura Excel (generada por crawl_2026_structure.js)
 * 2. Carga Eventos y Turnos desde Supabase.
 * 3. Resuelve Ausencias y Sustituciones.
 * 4. Genera Snapshot V12.1.
 * 5. Reporte de Auditoría / Publicación.
 */

const SUPABASE_URL = 'https://drvmxranbpumianmlzqr.supabase.co';
const SUPABASE_KEY = 'sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ';
const fs = require('fs');
const path = require('path');
const https = require('https');

async function fetchFromSupabase(table, query) {
    return new Promise((resolve, reject) => {
        const url = `${SUPABASE_URL}/rest/v1/${table}?${query}`;
        const options = {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        };
        https.get(url, options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch(e) { resolve([]); }
            });
        }).on('error', reject);
    });
}

const STRUCTURE_PATH = path.join(__dirname, 'excel_structure_2026.json');
const REPORT_PATH = path.join(__dirname, 'audit_report_2026.json');

const TURNO_LABELS = {
    'M':'Mañana','T':'Tarde','N':'Noche','D':'Descanso',
    'VAC':'Vacaciones','BAJA':'Baja','PERM':'Permiso','FORM':'Formación'
};
const ABSENCE_TYPES = new Set(['VAC','BAJA','PERM','FORM','IT']);

// CONFIGURACIÓN
const DRY_RUN = true; // CAMBIAR A false PARA PUBLICAR REALMENTE
const HOTELS = ['Cumbria Spa&Hotel', 'Sercotel Guadiana'];

function addDays(dateStr, n) {
    const d = new Date(dateStr + 'T12:00:00');
    d.setDate(d.getDate() + n);
    return d.toISOString().split('T')[0];
}

function buildCell(code, extra = {}) {
    let c = (code || '').toUpperCase().trim();
    // Normalizar para que coincida con ABSENCE_TYPES
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
        icons: [],
        origen: 'BASE',
        sustituto: extra.sustituto || null,
        titular_cubierto: extra.titular_cubierto || null
    };
}

async function runMaster() {
    console.log('\n=============================================');
    console.log('   PREPARACIÓN PUBLICACIÓN MASIVA 2026');
    console.log('   MODO:', DRY_RUN ? 'AUDITORÍA (Sin cambios)' : '🚀 PUBLICACIÓN REAL');
    console.log('=============================================\n');

    if (!fs.existsSync(STRUCTURE_PATH)) {
        throw new Error('No se encontró excel_structure_2026.json. Ejecuta crawl_2026_structure.js primero.');
    }
    const structure = JSON.parse(fs.readFileSync(STRUCTURE_PATH, 'utf8'));

    console.log('1. Cargando datos de Supabase...');
    const todosTurnos = await fetchFromSupabase('turnos', 'fecha=gte.2026-01-01&fecha=lte.2026-12-31&limit=10000');
    const eventosRaw = await fetchFromSupabase('eventos_cuadrante', 'fecha_inicio=gte.2026-01-01&fecha_inicio=lte.2026-12-31&limit=5000');

    const eventos = (eventosRaw || []).filter(ev => {
        const type = (ev.tipo || '').toUpperCase().trim();
        const normalizedType = type.startsWith('VAC') ? 'VAC' : 
                               type.startsWith('PERM') ? 'PERM' : 
                               type.startsWith('FORM') ? 'FORM' : 
                               type.startsWith('BAJA') ? 'BAJA' : type;
        
        return !/anulad|rechazad/i.test(ev.estado || '') &&
               ABSENCE_TYPES.has(normalizedType);
    });

    console.log(`   - Turnos cargados: ${todosTurnos.length}`);
    console.log(`   - Eventos de ausencia: ${eventos.length}`);

    const turnoMap = {};
    todosTurnos.forEach(t => {
        turnoMap[`${t.hotel_id}::${t.empleado_id}::${t.fecha}`] = t;
    });

    const ausenciaMap = {};
    eventos.forEach(ev => {
        let tipo = (ev.tipo || '').toUpperCase().trim();
        if (tipo.startsWith('VAC')) tipo = 'VAC';
        else if (tipo.startsWith('BAJA')) tipo = 'BAJA';
        else if (tipo.startsWith('PERM')) tipo = 'PERM';
        else if (tipo.startsWith('FORM')) tipo = 'FORM';

        const hotel = ev.hotel_origen;
        const sustituto = ev.sustituto_id || ev.sustituto || null;
        let d = ev.fecha_inicio;
        while (d <= ev.fecha_fin) {
            const key = hotel ? `${hotel}::${ev.empleado_id}::${d}` : `*::${ev.empleado_id}::${d}`;
            ausenciaMap[key] = { tipo, sustituto };
            d = addDays(d, 1);
        }
    });

    const audit = { generated_at: new Date().toISOString(), weeks: [] };

    for (const hotel of HOTELS) {
        const hotelWeeks = structure[hotel] || {};
        const weekDates = Object.keys(hotelWeeks).sort();

        for (const weekStart of weekDates) {
            const weekDatesRange = [0,1,2,3,4,5,6].map(i => addDays(weekStart, i));
            const baseOrder = hotelWeeks[weekStart];
            
            const operationalRows = [];
            const absentRows = [];
            const assignedEmps = new Set();

            // 1. Identificar ausencias y sus sustitutos
            const weekAbsences = new Map(); // titular -> { tipo, sustituto }
            baseOrder.forEach(titular => {
                weekDatesRange.forEach(fecha => {
                    const abs = ausenciaMap[`${hotel}::${titular}::${fecha}`] || ausenciaMap[`*::${titular}::${fecha}`];
                    if (abs) weekAbsences.set(titular, abs);
                });
            });

            // 2. Construir filas operativas (Siguiendo orden Excel)
            baseOrder.forEach((titular, idx) => {
                const absInfo = weekAbsences.get(titular);

                if (absInfo) {
                    // TITULAR AUSENTE
                    // a) Crear fila informativa al final
                    const diasAusente = {};
                    weekDatesRange.forEach(fecha => {
                        const abs = ausenciaMap[`${hotel}::${titular}::${fecha}`] || ausenciaMap[`*::${titular}::${fecha}`];
                        diasAusente[fecha] = buildCell(abs ? abs.tipo : '—');
                    });
                    absentRows.push({
                        empleado_id: titular, nombre: titular,
                        rowType: 'ausencia_informativa',
                        puestoOrden: 100 + idx, orden: 100 + idx,
                        dias: diasAusente
                    });

                    // b) Si hay sustituto, ocupa el puesto original
                    const sustituto = absInfo.sustituto;
                    if (sustituto && !assignedEmps.has(sustituto)) {
                        const diasSustituto = {};
                        weekDatesRange.forEach(fecha => {
                            const tTitular = turnoMap[`${hotel}::${titular}::${fecha}`];
                            diasSustituto[fecha] = buildCell(tTitular?.turno || '', { titular_cubierto: titular });
                        });
                        operationalRows.push({
                            empleado_id: sustituto, nombre: sustituto,
                            rowType: 'operativo',
                            puestoOrden: idx + 1, orden: idx + 1,
                            dias: diasSustituto
                        });
                        assignedEmps.add(sustituto);
                    } else {
                        // Vacante si no hay sustituto
                        operationalRows.push({
                            empleado_id: 'VACANTE', nombre: 'Sin cubrir',
                            rowType: 'operativo',
                            puestoOrden: idx + 1, orden: idx + 1,
                            dias: weekDatesRange.reduce((a,v) => ({...a, [v]: buildCell('')}), {})
                        });
                    }
                } else {
                    // TITULAR ACTIVO
                    if (!assignedEmps.has(titular)) {
                        const dias = {};
                        weekDatesRange.forEach(fecha => {
                            const t = turnoMap[`${hotel}::${titular}::${fecha}`];
                            dias[fecha] = buildCell(t?.turno || '');
                        });
                        operationalRows.push({
                            empleado_id: titular, nombre: titular,
                            rowType: 'operativo',
                            puestoOrden: idx + 1, orden: idx + 1,
                            dias: dias
                        });
                        assignedEmps.add(titular);
                    }
                }
            });

            const snapshot = {
                hotel,
                semana_inicio: weekStart,
                semana_fin: weekDatesRange[6],
                empleados: [...operationalRows, ...absentRows],
                metadata: { version_builder: 'V12.1-MASTER-2026', published_at: new Date().toISOString() }
            };

            audit.weeks.push({
                hotel, weekStart,
                row_count: snapshot.empleados.length,
                absences: Array.from(weekAbsences.keys())
            });

            if (!DRY_RUN) {
                // LÓGICA DE PUBLICACIÓN REAL
                console.log(`   🚀 Publicando ${hotel} [${weekStart}]...`);
                // Aquí iría el insert en publicaciones_cuadrante (Omitido por seguridad en este paso)
            }
        }
    }

    fs.writeFileSync(REPORT_PATH, JSON.stringify(audit, null, 2));
    console.log(`\n✅ Proceso completado. Reporte generado en: ${REPORT_PATH}`);
    console.log(`   Semanas procesadas: ${audit.weeks.length}`);
}

runMaster().catch(e => console.error('❌ Error fatal:', e));
