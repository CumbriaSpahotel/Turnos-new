const fs = require('fs');
const path = 'c:\\Users\\comun\\Documents\\GitHub\\Turnos-new\\admin.js';
let content = fs.readFileSync(path, 'utf8');

// 1. Add [CAMBIOS_PANEL_DEBUG load]
const targetExcel = `        const excelSource = await window.loadAdminExcelSourceRows();`;
const replacementExcel = `        const excelSource = await window.loadAdminExcelSourceRows();
        
        // [CAMBIOS_PANEL_DEBUG load]
        const approvedChanges = (eventos || []).filter(ev => {
            const t = window.normalizeTipo ? window.normalizeTipo(ev.tipo) : String(ev.tipo || '').toUpperCase();
            const s = (ev.estado || 'activo').toLowerCase();
            return (t === 'CAMBIO_TURNO' || t === 'INTERCAMBIO_TURNO') && (s === 'activo' || s === 'aprobado');
        });
        
        if (startISO === '2026-04-13') {
            console.log('[CAMBIOS_PANEL_DEBUG load]', {
                semana: "2026-04-13",
                hotel: hotelSel,
                totalCambiosAprobados: approvedChanges.length,
                cambios: approvedChanges
            });
        }`;

if (content.includes(targetExcel)) {
    content = content.replace(targetExcel, replacementExcel);
}

// 2. Fix synthetic rows
const targetSynth = `            if (hotelSourceRows.length === 0 && data && data.length > 0) {
                const hotelData = data.filter(r => r.hotel_id === hName);
                if (hotelData.length > 0) {
                    const empsInHotel = [...new Set(hotelData.map(r => r.empleado_id))];
                    empsInHotel.forEach((empId, idx) => {
                        const empProfile = (profiles || []).find(p => p.id === empId || p.nombre === empId);
                        const row = {
                            empleadoId: empId,
                            displayName: empProfile?.nombre || empId,
                            rowIndex: empProfile?.orden ?? empProfile?.display_order ?? empProfile?.sort_order ?? 999,
                            weekStart: startISO,
                            values: columns.map(c => {
                                const found = hotelData.find(r => r.empleado_id === empId && r.fecha === c.date);
                                return found ? found.turno : null;
                            })
                        };
                        hotelSourceRows.push(row);
                    });
                }
            }`;

const replacementSynth = `            if (hotelSourceRows.length === 0 && data && data.length > 0) {
                const hotelData = data.filter(r => r.hotel_id === hName && r.empleado_id);
                if (hotelData.length > 0) {
                    const empsInHotel = [...new Set(hotelData.map(r => r.empleado_id).filter(Boolean))];
                    empsInHotel.forEach((empId, idx) => {
                        const empProfile = (profiles || []).find(p => p.id === empId || p.nombre === empId);
                        const row = {
                            empleadoId: empId,
                            displayName: empProfile?.nombre || empId,
                            rowIndex: empProfile?.orden ?? empProfile?.display_order ?? empProfile?.sort_order ?? 999,
                            weekStart: startISO,
                            values: columns.map(c => {
                                const found = hotelData.find(r => r.empleado_id === empId && r.fecha === c.date);
                                return found ? found.turno : null;
                            })
                        };
                        if (row.empleadoId && row.displayName) {
                            hotelSourceRows.push(row);
                        }
                    });
                }
            }`;

if (content.includes(targetSynth)) {
    content = content.replace(targetSynth, replacementSynth);
}

// 3. Fix vacation icon in renderEmpleadoRowHeader
const targetVac = `    const vacIcon = showVacationIcon && employee?.isOnVacationVisibleRange ? ' 🏖️' : '';`;
const replacementVac = `    const vacIcon = showVacationIcon && employee?.isOnVacationVisibleRange ? ' \\u{1F3D6}\\u{FE0F}' : '';`;

if (content.includes(targetVac)) {
    content = content.replace(targetVac, replacementVac);
}

fs.writeFileSync(path, content, 'utf8');
console.log('Admin.js debug logs, synthetic rows and vacation icons fixed');
