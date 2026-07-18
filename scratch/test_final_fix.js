const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

global.window = {
  normalizeId: (v) => {
    if (!v) return '';
    return String(v)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .replace(/\s+/g, ' ')
        .toLowerCase();
  },
  normalizePersonKey: (v) => {
    if (!v) return '';
    return String(v)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .replace(/\s+/g, ' ')
        .toLowerCase();
  },
  normalizeDate: (v) => String(v || '').split(/[T ]/)[0],
  normalizeTipo: (v) => String(v || '').toUpperCase(),
  normalizeEstado: (v) => String(v || '').toLowerCase(),
  isPlaceholderId: () => false,
  getEmployeeStructuralType: () => 'fijo',
  isEmpleadoOcasionalOApoyo: () => false,
  isValidShiftValue: (v) => ["M","T","N","D","MANANA","TARDE","NOCHE","DESCANSO"].includes(String(v || '').toUpperCase()),
  isInvalidLegacyChangeValue: () => false,
  normalizeShiftValue: (v) => {
    const t = String(v || '').toUpperCase();
    if (t === 'M' || t === 'T' || t === 'N' || t === 'D') return t;
    return null;
  },
  getTurnoIcon: () => '',
  employeeNorm: (val) => String(val || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
  addIsoDays: (d, i) => {
    const base = new Date(d + 'T12:00:00');
    base.setDate(base.getDate() + i);
    const y = base.getFullYear();
    const m = String(base.getMonth() + 1).padStart(2, '0');
    const day = String(base.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  },
  getMonday: (d) => {
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  },
  isoDate: (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  },
  detectarErrores: () => {},
  validarPreviewModel: () => {},
  loadV9ExcelOrderMap: () => {},
  fmtDateLegacy: (d) => d
};

const resolverText = fs.readFileSync('shift-resolver.js', 'utf8');
eval(resolverText);
const rulesText = fs.readFileSync('turnos-rules.js', 'utf8');
eval(rulesText);

const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

global.window.supabase = supabase;
global.window.buildPuestoId = (h, i) => `${h}::${String(i).padStart(3, '0')}`;
global.window.getV9ExcelOrder = () => 500;
global.window.loadAdminExcelSourceRows = async () => ({});

const adminText = fs.readFileSync('admin.js', 'utf8');

// We will load the modified getEmployees logic
const patchedGetEmployees = `
    const getEmployees = (viewType = 'weekly') => {
        const firstDate = dates[0] || '';
        const operationalRows = [];
        const absentRows = [];
        const extraRefuerzoRows = [];
        const assignedNorms = new Set(); // Empleados ya colocados en puestos operativos
        
        // 1. PRE-PROCESAR ESTADO DE LA SEMANA
        const weekStatus = new Map(); // normTitular -> { tipo, sustitutoId, ... }
        const substitutesMap = new Map(); // normSustituto -> { normTitular, ... }
        const activeSubstitutes = []; // Array to track all unique substitutions
        
        eventos.forEach(ev => {
            const tipo = window.normalizeTipo(ev.tipo);
            if (!['VAC', 'BAJA', 'PERM', 'PERMISO', 'FORMACION'].includes(tipo)) return;
            if (window.normalizeEstado(ev.estado) === 'anulado') return;
            if (window.eventoPerteneceAHotel && !window.eventoPerteneceAHotel(ev, hotel)) return;

            const fi = window.normalizeDate(ev.fecha_inicio);
            const ff = window.normalizeDate(ev.fecha_fin || ev.fecha_inicio);
            if (!dates.some(d => d >= fi && d <= ff)) return;

            const tId = ev.empleado_id || ev.titular_id || ev.participante_a || ev.empleado;
            if (!tId) return;
            const normT = resolveId(tId);
            
            let sRaw = window.getOtroEmpleadoDelCambio ? window.getOtroEmpleadoDelCambio(ev, tId) : null;
            if (!sRaw) {
                sRaw = ev.empleado_destino_id || ev.sustituto_id || ev.sustituto || ev.payload?.sustituto_id || ev.payload?.sustituto || ev.participante_b || ev.destino_id;
            }
            const normS = resolveId(sRaw);
            
            if (normS) {
                activeSubstitutes.push({ normS, sRaw, normT, ev });
            }
            
            const existing = weekStatus.get(normT);
            if (existing && existing.sustitutoId && !sRaw) return;

            const statusData = { 
                tipo, 
                sustitutoId: normS, 
                rawSust: sRaw, 
                titularId: tId,
                event_id: ev.id,
                payload: ev.payload,
                meta: ev.meta
            };
            weekStatus.set(normT, statusData);
            if (normS) substitutesMap.set(normS, statusData);
        });

        // 2. PROCESAR FILAS EXCEL (ESTRUCTURA BASE)
        sourceRows.forEach(r => {
            if (!r.empleadoId || String(r.empleadoId).trim() === '') return;
            if (String(r.empleadoId || '').includes('---') || String(r.empleadoId || '').includes('___')) return;
            
            const normTitular = resolveId(r.empleadoId);
            const v9Order = window.getV9ExcelOrder(hotel, r.week_start || firstDate, r.empleadoId) || 500;
            const status = weekStatus.get(normTitular);

            // CASO A: TITULAR ESTÁ AUSENTE
            if (status) {
                const titularName = getDisplayName(r.empleadoId, r);
                absentRows.push({
                    ...r,
                    employee_id: r.empleadoId,
                    nombre: titularName,
                    nombreVisible: titularName,
                    isAbsentInformative: true,
                    rowType: 'ausencia_informativa',
                    puestoOrden: v9Order + 1000,
                    evento_id: status.event_id,
                    titularOriginalId: r.empleadoId
                });

                let occupantId = null;
                let isSustitucion = false;
                let isVacante = false;

                if (status.sustitutoId) {
                    occupantId = status.sustitutoId;
                    isSustitucion = true;
                } else {
                    occupantId = 'VACANTE-' + normTitular;
                    isVacante = true;
                }

                const normOcc = resolveId(occupantId);
                if (isSustitucion && assignedNorms.has(normOcc)) {
                    return;
                }

                const occName = isVacante ? 'VACANTE' : getDisplayName(occupantId, { nombre: status.rawSust });
                operationalRows.push({
                    ...r,
                    employee_id: occupantId,
                    empleadoId: occupantId,
                    nombre: occName,
                    nombreVisible: occName,
                    displayName: occName,
                    isVacante,
                    isSustitucion,
                    puestoOrden: v9Order,
                    rowType: 'operativo',
                    titularOriginal: titularName,
                    titularOriginalId: r.empleadoId,
                    evento_id: status.event_id
                });
                if (occupantId && !isVacante) assignedNorms.add(normOcc);

            } 
            // CASO B: TITULAR ESTÁ PRESENTE
            else {
                if (!assignedNorms.has(normTitular)) {
                    const titularName = getDisplayName(r.empleadoId, r);
                    operationalRows.push({
                        ...r,
                        employee_id: r.empleadoId,
                        empleadoId: r.empleadoId,
                        nombre: titularName,
                        nombreVisible: titularName,
                        displayName: titularName,
                        puestoOrden: v9Order,
                        rowType: 'operativo',
                        titularOriginal: titularName
                    });
                    assignedNorms.add(normTitular);
                }
            }
        });

        // 2.5 AÑADIR FILAS DE SUSTITUTOS ADICIONALES QUE NO TIENEN PUESTO OPERATIVO Y NO ESTÁN COLOCADOS
        activeSubstitutes.forEach(sub => {
            if (!assignedNorms.has(sub.normS)) {
                const empProfile = employees.find(e => resolveId(e.id) === sub.normS || resolveId(e.nombre) === sub.normS);
                const displayName = empProfile?.nombre || getDisplayName(sub.sRaw);
                const titularProfile = employees.find(e => resolveId(e.id) === sub.normT || resolveId(e.nombre) === sub.normT);
                const titularName = titularProfile?.nombre || getDisplayName(sub.normT);
                const v9Order = window.getV9ExcelOrder(hotel, firstDate, sub.normS) || empProfile?.orden || empProfile?.display_order || 999;
                
                operationalRows.push({
                    empleadoId: sub.normS,
                    employee_id: sub.normS,
                    nombre: displayName,
                    nombreVisible: displayName,
                    displayName: displayName,
                    rowIndex: v9Order,
                    puestoOrden: v9Order,
                    rowType: 'operativo',
                    weekStart: firstDate,
                    values: new Array(dates.length).fill(null),
                    isSubstituteRow: true,
                    titularOriginal: titularName,
                    titularOriginalId: sub.normT,
                    evento_id: sub.ev.id
                });
                assignedNorms.add(sub.normS);
            }
        });

        // 3. PROCESAR REFUERZOS EXPLÍCITOS
        eventos.forEach(ev => {
            const isExplicitRef = Boolean(ev.isRefuerzo === true || ev.origen === 'refuerzo' || ev.payload?.tipo_modulo === 'refuerzo' || ev.meta?.refuerzo === true);
            if (!isExplicitRef) return;
            if (window.normalizeEstado(ev.estado) === 'anulado') return;
            if (window.eventoPerteneceAHotel && !window.eventoPerteneceAHotel(ev, hotel)) return;

            const fi = window.normalizeDate(ev.fecha_inicio);
            const ff = window.normalizeDate(ev.fecha_fin || ev.fecha_inicio);
            if (!dates.some(d => d >= fi && d <= ff)) return;

            const empId = ev.empleado_id;
            if (!empId) return;
            const normEmpId = window.normalizeId(empId);
            if (assignedNorms.has(normEmpId)) return;

            const empName = getDisplayName(empId);
            extraRefuerzoRows.push({ 
                hotel, 
                employee_id: empId, 
                nombre: empName, 
                puestoOrden: 2000, 
                rowType: 'refuerzo',
                origenOrden: 'refuerzo_explicito',
                evento_id: ev.id
            });
            assignedNorms.add(normEmpId);
        });

        operationalRows.sort((a, b) => a.puestoOrden - b.puestoOrden);
        absentRows.sort((a, b) => a.puestoOrden - b.puestoOrden);
        extraRefuerzoRows.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));

        return [...operationalRows, ...absentRows, ...extraRefuerzoRows].filter(r => {
            const validId = r.employee_id && !String(r.employee_id).includes('---') && !String(r.employee_id).includes('___');
            const isGhost = /^#?_dup_/i.test(r.employee_id) || /^#?_dup_/i.test(r.nombre);
            const validName = r.nombre && r.nombre !== 'Empleado' && r.nombre.trim().length > 1;
            return validId && validName && !isGhost;
        });
    };
`;

// Extract createPuestosPreviewModel code and patch it
let createPuestosPreviewModelCode = adminText.match(/window\.createPuestosPreviewModel\s*=\s*\(\{([\s\S]+?)\n\};/)[0];
// Replace getEmployees function in the code string
createPuestosPreviewModelCode = createPuestosPreviewModelCode.replace(/const getEmployees = \([\s\S]+?\n\s{4}\};/m, patchedGetEmployees);

eval(createPuestosPreviewModelCode);

const buildFingerprint = (rows) => {
    const fp = {};
    (rows || []).forEach(row => {
        const empId = row.empleado_id || row.employee_id || row.nombre || '';
        if (!empId) return;
        const daysCodes = Object.entries(row.dias || {}).map(([f, d]) => `${f}:${d.code || d.turno || ''}`).sort().join(',');
        fp[empId] = daysCodes;
    });
    return fp;
};

async function testWithEventsOrder(eventList, orderName, lastSnapRows) {
    const weekStart = '2026-05-11';
    const weekEnd = '2026-05-17';
    const dates = [0,1,2,3,4,5,6].map(i => global.window.addIsoDays(weekStart, i));
    const profiles = await supabase.from('empleados').select('*');
    const { data: turnosData } = await supabase.from('turnos').select('*').gte('fecha', weekStart).lte('fecha', weekEnd);
    
    // Build synthetic rows
    const hotelSourceRows = [];
    const hotelData = turnosData.filter(r => r.hotel_id === 'Cumbria Spa&Hotel');
    const empsInHotel = [...new Set(hotelData.map(r => r.empleado_id))];
    empsInHotel.forEach((empId, idx) => {
        const empProfile = (profiles.data || []).find(p => p.id === empId || p.nombre === empId);
        const row = {
            empleadoId: empId,
            displayName: empProfile?.nombre || empId,
            rowIndex: empProfile?.orden ?? empProfile?.display_order ?? empProfile?.sort_order ?? 999,
            weekStart: weekStart,
            values: dates.map(d => {
                const found = hotelData.find(r => r.empleado_id === empId && r.fecha === d);
                return found ? found.turno : null;
            })
        };
        hotelSourceRows.push(row);
    });

    const previewModel = global.window.createPuestosPreviewModel({
        hotel: 'Cumbria Spa&Hotel',
        dates: dates,
        sourceRows: hotelSourceRows,
        rows: turnosData.filter(r => r.hotel_id === 'Cumbria Spa&Hotel'),
        eventos: eventList,
        employees: profiles.data
    });
    
    const employeesToRender = previewModel.getEmployees('weekly');
    
    // Build snapshot rows from cache simulation
    const newRows = employeesToRender.map((employee, idx) => {
        const daysMap = {};
        dates.forEach(date => {
            const resolved = previewModel.getTurnoEmpleado(employee.employee_id, date);
            const visual = global.window.TurnosRules ? global.window.TurnosRules.describeCell(resolved) : { label: resolved.turno, icons: resolved.icons || [] };
            
            const absCode = resolved.incidencia
                ? (resolved.incidencia === 'PERMISO' ? 'PERM'
                   : resolved.incidencia === 'FORMACION' ? 'FORM'
                   : resolved.incidencia === 'BAJA' ? 'BAJA'
                   : resolved.incidencia === 'VAC' ? 'VAC'
                   : resolved.incidencia)
                : null;

            const icons = [...new Set([
                ...(visual.icon ? [visual.icon] : (resolved.icon ? [resolved.icon] : [])),
                ...((resolved.cambio || resolved.intercambio) ? ['\u{1F504}'] : [])
            ])];

            daysMap[date] = {
                label: visual.label || absCode || resolved.turno || '',
                code: absCode || resolved.turno || '',
                icons: icons,
                estado: (resolved.isAbsent || resolved.incidencia) ? 'ausente' : 'operativo',
                origen: resolved.incidencia || resolved.origen || 'base',
                titular_cubierto: resolved.titular || null,
                sustituto: resolved.sustituidoPor || null,
                changed: !!resolved.cambio
            };
        });
        return {
            nombre: employee.nombre || employee.employee_id,
            nombreVisible: employee.nombreVisible || employee.displayName || employee.nombre || employee.employee_id,
            empleado_id: employee.employee_id,
            orden: employee.puestoOrden || (idx + 1),
            dias: daysMap
        };
    });

    const oldFP = buildFingerprint(lastSnapRows);
    const newFP = buildFingerprint(newRows);
    
    const changes = Object.keys(newFP).filter(id => newFP[id] !== oldFP[id]);
    console.log(`\n--- Order: ${orderName} ---`);
    console.log(`Employees in snapshot: ${newRows.map(e => e.nombre).join(', ')}`);
    console.log(`Changes: ${changes.length}`);
    changes.forEach(id => {
        console.log(`  Difference for ${id}:`);
        console.log(`    Old: ${oldFP[id]}`);
        console.log(`    New: ${newFP[id]}`);
    });
}

async function run() {
    const { data: dbSnaps } = await supabase
      .from('publicaciones_cuadrante')
      .select('snapshot_json')
      .eq('estado', 'activo')
      .eq('hotel', 'Cumbria Spa&Hotel')
      .eq('semana_inicio', '2026-05-11')
      .order('version', { ascending: false })
      .limit(1);
    
    const lastSnapRows = dbSnaps[0].snapshot_json.rows;
    
    // Fetch raw events
    const { data: eventos } = await supabase.from('eventos_cuadrante').select('*').or('estado.is.null,estado.neq.anulado').lte('fecha_inicio', '2026-05-17').or(`fecha_fin.is.null,fecha_fin.gte.2026-05-11`);
    
    // Filters events for Cumbria
    const cumbriaEvents = eventos.filter(ev => {
        const evHotel = String(ev.hotel_origen || ev.hotel_id || ev.hotel || '').trim();
        return !evHotel || evHotel === 'Cumbria Spa&Hotel';
    });
    
    const otherEvents = cumbriaEvents.filter(e => e.id !== '51b9070c-6a44-4f2f-abdc-677543bc2fa2' && e.id !== '0275f0f3-e9ee-454e-8520-6f8e831da7d5');
    const evNatalio = cumbriaEvents.find(e => e.id === '51b9070c-6a44-4f2f-abdc-677543bc2fa2');
    const evIsabel = cumbriaEvents.find(e => e.id === '0275f0f3-e9ee-454e-8520-6f8e831da7d5');
    
    // Test both orderings
    console.log("TESTING WITH FINAL FIX APPLIED:");
    
    const listOrder1 = [...otherEvents, evIsabel, evNatalio];
    await testWithEventsOrder(listOrder1, "Natalio last", lastSnapRows);
    
    const listOrder2 = [...otherEvents, evNatalio, evIsabel];
    await testWithEventsOrder(listOrder2, "Isabel Hidalgo last", lastSnapRows);
}

run().catch(console.error);
