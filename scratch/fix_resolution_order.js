
const fs = require('fs');

const filePath = 'admin.js';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Update renderEmpleadoRowHeader (cleaner, no badges for absents)
const headerStartIdx = content.indexOf('window.renderEmpleadoRowHeader =');
let headerEndIdx = content.indexOf('};', headerStartIdx) + 2;

const newHeader = `window.renderEmpleadoRowHeader = (employee, { showVacationIcon = false } = {}) => {
    // VISTA PREVIA: NO MOSTRAR ID INTERNO [EMP-XXXX] O UUIDs
    if (employee?.isVacante) {
        return \`
        <div style="display:flex; flex-direction:column; gap:2px;">
            <span style="font-weight:800; color:#ef4444; font-size:0.82rem; line-height:1.3;">⚠️ VACANTE</span>
            <span style="color:#64748b; font-size:0.6rem; font-weight:500;">Sin cubrir (\${escapeHtml(employee.titularOriginal)})</span>
        </div>\`;
    }

    const name = escapeHtml(employee?.nombre || employee?.displayName || 'Empleado');
    const vacIcon = showVacationIcon && employee?.isOnVacationVisibleRange ? ' 🏖️' : '';
    
    // helper isExplicitRefuerzo
    const isExplicitRefuerzo = Boolean(
        employee?.isRefuerzo === true ||
        employee?.origen === 'refuerzo' ||
        employee?.payload?.tipo_modulo === 'refuerzo' ||
        employee?.payload?.creado_desde === 'admin_refuerzo' ||
        employee?.meta?.refuerzo === true
    );
    const supportBadge = isExplicitRefuerzo ? \`<span style="display:inline-block;padding:2px 7px;border-radius:6px;background:#dbeafe;color:#2563eb;font-size:0.55rem;font-weight:700;margin-left:6px;">REFUERZO</span>\` : '';

    return \`
    <div style="display:flex; flex-direction:column; gap:2px;">
        <span style="font-weight:700; color:#0f172a; font-size:0.82rem; line-height:1.3;">\${name}\${vacIcon}\${supportBadge}</span>
    </div>\`;
};`;

if (headerStartIdx !== -1) {
    content = content.substring(0, headerStartIdx) + newHeader + content.substring(headerEndIdx);
}

// 2. Update getEmployees (Dynamic order, no priority 99999)
const startMarker = '    const getEmployees = () => {';
const startIndex = content.indexOf(startMarker);
let endIndex = content.indexOf('return combined;', startIndex);
if (endIndex === -1) endIndex = content.indexOf('return operativeRows;', startIndex);
endIndex = content.indexOf('};', endIndex) + 2;

