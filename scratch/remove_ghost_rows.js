
const fs = require('fs');

const filePath = 'admin.js';
let content = fs.readFileSync(filePath, 'utf8');

// Match only the start of the function
const getEmpsStartToken = 'const getEmployees = (viewType =';
const startIdx = content.indexOf(getEmpsStartToken);

if (startIdx === -1) {
    console.error("Could not find getEmployees start token");
    process.exit(1);
}

// Find the corresponding end of the function. 
// It ends with "return result;" followed by "};"
const returnMarker = 'return result;';
const returnIdx = content.indexOf(returnMarker, startIdx);
const endIdx = content.indexOf('};', returnIdx) + 2;

const newGetEmployees = `    const getEmployees = (viewType = 'weekly') => {
        const firstDate = dates[0] || '';
        const operativeRows = [];
        const absentRows = [];
        const handledEmps = new Set();
        
        const cleanForId = (name) => {
            if (!name) return '';
            return window.normalizeId(window.formatDisplayName(name));
        };

        // --- LOGICA VISTA SEMANAL (ESTRUCTURA OPERATIVA) ---
        if (viewType === 'weekly') {
            const weekStatus = new Map(); 
            eventos.forEach(ev => {
                const tipo = window.normalizeTipo(ev.tipo);
                if (!['VAC', 'BAJA', 'PERM', 'PERMISO', 'FORMACION', 'REFUERZO'].includes(tipo)) return;
                if (window.normalizeEstado(ev.estado) === 'anulado') return;
                if (window.eventoPerteneceAHotel && !window.eventoPerteneceAHotel(ev, hotel)) return;

                const fi = window.normalizeDate(ev.fecha_inicio);
                const ff = window.normalizeDate(ev.fecha_fin || ev.fecha_inicio);
                if (!dates.some(d => d >= fi && d <= ff)) return;

                const tId = ev.empleado_id;
                if (!tId) return;
                const normT = window.normalizeId(tId);
                const sRaw = ev.empleado_destino_id || ev.sustituto_id || ev.sustituto || ev.payload?.sustituto_id || ev.payload?.sustituto;
                
                const existing = weekStatus.get(normT);
                if (existing && existing.sustitutoId && !sRaw) return;

                weekStatus.set(normT, { tipo, sustitutoId: sRaw ? window.normalizeId(sRaw) : null, rawSust: sRaw, titularId: tId });
            });

            const puestoAssignments = new Map();
            sourceRows.forEach(r => {
                if (String(r.empleadoId || '').includes('---') || String(r.empleadoId || '').includes('___')) return;
                const normT = window.normalizeId(r.empleadoId);
                const status = weekStatus.get(normT);
                if (status) {
                    if (status.sustitutoId) puestoAssignments.set(normT, { occupantId: status.rawSust, isSustitucion: true });
                    else if (status.tipo !== 'REFUERZO') puestoAssignments.set(normT, { occupantId: 'VACANTE-' + normT, isVacante: true });
                    else puestoAssignments.set(normT, { occupantId: r.empleadoId });
                } else {
                    puestoAssignments.set(normT, { occupantId: r.empleadoId });
                }
            });

            sourceRows.forEach(r => {
                const normT = window.normalizeId(r.empleadoId);
                const assignment = puestoAssignments.get(normT);
                if (!assignment) return;

                const v9Order = window.getV9ExcelOrder(hotel, r.week_start || firstDate, r.empleadoId);
                
                const status = weekStatus.get(normT);
                if (status && status.tipo !== 'REFUERZO') {
                    const tProfile = employees.find(e => window.normalizeId(e.id) === normT || window.normalizeId(e.nombre) === normT);
                    absentRows.push({
                        ...r,
                        employee_id: r.empleadoId,
                        nombre: tProfile?.nombre || r.empleadoId,
                        isAbsentInformative: true,
                        puestoOrden: v9Order + 100000 
                    });
                }

                const occId = assignment.occupantId;
                const normOcc = window.normalizeId(occId);
                if (handledEmps.has(normOcc)) return;

                const occProfile = employees.find(e => window.normalizeId(e.id) === normOcc || window.normalizeId(e.nombre) === normOcc);
                operativeRows.push({
                    ...r,
                    employee_id: occId,
                    empleadoId: occId,
                    nombre: occProfile?.nombre || occId,
                    displayName: occProfile?.nombre || occId,
                    isVacante: assignment.isVacante,
                    isSustitucion: assignment.isSustitucion,
                    puestoOrden: v9Order,
                    titularOriginal: r.displayName || r.empleadoId
                });
                handledEmps.add(normOcc);
            });

            eventos.forEach(ev => {
                const isExplicitRef = Boolean(ev.isRefuerzo === true || ev.origen === 'refuerzo' || ev.payload?.tipo_modulo === 'refuerzo');
                if (!isExplicitRef) return;
                if (window.normalizeEstado(ev.estado) === 'anulado') return;
                if (window.eventoPerteneceAHotel && !window.eventoPerteneceAHotel(ev, hotel)) return;

                const fi = window.normalizeDate(ev.fecha_inicio);
                const ff = window.normalizeDate(ev.fecha_fin || ev.fecha_inicio);
                if (!dates.some(d => d >= fi && d <= ff)) return;

                const empId = ev.empleado_id;
                const normEmpId = window.normalizeId(empId);
                if (handledEmps.has(normEmpId)) return;

                const empProfile = employees.find(e => window.normalizeId(e.id) === normEmpId || window.normalizeId(e.nombre) === normEmpId);
                operativeRows.push({ hotel, employee_id: empId, nombre: empProfile?.nombre || empId, puestoOrden: 200000, isRefuerzo: true });
                handledEmps.add(normEmpId);
            });
        } 
        else {
            sourceRows.forEach(r => {
                if (String(r.empleadoId || '').includes('---') || String(r.empleadoId || '').includes('___')) return;
                const norm = cleanForId(r.empleadoId);
                if (handledEmps.has(norm)) return;
                
                let hasWork = false;
                for(const d of dates) {
                    const resolved = getTurnoEmpleadoExtended(r.empleadoId, d);
                    if (resolved && resolved.turno && resolved.turno !== 'D' && !resolved.incidencia) {
                        hasWork = true; break;
                    }
                }
                
                if (hasWork) {
                    const v9Order = window.getV9ExcelOrder(hotel, r.week_start || firstDate, r.empleadoId);
                    operativeRows.push({ ...r, employee_id: r.empleadoId, nombre: r.displayName || r.empleadoId, puestoOrden: v9Order });
                    handledEmps.add(norm);
                }
            });

            eventos.forEach(ev => {
                if (window.normalizeEstado(ev.estado) === 'anulado') return;
                if (window.eventoPerteneceAHotel && !window.eventoPerteneceAHotel(ev, hotel)) return;
                
                const fi = window.normalizeDate(ev.fecha_inicio);
                const ff = window.normalizeDate(ev.fecha_fin || ev.fecha_inicio);
                if (!dates.some(d => d >= fi && d <= ff)) return;

                const idsToCheck = [ev.empleado_id, ev.empleado_destino_id || ev.sustituto_id || ev.payload?.sustituto_id].filter(Boolean);
                
                idsToCheck.forEach(id => {
                    const norm = cleanForId(id);
                    if (handledEmps.has(norm)) return;

                    let hasWork = false;
                    for(const d of dates) {
                        const resolved = getTurnoEmpleadoExtended(id, d);
                        if (resolved && resolved.turno && resolved.turno !== 'D' && !resolved.incidencia) {
                            hasWork = true; break;
                        }
                    }

                    if (hasWork) {
                        const profile = employees.find(e => window.normalizeId(e.id) === norm || window.normalizeId(e.nombre) === norm);
                        const v9Order = window.getV9ExcelOrder(hotel, firstDate, id) || 150000;
                        operativeRows.push({ hotel, employee_id: id, nombre: profile?.nombre || id, puestoOrden: v9Order, isFromEvent: true });
                        handledEmps.add(norm);
                    }
                });
            });
        }

        let result = [...operativeRows, ...absentRows];
        
        result = result.filter(row => {
            const clean = window.formatDisplayName(row.nombre || row.displayName || '').trim();
            return clean !== "";
        });

        result.sort((a, b) => {
            if (a.puestoOrden !== b.puestoOrden) return a.puestoOrden - b.puestoOrden;
            return String(a.nombre || '').localeCompare(String(b.nombre || ''));
        });
        
        return result;
    };`;

content = content.substring(0, startIdx) + newGetEmployees + content.substring(endIdx);

fs.writeFileSync(filePath, content, 'utf8');
console.log("admin.js updated: Ghost rows removed and Monthly consolidation improved.");
