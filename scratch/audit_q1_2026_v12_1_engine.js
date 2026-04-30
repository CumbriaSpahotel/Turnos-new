const fs = require('fs');
const path = require('path');
const https = require('https');

const SUPABASE_URL = 'https://drvmxranbpumianmlzqr.supabase.co';
const SUPABASE_KEY = 'sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ';

const STRUCTURE_PATH = path.join(__dirname, '..', 'temp_node', 'excel_structure_2026.json');
const REPORT_PATH = path.join(__dirname, 'audit_q1_2026_v12_1.json');

const TURNO_LABELS = {
    'M':'Mañana','T':'Tarde','N':'Noche','D':'Descanso',
    'VAC':'Vacaciones','BAJA':'Baja','PERM':'Permiso','FORM':'Formación'
};
const ABSENCE_TYPES = new Set(['VAC','BAJA','PERM','FORM','IT']);

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

const VALIDATION_RULES = {
    R1_EXCEL_ORDER: (rows, baseOrder) => {
        const opRows = rows.filter(r => r.rowType === 'operativo');
        for (let i = 0; i < opRows.length; i++) {
            // No podemos comparar directamente nombres porque puede haber sustitutos
            // Pero el puestoOrden debe ser ascendente
            if (i > 0 && opRows[i].puestoOrden < opRows[i-1].puestoOrden) return false;
        }
        return true;
    },
    R2_NO_DUPLICATES: (rows) => {
        const opIds = rows.filter(r => r.rowType === 'operativo').map(r => r.empleado_id);
        return new Set(opIds).size === opIds.length;
    },
    R3_NO_EMP_XXXX: (rows) => {
        return !rows.some(r => /EMP-\d{4}/i.test(r.nombre) || /EMP-\d{4}/i.test(r.empleado_id));
    },
    R4_NO_SUST_TEXT: (rows) => {
        return !rows.some(r => String(r.nombre).includes('Sustituye a'));
    },
    R5_EMPTY_ROWS: (rows) => {
        return !rows.some(r => {
            if (r.rowType !== 'operativo') return false;
            const codes = Object.values(r.dias).map(d => d.code);
            return codes.every(c => c === '—' || c === '');
        });
    }
};

