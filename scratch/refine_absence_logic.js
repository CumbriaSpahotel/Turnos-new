const fs = require('fs');
const path = 'c:\\Users\\comun\\OneDrive\\Documentos\\GitHub\\Turnos-new\\turnos-rules.js';
let content = fs.readFileSync(path, 'utf8');

const replacement = `        // 4. DETECCIÓN DINÁMICA DE AUSENCIAS EN EL RANGO VISIBLE
        const daysMap = employee.turnosOperativos || employee.cells || employee.dias || {};
        const turns = Object.values(daysMap);
        const dayCount = turns.length;
        
        // REGLA V12.8: Solo ocultar si la ausencia es TOTAL (toda la semana)
        const isAllVacation = dayCount >= 7 && turns.every(t => {
            const c = String(t.code || t.turno || t.turnoFinal || t.label || '').toUpperCase();
            return c === 'VAC' || c.includes('VACACIONES') || (t.type && String(t.type).startsWith('VAC'));
        });
        if (isAllVacation) {
            logVisibility(false, 'excluded_vacaciones_total_week');
            return false;
        }

        const isAllBaja = dayCount >= 7 && turns.every(t => {
            const c = String(t.code || t.turno || t.turnoFinal || t.label || '').toUpperCase();
            return c === 'BAJA' || c.includes('BAJA') || c === 'IT' || c === 'BM' || (t.type && String(t.type).startsWith('BAJA'));
        });
        if (isAllBaja) {
            logVisibility(false, 'excluded_baja_total_week');
            return false;
        }

        const isAllPermiso = dayCount >= 7 && turns.every(t => {
            const c = String(t.code || t.turno || t.turnoFinal || t.label || '').toUpperCase();
            return c === 'PERM' || c.includes('PERMISO') || (t.type && String(t.type).startsWith('PERM'));
        });
        if (isAllPermiso) {
            logVisibility(false, 'excluded_permiso_total_week');
            return false;
        }

        // Si hay ausencias parciales, el log indicará que se mantiene el contador
        const hasAnyAbsence = turns.some(t => {
            const c = String(t.code || t.turno || t.turnoFinal || t.label || '').toUpperCase();
            return c === 'VAC' || c.includes('VACACIONES') || c === 'BAJA' || c.includes('BAJA') || c === 'IT' || c === 'BM' || c === 'PERM' || c.includes('PERMISO');
        });
        if (hasAnyAbsence && window.DEBUG_MODE) {
            console.log('[NIGHT_REST_CONTROL_VISIBILITY] Ausencia parcial detectada, manteniendo contador', { name });
        }
`;

const startMarker = '// 4. DETECCIÓN DINÁMICA DE AUSENCIAS EN EL RANGO VISIBLE';
const endMarker = '// 5. REGLA ESTRICTA';

const startIdx = content.indexOf(startMarker);
const endIdx = content.indexOf(endMarker);

if (startIdx !== -1 && endIdx !== -1) {
    content = content.slice(0, startIdx) + replacement + content.slice(endIdx);
    fs.writeFileSync(path, content, 'utf8');
    console.log('Refined absence logic in turnos-rules.js');
} else {
    console.log('Markers not found in turnos-rules.js');
}
