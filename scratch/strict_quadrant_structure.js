
const fs = require('fs');

const filePath = 'admin.js';
let content = fs.readFileSync(filePath, 'utf8');

// 1. UPDATE getEmployees to be strictly Base + Explicit Reinforcements
const getEmpsStartMarker = '    const getEmployees = () => {';
const getEmpsStartIndex = content.indexOf(getEmpsStartMarker);
const getEmpsEndIndex = content.indexOf('};', content.indexOf('return ', getEmpsStartIndex)) + 2;

const newGetEmployees = `    const getEmployees = () => {
        const firstDate = dates[0] || '';
        const finalRows = [];
        const handledEmps = new Set();
        
        // 1. Identificar Refuerzos Explícitos
        // Solo se añaden si tienen flags explícitos de "Añadir Refuerzo"
        const explicitRefuerzos = [];
        eventos.forEach(ev => {
            const tipo = window.normalizeTipo(ev.tipo);
            const isExplicitRef = Boolean(
                ev.isRefuerzo === true || 
                ev.origen === 'refuerzo' || 
                ev.payload?.tipo_modulo === 'refuerzo' || 
                ev.payload?.creado_desde === 'admin_refuerzo' || 
                ev.meta?.refuerzo === true
            );
            
            if (!isExplicitRef) return;
            if (window.normalizeEstado(ev.estado) === 'anulado') return;

            const fi = window.normalizeDate(ev.fecha_inicio);
            const ff = window.normalizeDate(ev.fecha_fin || ev.fecha_inicio);
            if (!dates.some(d => d >= fi && d <= ff)) return;

            const empId = ev.empleado_id;
            const normEmpId = window.normalizeId(empId);
            
            // Si ya está en el set, no duplicar el refuerzo
            if (handledEmps.has(normEmpId)) return;

            // Verificar si este empleado YA existe en sourceRows (Base Excel)
            const existsInBase = sourceRows.some(r => window.normalizeId(r.empleadoId) === normEmpId);
            if (existsInBase) return;

            const empProfile = employees.find(e => window.normalizeId(e.id) === normEmpId || window.normalizeId(e.nombre) === normEmpId);
            
            explicitRefuerzos.push({
                hotel,
                employee_id: empId,
                empleadoId: empId,
                nombre: empProfile?.nombre || empId,
                displayName: empProfile?.nombre || empId,
                puestoOrden: 999999,
                _v9Order: 999999,
                isRefuerzo: true
            });
            handledEmps.add(normEmpId);
        });

        // 2. Construir Bloque Base desde Excel
        sourceRows.forEach(r => {
            const normTitular = window.normalizeId(r.empleadoId);
            const v9Order = window.getV9ExcelOrder(hotel, firstDate, r.empleadoId);
            
            // REGLA: El titular base SIEMPRE genera su propia fila en su posición
            finalRows.push({
                ...r,
                employee_id: r.empleadoId,
                nombre: r.displayName || r.empleadoId,
                puestoOrden: v9Order,
                _v9Order: v9Order,
                isBaseExcel: true,
                titularOriginal: r.displayName || r.empleadoId
            });
            handledEmps.add(normTitular);
        });

        // 3. CONSOLIDACIÓN FINAL
        // Orden: Base Excel (según mapa) -> Refuerzos Explícitos
        const result = [...finalRows, ...explicitRefuerzos];
        
        result.sort((a, b) => {
            if (a._v9Order !== b._v9Order) return a._v9Order - b._v9Order;
            return String(a.nombre || '').localeCompare(String(b.nombre || ''));
        });
        
        return result;
    };`;

if (getEmpsStartIndex !== -1) {
    content = content.substring(0, getEmpsStartIndex) + newGetEmployees + content.substring(getEmpsEndIndex);
}

// 2. Ensure renderEmpleadoRowHeader stays clean
// (Already done in previous turn, but ensuring consistency)

fs.writeFileSync(filePath, content, 'utf8');
console.log("admin.js updated: Strictly Base Rows + Explicit Reinforcements.");
