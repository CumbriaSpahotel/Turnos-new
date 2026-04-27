
const fs = require('fs');

const filePath = 'admin.js';
let content = fs.readFileSync(filePath, 'utf8');

// 1. ADD getV9ExcelOrder helper and loading logic
const v9Helper = `
window._v9OrderMap = null;
window.getV9ExcelOrder = (hotel, weekStart, empId) => {
    if (!window._v9OrderMap) {
        // En un entorno real, esto se cargaría asíncronamente. 
        // Para Vista Previa, asumimos que se carga o usamos un proxy síncrono si ya está en memoria.
        // Como no podemos hacer fetch síncrono fácilmente, buscamos si ya se inyectó.
        if (window._v9MapData) {
            window._v9OrderMap = new Map();
            window._v9MapData.forEach(item => {
                const key = \`\${item.hotel}|\${item.week_start}|\${window.normalizeId(item.empleado_id)}\`;
                window._v9OrderMap.set(key, item.order);
            });
        }
    }
    
    const normId = window.normalizeId(empId);
    const key = \`\${hotel}|\${weekStart}|\${normId}\`;
    const order = window._v9OrderMap ? window._v9OrderMap.get(key) : null;
    
    if (order !== null && order !== undefined) return order;
    
    // Fallback: buscar por nombre si el ID no coincide exactamente
    if (window._v9OrderMap) {
        for (let [k, v] of window._v9OrderMap.entries()) {
            if (k.startsWith(\`\${hotel}|\${weekStart}|\`)) {
                const parts = k.split('|');
                if (parts[2].includes(normId) || normId.includes(parts[2])) return v;
            }
        }
    }
    
    return 999999; 
};

// Cargar el mapa al inicio si no está
(async () => {
    try {
        const res = await fetch('data/v9_excel_order_map.json');
        window._v9MapData = await res.json();
    } catch(e) { console.warn("No se pudo cargar el mapa V9", e); }
})();
`;

// Insert v9Helper before switchSection or similar
if (!content.includes('window.getV9ExcelOrder')) {
    content = v9Helper + content;
}