async function runAudit() {
    console.log('\n=============================================');
    console.log('   DRY RUN AUDIT Q1 2026 (V12.1)');
    console.log('=============================================\n');

    if (!fs.existsSync(STRUCTURE_PATH)) {
        throw new Error('No se encontró excel_structure_2026.json');
    }
    const structure = JSON.parse(fs.readFileSync(STRUCTURE_PATH, 'utf8'));

    console.log('1. Cargando datos de Supabase...');
    const todosTurnos = await fetchFromSupabase('turnos', 'fecha=gte.2025-12-29&fecha=lte.2026-04-05&limit=20000');
    const eventosRaw = await fetchFromSupabase('eventos_cuadrante', 'fecha_inicio=gte.2025-12-29&fecha_inicio=lte.2026-04-05&limit=5000');

    const eventos = (eventosRaw || []).filter(ev => !/anulad|rechazad/i.test(ev.estado || ''));

    console.log(`   - Turnos: ${todosTurnos.length}`);
    console.log(`   - Eventos: ${eventos.length}`);

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
                if (ev.empleado_destino_id) {
                    cambioMap[`${hotel}::${ev.empleado_destino_id}::${d}`] = ev;
                }
            }
            d = addDays(d, 1);
        }
    });

    const report = {
        generated_at: new Date().toISOString(),
        range: "2026-01-01 to 2026-03-31",
        stats: { total_weeks: 0, aptas: 0, bloqueadas: 0, avisos: 0 },
        weeks: [],
        samples: {}
    };

    const HOTELS = ['Cumbria Spa&Hotel', 'Sercotel Guadiana'];
    
    for (const hotel of HOTELS) {
        const hotelWeeks = structure[hotel] || {};
        const availableWeeks = Object.keys(hotelWeeks).sort();

        for (const weekStart of availableWeeks) {
            if (weekStart > '2026-03-31') continue; // Solo Q1
            
            report.stats.total_weeks++;
            const weekDates = [0,1,2,3,4,5,6].map(i => addDays(weekStart, i));
            const baseOrder = hotelWeeks[weekStart] || [];
            
            if (baseOrder.length === 0) {
                // Si no hay estructura para esta semana, usamos la más cercana o avisamos
                // Para el audit, buscaremos la primera disponible en el hotel
                const firstAvailable = Object.keys(hotelWeeks).sort()[0];
                if (firstAvailable) {
                    // console.warn(`Semana ${weekStart} sin estructura en ${hotel}, usando ${firstAvailable}`);
                    // baseOrder.push(...hotelWeeks[firstAvailable]);
                }
            }

            const operationalRows = [];
            const absentRows = [];
            const assignedEmps = new Set();
            const errors = [];
            const warnings = [];

            // 1. Identificar ausencias de titulares
            const weekAbsences = new Map();
            baseOrder.forEach(titular => {
                weekDates.forEach(fecha => {
                    const abs = ausenciaMap[`${hotel}::${titular}::${fecha}`];
                    if (abs) weekAbsences.set(titular, abs);
                });
            });

            // 2. Construir filas
            baseOrder.forEach((titular, idx) => {
                const absInfo = weekAbsences.get(titular);
                const puestoOrden = idx + 1;

                if (absInfo) {
                    // Titular ausente -> Fila informativa
                    const diasInformativos = {};
                    weekDates.forEach(fecha => {
                        const abs = ausenciaMap[`${hotel}::${titular}::${fecha}`];
                        diasInformativos[fecha] = buildCell(abs ? abs.tipo : '—', { origen: 'EVENTO' });
                    });
                    absentRows.push({
                        empleado_id: titular, nombre: titular,
                        rowType: 'ausencia_informativa',
                        puestoOrden: 900 + idx, // Al final
                        dias: diasInformativos
                    });

                    // Sustituto ocupa puesto
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
                            empleado_id: sustituto, nombre: sustituto,
                            rowType: 'operativo',
                            puestoOrden,
                            dias: diasSustituto
                        });
                        assignedEmps.add(sustituto);
                    } else {
                        // Vacante
                        operationalRows.push({
                            empleado_id: 'VACANTE', nombre: 'Sin cubrir',
                            rowType: 'operativo',
                            puestoOrden,
                            dias: weekDates.reduce((a,v) => ({...a, [v]: buildCell('')}), {})
                        });
                    }
                } else {
                    // Titular activo
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
                            empleado_id: titular, nombre: titular,
                            rowType: 'operativo',
                            puestoOrden,
                            dias: dias
                        });
                        assignedEmps.add(titular);
                    }
                }
            });

            const allRows = [...operationalRows, ...absentRows];

            // VALIDACIONES
            if (!VALIDATION_RULES.R1_EXCEL_ORDER(allRows, baseOrder)) errors.push("Error de orden Excel");
            if (!VALIDATION_RULES.R2_NO_DUPLICATES(allRows)) errors.push("Duplicados operativos detectados");
            if (!VALIDATION_RULES.R3_NO_EMP_XXXX(allRows)) errors.push("IDs internos EMP-XXXX visibles");
            if (!VALIDATION_RULES.R4_NO_SUST_TEXT(allRows)) errors.push("Texto 'Sustituye a' en nombre");
            if (!VALIDATION_RULES.R5_EMPTY_ROWS(allRows)) errors.push("Filas operativas vacías");

            const isApta = errors.length === 0;
            if (isApta) report.stats.aptas++; else report.stats.bloqueadas++;
            if (warnings.length > 0) report.stats.avisos++;

            const weekReport = {
                hotel, weekStart,
                status: isApta ? 'APTA' : 'BLOQUEADA',
                errors, warnings,
                summary: {
                    operational: operationalRows.length,
                    absent: absentRows.length,
                    vacancies: operationalRows.filter(r => r.empleado_id === 'VACANTE').length
                }
            };

            report.weeks.push(weekReport);

            // Samples
            if (!report.samples.no_incidents && isApta && absentRows.length === 0 && operationalRows.length > 0) {
                report.samples.no_incidents = { hotel, weekStart, rows: allRows.map(r => ({id: r.empleado_id, type: r.rowType, order: r.puestoOrden})) };
            }
            if (!report.samples.vacation && isApta && Array.from(weekAbsences.values()).some(a => a.tipo.startsWith('VAC'))) {
                report.samples.vacation = { hotel, weekStart, rows: allRows.map(r => ({id: r.empleado_id, type: r.rowType, order: r.puestoOrden})) };
            }
            if (!report.samples.substitute && isApta && operationalRows.some(r => Object.values(r.dias).some(d => d.titular_cubierto))) {
                report.samples.substitute = { hotel, weekStart, rows: allRows.map(r => ({id: r.empleado_id, type: r.rowType, order: r.puestoOrden})) };
            }
            if (!report.samples.shift_change && isApta && Object.keys(cambioMap).some(k => k.startsWith(hotel) && k.includes(weekStart))) {
                report.samples.shift_change = { hotel, weekStart, rows: allRows.map(r => ({id: r.empleado_id, type: r.rowType, order: r.puestoOrden})) };
            }
        }
    }

    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
    console.log(`\n✅ Auditoría Q1 completada.`);
    console.log(`   Reporte: ${REPORT_PATH}`);
    console.log(`   Semanas Aptas: ${report.stats.aptas}/${report.stats.total_weeks}`);
    console.log(`   Semanas Bloqueadas: ${report.stats.bloqueadas}`);
}

runAudit().catch(e => console.error('❌ Error fatal:', e));
