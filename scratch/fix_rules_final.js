const fs = require('fs');
const path = 'c:\\Users\\comun\\OneDrive\\Documentos\\GitHub\\Turnos-new\\turnos-rules.js';
let content = fs.readFileSync(path, 'utf8');

// FIX 1: isPublicEmployeeVisible - Prioritize Próximamente and fix ¿? blocking
const visStart = 'const isPublicEmployeeVisible = (employee) => {';
const visEnd = 'const shouldShowNightRestControls';

const visReplacement = `    const isPublicEmployeeVisible = (employee) => {
        if (!employee) return false;
        
        const name = String(employee.nombre || employee.nombreVisible || employee.name || employee.empleado || '').trim().toLowerCase();
        const id = String(employee.empleado_id || employee.id || '').trim().toLowerCase();
        const type = String(employee.tipo || employee.tipo_personal || employee.tipoPersonal || '').trim().toLowerCase();

        // 1. REGLA MAESTRA: Determinar si tiene turnos operativos reales
        const daysMap = employee.turnosOperativos || employee.cells || employee.dias || {};
        const turns = Object.values(daysMap);
        const hasOperationalTurns = turns.some(t => {
            const code = String(t.code || t.turno || t.turnoFinal || '').toUpperCase();
            return code && code !== '—' && code !== '' && code !== 'SIN_TURNO';
        });

        // 2. REGLA OBLIGATORIA: Próximamente es visible si es operativo (incluso con ID ¿?)
        const isProximamente = name.includes('proximamente') || name.includes('próximamente');
        if (isProximamente && hasOperationalTurns) {
            if (window.DEBUG_MODE) console.log('[PUBLIC_ROW_FILTER] Permitiendo Próximamente operativo', { name, id });
            return true;
        }

        // 3. Bloqueos de placeholders técnicos puros
        if (name === 'vacante' || name.includes('vacante') || id === 'vacante') return false;
        if ((name === '¿?' || id === '¿?') && !isProximamente) return false;

        // 4. Si es un sustituto operativo con turnos reales, es visible
        const isOperationalSub = !!(
            employee.esSustituto || 
            employee.sustitucion || 
            employee.sustituyeA || 
            employee.titular_cubierto ||
            employee.operativo === true ||
            (employee.rowType && (employee.rowType.includes('operativo') || employee.rowType.includes('sustitucion')))
        );
        if (isOperationalSub && hasOperationalTurns) {
            if (window.DEBUG_MODE) console.log('[PUBLIC_ROW_FILTER] Permitiendo sustituto operativo', { name, id });
            return true;
        }

        // 5. Filtros restrictivos para otros placeholders
        const blockedPatterns = ['sin asignar', 'sinasignar', 'placeholder', 'técnica', 'tecnica', 'control'];
        const matchesBlocked = blockedPatterns.some(p => name.includes(p) || id.includes(p));
        if (matchesBlocked && !hasOperationalTurns) return false;

        // 6. Respetar flags explícitos
        if (employee.internalOnly === true && !hasOperationalTurns) return false;
        if (employee.publicVisible === false && !hasOperationalTurns) return false;

        // Caso por defecto: se muestra
        return true;
    };
`;

// Aplicar Fix 1
const startIdx1 = content.indexOf(visStart);
const endIdx1 = content.indexOf(visEnd);
if (startIdx1 !== -1 && endIdx1 !== -1) {
    content = content.slice(0, startIdx1) + visReplacement + content.slice(endIdx1);
    console.log('Fixed isPublicEmployeeVisible');
}