const newGetEmployees = `    const getEmployees = () => {
        const firstDate = dates[0] || '';
        const handledEmpsOperative = new Set();
        const handledEmpsInformative = new Set();
        
        // Estructuras para construir el bloque final
        const operativeSlots = []; // Posiciones originales del Excel
        const deferredAbsents = []; // Titulares que no trabajan esa semana
        const extraRefuerzos = [];  // Refuerzos que no ocupan plaza de titular

        // 1. Identificar estados semanales (ausencias y sustituciones)
        const weekStatus = new Map();
        eventos.forEach(ev => {
            const tipo = window.normalizeTipo(ev.tipo);
            if (!['VAC', 'BAJA', 'PERM', 'PERMISO', 'FORMACION', 'REFUERZO'].includes(tipo)) return;
            if (window.normalizeEstado(ev.estado) === 'anulado') return;
            if (window.eventoPerteneceAHotel && !window.eventoPerteneceAHotel(ev, hotel)) return;

            const fi = window.normalizeDate(ev.fecha_inicio);
            const ff = window.normalizeDate(ev.fecha_fin || ev.fecha_inicio);
            const overlaps = dates.some(d => d >= fi && d <= ff);
            if (!overlaps) return;

            const titularId = ev.empleado_id;
            if (!titularId) return;
            const normTitular = window.normalizeId(titularId);
            const sustitutoRaw = ev.empleado_destino_id || ev.sustituto_id || ev.sustituto || ev.payload?.sustituto_id || ev.payload?.sustituto;
            
            const existing = weekStatus.get(normTitular);
            if (existing && existing.sustitutoId && !sustitutoRaw) return;

            weekStatus.set(normTitular, {
                tipo,
                sustitutoId: sustitutoRaw ? window.normalizeId(sustitutoRaw) : null,
                rawSust: sustitutoRaw,
                titularId
            });
        });

        // 2. FASE A: Construir según Puestos de Excel
        sourceRows.forEach(r => {
            const normTitular = window.normalizeId(r.empleadoId);
            const status = weekStatus.get(normTitular);
            
            let empIdToUse = r.empleadoId;
            let displayName = r.displayName || r.empleadoId;
            let isSustitucion = false;
            let isVacante = false;
            let titularName = r.displayName || r.empleadoId;

            if (status) {
                if (status.sustitutoId) {
                    // Sustitución activa
                    empIdToUse = status.rawSust;
                    const sustProfile = employees.find(e => window.normalizeId(e.id) === status.sustitutoId || window.normalizeId(e.nombre) === status.sustitutoId);
                    displayName = sustProfile?.nombre || status.rawSust;
                    isSustitucion = true;
                    
                    // Titular original pasa a diferidos
                    if (!handledEmpsInformative.has(normTitular)) {
                        const tProfile = employees.find(e => window.normalizeId(e.id) === normTitular || window.normalizeId(e.nombre) === normTitular);
                        deferredAbsents.push({
                            ...r,
                            employee_id: r.empleadoId,
                            empleadoId: r.empleadoId,
                            nombre: tProfile?.nombre || r.empleadoId,
                            displayName: tProfile?.nombre || r.empleadoId,
                            isAbsentInformative: true,
                            _sortPriority: 1 // Los ausentes después de los operativos
                        });
                        handledEmpsInformative.add(normTitular);
                    }
                } else if (status.tipo !== 'REFUERZO') {
                    // Ausencia sin cubrir -> Vacante
                    isVacante = true;
                    empIdToUse = 'VACANTE-' + normTitular;
                    
                    if (!handledEmpsInformative.has(normTitular)) {
                        const tProfile = employees.find(e => window.normalizeId(e.id) === normTitular || window.normalizeId(e.nombre) === normTitular);
                        deferredAbsents.push({
                            ...r,
                            employee_id: r.empleadoId,
                            empleadoId: r.empleadoId,
                            nombre: tProfile?.nombre || r.empleadoId,
                            displayName: tProfile?.nombre || r.empleadoId,
                            isAbsentInformative: true,
                            _sortPriority: 1
                        });
                        handledEmpsInformative.add(normTitular);
                    }
                }
            }

            const normEmpId = window.normalizeId(empIdToUse);
            if (handledEmpsOperative.has(normEmpId)) return;

            operativeSlots.push({
                ...r,
                employee_id: empIdToUse,
                empleadoId: empIdToUse,
                nombre: displayName,
                displayName: displayName,
                puestoOrden: r.rowIndex, 
                isSustitucion,
                isVacante,
                titularOriginal: titularName,
                _sortPriority: 0 // Operativos primero
            });
            handledEmpsOperative.add(normEmpId);
        });

        // 3. FASE B: Refuerzos extra
        eventos.forEach(ev => {
            const tipo = window.normalizeTipo(ev.tipo);
            const isRef = Boolean(ev.isRefuerzo === true || ev.origen === 'refuerzo' || tipo === 'REFUERZO');
            if (!isRef) return;
            if (window.normalizeEstado(ev.estado) === 'anulado') return;

            const fi = window.normalizeDate(ev.fecha_inicio);
            const ff = window.normalizeDate(ev.fecha_fin || ev.fecha_inicio);
            if (!dates.some(d => d >= fi && d <= ff)) return;

            const empId = ev.empleado_id;
            const normEmpId = window.normalizeId(empId);
            if (handledEmpsOperative.has(normEmpId)) return;

            const empProfile = employees.find(e => window.normalizeId(e.id) === normEmpId || window.normalizeId(e.nombre) === normEmpId);
            
            extraRefuerzos.push({
                hotel,
                employee_id: empId,
                nombre: empProfile?.nombre || empId,
                displayName: empProfile?.nombre || empId,
                puestoOrden: 9999, // Fallback al final de operativos
                isRefuerzo: true,
                _sortPriority: 2 // Refuerzos al final de todo
            });
            handledEmpsOperative.add(normEmpId);
        });

        // 4. CONSOLIDACIÓN FINAL (Orden Resuelto)
        // La secuencia deseada es: Operativos (en orden Excel) -> Ausentes -> Refuerzos
        const result = [...operativeSlots, ...deferredAbsents, ...extraRefuerzos];
        
        // Sorting dinámico basado en bloques lógicos, no en prioridades fijas arbitrarias
        result.sort((a, b) => {
            if (a._sortPriority !== b._sortPriority) return a._sortPriority - b._sortPriority;
            if (a.puestoOrden !== b.puestoOrden) return a.puestoOrden - b.puestoOrden;
            return String(a.nombre || '').localeCompare(String(b.nombre || ''));
        });
        
        return result;
    };`;

if (startIndex !== -1) {
    content = content.substring(0, startIndex) + newGetEmployees + content.substring(endIndex);
}

fs.writeFileSync(filePath, content, 'utf8');
console.log("admin.js corrected: respect resolution order, removed fixed 99999 priority.");
