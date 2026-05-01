const fs = require('fs');
const path = 'c:\\Users\\comun\\Documents\\GitHub\\Turnos-new\\admin.js';
let content = fs.readFileSync(path, 'utf8');

// Helper to find and replace blocks with flexible whitespace
const replaceBlock = (target, replacement) => {
    // Normalize both for comparison
    const normTarget = target.replace(/\s+/g, ' ').trim();
    if (content.replace(/\s+/g, ' ').includes(normTarget)) {
        // Need to find the exact character sequence for the replacement to be precise
        // Since replace_file_content failed, I'll use a regex approach or split/join
        // For simplicity in a script, I'll just do a direct replace if exact match exists, 
        // else try to find it with slightly different whitespace.
        if (content.includes(target)) {
            content = content.replace(target, replacement);
            return true;
        } else {
            console.warn("Exact match not found, trying fuzzy match for block");
            return false;
        }
    }
    return false;
};

// 1. Update resolveId and add getDisplayName
const oldResolveId = `    const resolveId = (raw) => {
        if (!raw) return null;
        const norm = window.normalizeId(raw);
        // 1. Prioridad: UUID exacto
        if (idMap.has(norm)) return idMap.get(norm);
        // 2. Prioridad: Nombre normalizado único
        const ids = nameToIds.get(norm);
        if (ids && ids.size === 1) return Array.from(ids)[0];
        // 3. Fallback: Si no hay perfil o es ambiguo, devolvemos el normalizado original
        // para evitar fusiones accidentales (ej. Sergio vs Sergio Sánchez)
        return norm;
    };`;

const newResolveIdAndHelper = `    const resolveId = (raw) => {
        if (!raw) return null;
        const norm = window.normalizeId(raw);
        if (idMap.has(norm)) return idMap.get(norm);
        const ids = nameToIds.get(norm);
        if (ids && ids.size === 1) return Array.from(ids)[0];
        return raw; 
    };

    const getDisplayName = (id, rowRaw = null) => {
        const canonicalId = resolveId(id);
        const norm = window.normalizeId(canonicalId);
        const profile = employees.find(e => window.normalizeId(e.id) === norm || window.normalizeId(e.nombre) === norm);
        
        return (
            profile?.display_name ||
            profile?.nombre ||
            profile?.name ||
            rowRaw?.displayName ||
            rowRaw?.nombre ||
            (id && !String(id).includes('-') ? id : (rowRaw?.empleadoId || id))
        );
    };`;

content = content.replace(oldResolveId, newResolveIdAndHelper);

// 2. Fix the naming in the loops
// This is more delicate. I'll use line-by-line replacement for safety.
const lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
    // operationalRows/absentRows loops
    if (lines[i].includes('nombre: tProfile?.nombre || r.empleadoId,')) {
        lines[i] = '                    nombre: getDisplayName(r.empleadoId, r),';
    }
    if (lines[i].includes('nombreVisible: r.displayName || tProfile?.nombre || r.empleadoId,')) {
        lines[i] = '                    nombreVisible: getDisplayName(r.empleadoId, r),';
    }
    if (lines[i].includes('nombre: isVacante ? \'VACANTE\' : (occProfile?.nombre || status.rawSust),')) {
        lines[i] = '                    nombre: isVacante ? \'VACANTE\' : getDisplayName(occupantId, { nombre: status.rawSust }),';
    }
    if (lines[i].includes('nombreVisible: isVacante ? \'VACANTE\' : (occProfile?.nombre || status.rawSust),')) {
        lines[i] = '                    nombreVisible: isVacante ? \'VACANTE\' : getDisplayName(occupantId, { nombre: status.rawSust }),';
    }
    if (lines[i].includes('displayName: isVacante ? \'VACANTE\' : (occProfile?.nombre || status.rawSust),')) {
        lines[i] = '                    displayName: isVacante ? \'VACANTE\' : getDisplayName(occupantId, { nombre: status.rawSust }),';
    }
    if (lines[i].includes('nombre: profile?.nombre || r.empleadoId,')) {
        lines[i] = '                        nombre: getDisplayName(r.empleadoId, r),';
    }
    if (lines[i].includes('nombreVisible: r.displayName || profile?.nombre || r.empleadoId,')) {
        lines[i] = '                        nombreVisible: getDisplayName(r.empleadoId, r),';
    }
    if (lines[i].includes('displayName: r.displayName || profile?.nombre || r.empleadoId,')) {
        lines[i] = '                        displayName: getDisplayName(r.empleadoId, r),';
    }
    if (lines[i].includes('nombre: empProfile?.nombre || empId,')) {
        lines[i] = '                nombre: getDisplayName(empId),';
    }
    
    // getCelda titular/real names
    if (lines[i].includes('titular: res.sustituidoPor ?')) {
        lines[i] = '            titular: getDisplayName(asig.titular_id),';
        lines[i+1] = '            real: getDisplayName(res.empleadoId),';
    }
    
    // getTurnoEmpleadoExtended
    if (lines[i].includes('empleado: profile || { id: empleadoId, nombre: empleadoId },')) {
        lines[i] = '                        empleado: profile || { id: empleadoId, nombre: getDisplayName(empleadoId) },';
    }
}

content = lines.join('\n');

// 3. Fix deduplicatedList filter
const oldDeduplicated = `            const seenEmps = new Set();
            const deduplicatedList = [];
            employeesToRender.forEach(emp => {
                const key = emp.employee_id;
                if (!seenEmps.has(key)) {
                    seenEmps.add(key);
                    deduplicatedList.push(emp);
                }
            });`;

const newDeduplicated = `            const seenEmps = new Set();
            const deduplicatedList = [];
            employeesToRender.forEach(emp => {
                const key = emp.employee_id || emp.id || '';
                const name = emp.nombreVisible || emp.displayName || emp.nombre || '';
                if (key && name && !seenEmps.has(key)) {
                    seenEmps.add(key);
                    deduplicatedList.push(emp);
                }
            });`;

content = content.replace(oldDeduplicated, newDeduplicated);

fs.writeFileSync(path, content, 'utf8');
console.log('Admin.js fixed for canonical names and empty rows');