// FIX 2: shouldShowNightRestControls - Full Week rule and requested logs
const ctrlReplacement = `    const shouldShowNightRestControls = (employee, context) => {
        if (!employee) return false;
        
        // REGLA MAESTRA: Admin Preview NUNCA muestra controles
        if (context?.view === 'admin-preview' || context?.view === 'admin') return false;

        const name = String(employee.nombre || employee.nombreVisible || employee.name || employee.empleado || '').trim().toLowerCase();
        const type = String(employee.tipo || employee.tipo_personal || employee.tipoPersonal || '').trim().toLowerCase();
        const role = String(employee.rol || employee.rol_operativo || '').trim().toLowerCase();
        const puesto = String(employee.puesto || employee.categoria || '').trim().toLowerCase();

        const logVisibility = (show, reason) => {
            if (window.DEBUG_MODE || context?.view === 'index') {
                console.log('[NIGHT_REST_CONTROL_VISIBILITY]', {
                    view: context?.view || 'unknown',
                    hotel: context?.hotel || 'unknown',
                    weekStart: context?.weekStart || 'unknown',
                    empleado: name,
                    tipo: type,
                    rol: role,
                    puesto: puesto,
                    showControls: show,
                    reason: reason
                });
            }
        };

        // 1. Exclusiones permanentes (Apoyo, Ocasional, Dirección, VACANTE)
        if (name.includes('vacante') || name === '¿?' || name.includes('sin asignar')) {
            logVisibility(false, 'excluded_placeholder');
            return false;
        }
        if (type.includes('apoyo') || type.includes('ocasional')) {
            logVisibility(false, 'excluded_tipo_apoyo_ocasional');
            return false;
        }
        const excludedRoles = ['direccion', 'jefatura', 'gerencia', 'mantenimiento_externo', 'limpieza_externa'];
        if (excludedRoles.some(r => role.includes(r) || puesto.includes(r))) {
            logVisibility(false, 'excluded_rol_puesto_direccion_jefatura');
            return false;
        }

        // 2. DETECCIÓN DINÁMICA DE AUSENCIAS (FULL WEEK RULE)
        const daysMap = employee.turnosOperativos || employee.cells || employee.dias || {};
        const turns = Object.values(daysMap);
        const dayCount = turns.length;
        
        const hasOperationalTurns = turns.some(t => {
            const code = String(t.code || t.turno || t.turnoFinal || '').toUpperCase();
            return code && code !== '—' && code !== '' && code !== 'SIN_TURNO' && code !== 'VAC' && !code.includes('BAJA') && !code.includes('PERM');
        });

        // Vacaciones toda la semana
        const isAllVacation = dayCount >= 7 && turns.every(t => {
            const c = String(t.code || t.turno || t.turnoFinal || t.label || '').toUpperCase();
            return c === 'VAC' || c.includes('VACACIONES');
        });
        if (isAllVacation) {
            logVisibility(false, 'excluded_vacaciones_total_week');
            return false;
        }

        // Baja toda la semana
        const isAllBaja = dayCount >= 7 && turns.every(t => {
            const c = String(t.code || t.turno || t.turnoFinal || t.label || '').toUpperCase();
            return c === 'BAJA' || c.includes('BAJA') || c === 'IT' || c === 'BM';
        });
        if (isAllBaja) {
            logVisibility(false, 'excluded_baja_total_week');
            return false;
        }

        // Permiso toda la semana
        const isAllPermiso = dayCount >= 7 && turns.every(t => {
            const c = String(t.code || t.turno || t.turnoFinal || t.label || '').toUpperCase();
            return c === 'PERM' || c.includes('PERMISO');
        });
        if (isAllPermiso) {
            logVisibility(false, 'excluded_permiso_total_week');
            return false;
        }

        // 3. REGLA DE BAJA PARCIAL: Si tiene turnos operativos y no es ausencia TOTAL, muestra controles
        if (hasOperationalTurns) {
            logVisibility(true, 'ordinary_employee_with_partial_absence');
            return true;
        }

        // Fallback final
        logVisibility(false, 'no_operational_turns_or_total_absence');
        return false;
    };
`;

// Aplicar Fix 2
const ctrlStart = 'const shouldShowNightRestControls = (employee, context) => {';
const ctrlEnd = 'const shouldShowPinSustitucion'; // Usamos el siguiente para delimitar si el marker }; falla

const startIdx2 = content.indexOf(ctrlStart);
const endIdx2 = content.indexOf('};', startIdx2) + 2;
if (startIdx2 !== -1 && endIdx2 !== -1) {
    content = content.slice(0, startIdx2) + ctrlReplacement + content.slice(endIdx2);
    console.log('Fixed shouldShowNightRestControls');
}

fs.writeFileSync(path, content, 'utf8');
console.log('turnos-rules.js fixed successfully');