// 2. UPDATE renderEmpleadoRowHeader (Clean UI, no IDs, no "Sustituye a")
const oldHeaderStart = 'window.renderEmpleadoRowHeader = (employee, { showVacationIcon = false } = {}) => {';
const newHeader = `window.renderEmpleadoRowHeader = (employee, { showVacationIcon = false } = {}) => {
    // VISTA PREVIA: LIMPIEZA ABSOLUTA
    // No mostrar IDs [EMP-XXXX], no mostrar "Sustituye a", no mostrar badges de sustitución
    
    if (employee?.isVacante) {
        return \`
        <div style="display:flex; flex-direction:column; gap:2px;">
            <span style="font-weight:800; color:#ef4444; font-size:0.82rem; line-height:1.3;">⚠️ VACANTE</span>
            <span style="color:#64748b; font-size:0.6rem; font-weight:500;">Sin cubrir (\${escapeHtml(employee.titularOriginal)})</span>
        </div>\`;
    }

    const name = escapeHtml(employee?.nombre || employee?.displayName || 'Empleado');
    const vacIcon = showVacationIcon && employee?.isOnVacationVisibleRange ? ' 🏖️' : '';
    
    // Refuerzo solo si es explícito
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

const headerStartIdx = content.indexOf(oldHeaderStart);
if (headerStartIdx !== -1) {
    let headerEndIdx = content.indexOf('};', headerStartIdx) + 2;
    content = content.substring(0, headerStartIdx) + newHeader + content.substring(headerEndIdx);
}

// 3. UPDATE getEmployees (Excel order as Absolute Truth)
const getEmpsStart = '    const getEmployees = () => {';
const getEmpsEnd = 'return result;'; // Based on my previous turn's output
const getEmpsStartIdx = content.indexOf(getEmpsStart);

const newGetEmployees = `    const getEmployees = () => {
        const firstDate = dates[0] || '';
        const finalRows = [];
        const handledEmps = new Set();
        
        // 1. Identificar estados semanales (ausencias y sustituciones)
        const weekStatus = new Map();
        eventos.forEach(ev => {
            const tipo = window.normalizeTipo(ev.tipo);
            if (!['VAC', 'BAJA', 'PERM', 'PERMISO', 'FORMACION', 'REFUERZO'].includes(tipo)) return;
            if (window.normalizeEstado(ev.estado) === 'anulado') return;
            if (window.eventoPerteneceAHotel && !window.eventoPerteneceAHotel(ev, hotel)) return;

            const fi = window.normalizeDate(ev.fecha_inicio);
            const ff = window.normalizeDate(ev.fecha_fin || ev.fecha_inicio);
            if (!dates.some(d => d >= fi && d <= ff)) return;

            const titularId = ev.empleado_id;
            if (!titularId) return;
            const normTitular = window.normalizeId(titularId);
            const sustitutoRaw = ev.empleado_destino_id || ev.sustituto_id || ev.sustituto || ev.payload?.sustituto_id || ev.payload?.sustituto;
            
            const existing = weekStatus.get(normTitular);
            if (existing && existing.sustitutoId && !sustitutoRaw) return;

            weekStatus.set(normTitular, { tipo, sustitutoId: sustitutoRaw ? window.normalizeId(sustitutoRaw) : null, rawSust: sustitutoRaw, titularId });
        });

        // 2. FASE A: Construir según Puestos de Excel (Orden Map V9)
        sourceRows.forEach(r => {
            const normTitular = window.normalizeId(r.empleadoId);
            const status = weekStatus.get(normTitular);
            const v9Order = window.getV9ExcelOrder(hotel, firstDate, r.empleadoId);
            
            let empIdToUse = r.empleadoId;
            let displayName = r.displayName || r.empleadoId;
            let isSustitucion = false;
            let isVacante = false;

            if (status) {
                if (status.sustitutoId) {
                    // El sustituto ocupa la posición operativa del titular
                    empIdToUse = status.rawSust;
                    const sustProfile = employees.find(e => window.normalizeId(e.id) === status.sustitutoId || window.normalizeId(e.nombre) === status.sustitutoId);
                    displayName = sustProfile?.nombre || status.rawSust;
                    isSustitucion = true;
                    
                    // Si queremos mostrar al titular ausente TAMBIÉN (para que no desaparezca), lo añadimos
                    // El usuario dice: "Si el titular sigue mostrándose... debe seguir en la posición que marque el Excel"
                    const titularProfile = employees.find(e => window.normalizeId(e.id) === normTitular || window.normalizeId(e.nombre) === normTitular);
                    finalRows.push({
                        ...r,
                        employee_id: r.empleadoId,
                        nombre: titularProfile?.nombre || r.empleadoId,
                        puestoOrden: v9Order,
                        _v9Order: v9Order,
                        _isInformative: true
                    });
                } else if (status.tipo !== 'REFUERZO') {
                    isVacante = true;
                    // Muestra al titular con su incidencia o como vacante
                }
            }

            const normEmpId = window.normalizeId(empIdToUse);
            if (handledEmps.has(normEmpId)) return;

            finalRows.push({
                ...r,
                employee_id: empIdToUse,
                nombre: displayName,
                puestoOrden: v9Order,
                _v9Order: v9Order,
                isSustitucion,
                isVacante,
                titularOriginal: r.displayName || r.empleadoId
            });
            handledEmps.add(normEmpId);
        });

        // 3. FASE B: Refuerzos extra (al final si no cubren a nadie)
        eventos.forEach(ev => {
            const tipo = window.normalizeTipo(ev.tipo);
            if (tipo !== 'REFUERZO' && !ev.isRefuerzo) return;
            if (window.normalizeEstado(ev.estado) === 'anulado') return;

            const fi = window.normalizeDate(ev.fecha_inicio);
            const ff = window.normalizeDate(ev.fecha_fin || ev.fecha_inicio);
            if (!dates.some(d => d >= fi && d <= ff)) return;

            const empId = ev.empleado_id;
            const normEmpId = window.normalizeId(empId);
            if (handledEmps.has(normEmpId)) return;

            const empProfile = employees.find(e => window.normalizeId(e.id) === normEmpId || window.normalizeId(e.nombre) === normEmpId);
            
            finalRows.push({
                hotel,
                employee_id: empId,
                nombre: empProfile?.nombre || empId,
                puestoOrden: 999999, // Al final
                _v9Order: 999999,
                isRefuerzo: true
            });
            handledEmps.add(normEmpId);
        });

        // 4. ORDEN FINAL ABSOLUTO POR V9 MAP
        finalRows.sort((a, b) => {
            if (a._v9Order !== b._v9Order) return a._v9Order - b._v9Order;
            // Si tienen el mismo orden (Titular y su Sustituto), el operativo primero
            const pA = a._isInformative ? 1 : 0;
            const pB = b._isInformative ? 1 : 0;
            if (pA !== pB) return pA - pB;
            return String(a.nombre || '').localeCompare(String(b.nombre || ''));
        });
        
        return finalRows;
    };`;

if (getEmpsStartIdx !== -1) {
    let getEmpsEndIdx = content.indexOf('};', content.indexOf('return ', getEmpsStartIdx)) + 2;
    content = content.substring(0, getEmpsStartIdx) + newGetEmployees + content.substring(getEmpsEndIdx);
}

fs.writeFileSync(filePath, content, 'utf8');
console.log("admin.js updated: Excel V.9 order enforced for Vista Previa.");
