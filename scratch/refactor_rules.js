const fs = require('fs');
const path = 'c:\\Users\\comun\\OneDrive\\Documentos\\GitHub\\Turnos-new\\turnos-rules.js';
let content = fs.readFileSync(path, 'utf8');

// 1. Mejora de isPublicEmployeeVisible para ser más robusto con Próximamente
const visTarget = `        // 3. REGLA OBLIGATORIA: Próximamente es visible si es operativo
        const isProximamente = name.includes('proximamente') || name.includes('próximamente');
        if (isProximamente) return true;`;

const visReplacement = `        // 3. REGLA OBLIGATORIA: Próximamente es visible si es operativo
        const isProximamente = name.includes('proximamente') || name.includes('próximamente');
        if (isProximamente && hasOperationalTurns) {
            if (window.DEBUG_MODE) console.log('[PUBLIC_ROW_FILTER] Permitiendo Próximamente operativo', { name, id });
            return true;
        }

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
`;

// 2. Refactor completo de shouldShowNightRestControls para ser ESTRICTO
const controlsTarget = `    const shouldShowNightRestControls = (employee, context) => {
        if (!employee) return false;
        if (context?.view === 'admin-preview') return false;

        const name = String(employee.nombre || employee.nombreVisible || employee.name || '').toLowerCase();
        
        // REGLA OBLIGATORIA: Ausencias en el rango visible excluyen control
        const hasVacation = !!employee?.hasVacationInVisibleRange;
        const hasBaja = !!employee?.hasBajaInVisibleRange;
        const hasPermiso = !!employee?.hasPermisoInVisibleRange;

        if (hasVacation || hasBaja || hasPermiso) return false;

        // Caso por defecto: se muestra para empleados ordinarios
        return true;
    };`;

const controlsReplacement = `    const shouldShowNightRestControls = (employee, context) => {
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

        // 1. Exclusiones por Nombre/ID (Placeholders)
        if (name === 'vacante' || name.includes('vacante') || name === '¿?' || name.includes('sin asignar')) {
            logVisibility(false, 'excluded_placeholder');
            return false;
        }

        // 2. Exclusiones por Tipo (Apoyo, Ocasional)
        if (type.includes('apoyo') || type.includes('ocasional')) {
            logVisibility(false, 'excluded_tipo_apoyo_ocasional');
            return false;
        }

        // 3. Exclusiones por Rol/Puesto (Dirección, Jefatura, No Sujetos)
        const excludedRoles = ['direccion', 'jefatura', 'gerencia', 'mantenimiento_externo', 'limpieza_externa'];
        if (excludedRoles.some(r => role.includes(r) || puesto.includes(r))) {
            logVisibility(false, 'excluded_rol_puesto_direccion_jefatura');
            return false;
        }

        // 4. DETECCIÓN DINÁMICA DE AUSENCIAS EN EL RANGO VISIBLE
        const daysMap = employee.turnosOperativos || employee.cells || employee.dias || {};
        const turns = Object.values(daysMap);
        
        const hasVacation = turns.some(t => {
            const c = String(t.code || t.turno || t.turnoFinal || t.label || '').toUpperCase();
            return c === 'VAC' || c.includes('VACACIONES') || (t.type && String(t.type).startsWith('VAC'));
        });
        if (hasVacation || employee.hasVacationInVisibleRange) {
            logVisibility(false, 'excluded_vacaciones_visible_range');
            return false;
        }

        const hasBaja = turns.some(t => {
            const c = String(t.code || t.turno || t.turnoFinal || t.label || '').toUpperCase();
            return c === 'BAJA' || c.includes('BAJA') || c === 'IT' || c === 'BM' || (t.type && String(t.type).startsWith('BAJA'));
        });
        if (hasBaja || employee.hasBajaInVisibleRange) {
            logVisibility(false, 'excluded_baja_visible_range');
            return false;
        }

        const hasPermiso = turns.some(t => {
            const c = String(t.code || t.turno || t.turnoFinal || t.label || '').toUpperCase();
            return c === 'PERM' || c.includes('PERMISO') || (t.type && String(t.type).startsWith('PERM'));
        });
        if (hasPermiso || employee.hasPermisoInVisibleRange) {
            logVisibility(false, 'excluded_permiso_visible_range');
            return false;
        }

        // 5. REGLA ESTRICTA: Solo para empleados ordinarios activos o si se especifica control
        const isOrdinario = type === 'ordinario' || type === 'fijo' || type === 'fijo_discontinuo' || role === 'titular';
        if (!isOrdinario && type !== '') {
            logVisibility(false, 'excluded_non_ordinary_type');
            return false;
        }

        // Fallback final: Solo si es una vista pública y no hay motivos de exclusión
        if (context?.view === 'index' || context?.view === 'mobile') {
            logVisibility(true, 'ordinary_active_employee');
            return true;
        }

        logVisibility(false, 'strict_fallback_false');
        return false;
    };`;

if (content.includes(visTarget)) {
    content = content.replace(visTarget, visReplacement);
    console.log('Updated visibility logic');
}

// Usamos regex para el reemplazo de controls porque el target puede variar por espacios
const controlsRegex = /const shouldShowNightRestControls = \(employee, context\) => \{[\s\S]*?return true;[\s\S]*?\};/;
if (controlsRegex.test(content)) {
    content = content.replace(controlsRegex, controlsReplacement);
    console.log('Updated night/rest controls logic (regex)');
} else if (content.includes('const shouldShowNightRestControls')) {
    // Fallback if regex fails but header exists
    console.log('Regex failed, searching for start/end markers');
    const startIdx = content.indexOf('const shouldShowNightRestControls');
    const endIdx = content.indexOf('};', startIdx) + 2;
    content = content.slice(0, startIdx) + controlsReplacement + content.slice(endIdx);
    console.log('Updated night/rest controls logic (markers)');
}

fs.writeFileSync(path, content, 'utf8');
console.log('turnos-rules.js updated successfully');
