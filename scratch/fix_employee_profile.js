const fs = require('fs');
const path = 'c:\\Users\\comun\\Documents\\GitHub\\Turnos-new\\admin.js';
let content = fs.readFileSync(path, 'utf8');

// 1. Helper para agrupar eventos VAC
const groupHelper = `
window.groupConsecutiveEvents = (events) => {
    if (!events || events.length === 0) return [];
    
    // Solo agrupamos VAC por ahora, el resto se queda igual
    const vacs = events.filter(e => e.tipo === 'VAC').sort((a,b) => a.fecha_inicio.localeCompare(b.fecha_inicio));
    const others = events.filter(e => e.tipo !== 'VAC');
    
    const groups = [];
    let current = null;

    vacs.forEach(e => {
        if (!current) {
            current = { ...e, fecha_fin: e.fecha_fin || e.fecha_inicio, count: 1 };
        } else {
            const lastDate = new Date((current.fecha_fin || current.fecha_inicio) + 'T12:00:00');
            const nextDate = new Date(e.fecha_inicio + 'T12:00:00');
            const diff = Math.round((nextDate - lastDate) / (1000 * 60 * 60 * 24));
            
            if (diff === 1 && current.tipo === e.tipo && current.sustituto_id === e.sustituto_id) {
                current.fecha_fin = e.fecha_fin || e.fecha_inicio;
                current.count++;
            } else {
                groups.push(current);
                current = { ...e, fecha_fin: e.fecha_fin || e.fecha_inicio, count: 1 };
            }
        }
    });
    if (current) groups.push(current);
    
    return [...groups, ...others];
};
`;

if (!content.includes('window.groupConsecutiveEvents')) {
    content = content.replace('window.buildEmployeeProfileModel', groupHelper + '\nwindow.buildEmployeeProfileModel');
}

// 2. Fix Overwork Alert
const oldAlertLogic = `model.calendario.forEach(d => {
                        if (d.turno && d.turno !== 'D' && !d.incidencia) {
                            consecutive++;
                            if (consecutive > maxConsecutive) maxConsecutive = consecutive;
                        } else {
                            consecutive = 0;
                        }
                    });`;

const newAlertLogic = `const isWorking = (d) => {
                            const t = (d.turno || '').toUpperCase();
                            if (d.incidencia) return false;
                            if (['D', 'DESCANSO', '-', '—', '', 'PENDIENTE DE ASIGNAR'].includes(t)) return false;
                            if (['M', 'T', 'N', 'MAÑANA', 'TARDE', 'NOCHE'].includes(t)) return true;
                            return t.length > 0;
                        };
                        model.calendario.forEach(d => {
                            if (isWorking(d)) {
                                consecutive++;
                                if (consecutive > maxConsecutive) maxConsecutive = consecutive;
                            } else {
                                consecutive = 0;
                            }
                        });`;

if (content.includes(oldAlertLogic)) {
    content = content.replace(oldAlertLogic, newAlertLogic);
}

// 3. Unificar Estado Laboral
content = content.replace("['Estado', emp.estado, 'estado_empresa']", "['Estado Laboral', emp.estado, 'estado_empresa']");
content = content.replace(", ['Activo', emp.activo === false ? 'No' : 'Si', 'activo', 'boolean']", "");

// 4. Aplicar Agrupación en el Render
const oldRenderIncidencias = "const incidenciasActivas = model.eventosActivos.filter(ev => /VAC|BAJA|PERM/i.test(ev.tipo || ''));";
const newRenderIncidencias = "const incidenciasActivasRaw = model.eventosActivos.filter(ev => /VAC|BAJA|PERM/i.test(ev.tipo || ''));\n    const incidenciasActivas = window.groupConsecutiveEvents(incidenciasActivasRaw);";

if (content.includes(oldRenderIncidencias)) {
    content = content.replace(oldRenderIncidencias, newRenderIncidencias);
}

// 5. Corregir etiqueta de fecha para eventos agrupados
const oldDateRange = "${ev.fecha_inicio} al ${ev.fecha_fin || '...'}";
const newDateRange = "${ev.count > 1 ? `<b>${ev.count} días:</b> ${window.fmtDateLegacy(ev.fecha_inicio)} al ${window.fmtDateLegacy(ev.fecha_fin)}` : `${window.fmtDateLegacy(ev.fecha_inicio)}`}";

if (content.includes(oldDateRange)) {
    content = content.replace(oldDateRange, newDateRange);
}

fs.writeFileSync(path, content, 'utf8');
console.log('Successfully updated admin.js');
