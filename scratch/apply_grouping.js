const fs = require('fs');
const jsPath = 'c:/Users/comun/Documents/GitHub/Turnos-new/admin.js';
let js = fs.readFileSync(jsPath, 'utf8');

// 1. Mejorar groupConsecutiveEvents para manejar BAJA, PERMISO y VAC
const newGroupFn = `window.groupConsecutiveEvents = (events) => {
    if (!events || events.length === 0) return [];
    
    // Tipos que queremos agrupar
    const groupableTypes = ['VAC', 'BAJA', 'PERMISO', 'PERM'];
    
    // Separar los que agrupamos de los que no
    const toGroup = events.filter(e => groupableTypes.some(t => String(e.tipo || '').toUpperCase().startsWith(t)));
    const others = events.filter(e => !groupableTypes.some(t => String(e.tipo || '').toUpperCase().startsWith(t)));
    
    // Agrupar por empleado para procesar por separado
    const byEmp = {};
    toGroup.forEach(e => {
        const key = e.empleado_id || e.empleado_uuid || 'unknown';
        if (!byEmp[key]) byEmp[key] = [];
        byEmp[key].push(e);
    });
    
    const finalGroups = [];
    
    Object.values(byEmp).forEach(empEvents => {
        // Ordenar por fecha de inicio
        empEvents.sort((a, b) => a.fecha_inicio.localeCompare(b.fecha_inicio));
        
        let currentGroup = null;
        
        empEvents.forEach(e => {
            if (!currentGroup) {
                currentGroup = { 
                    ...e, 
                    fecha_fin: e.fecha_fin || e.fecha_inicio, 
                    ids: [e.id],
                    isGroup: false 
                };
            } else {
                const lastEnd = new Date((currentGroup.fecha_fin || currentGroup.fecha_inicio) + 'T12:00:00');
                const nextStart = new Date(e.fecha_inicio + 'T12:00:00');
                const diffDays = Math.round((nextStart - lastEnd) / (1000 * 60 * 60 * 24));
                
                // Criterios de agrupación: consecutivo, mismo tipo, mismo hotel, mismo sustituto, mismo estado
                const sameType = (currentGroup.tipo || '').split(' ')[0] === (e.tipo || '').split(' ')[0];
                const sameHotel = currentGroup.hotel_origen === e.hotel_origen;
                const sameSust = (currentGroup.empleado_destino_id || currentGroup.sustituto_id) === (e.empleado_destino_id || e.sustituto_id);
                const sameState = (currentGroup.estado || 'activo') === (e.estado || 'activo');
                
                if (diffDays === 1 && sameType && sameHotel && sameSust && sameState) {
                    currentGroup.fecha_fin = e.fecha_fin || e.fecha_inicio;
                    currentGroup.ids.push(e.id);
                    currentGroup.isGroup = true;
                } else {
                    finalGroups.push(currentGroup);
                    currentGroup = { 
                        ...e, 
                        fecha_fin: e.fecha_fin || e.fecha_inicio, 
                        ids: [e.id],
                        isGroup: false 
                    };
                }
            }
        });
        if (currentGroup) finalGroups.push(currentGroup);
    });
    
    return [...finalGroups, ...others];
};`;

// Reemplazar la función vieja
js = js.replace(/window\.groupConsecutiveEvents = \([\s\S]+?return \[\.\.\.groups, \.\.\.others\];\s+\};/, newGroupFn);

// 2. Modificar renderVacations para usar la agrupación
// Buscamos donde se calculan los periodos
const oldVacMapping = /const allPeriods = vacEventos\.map\(ev => \(\{[\s\S]+?\}\)\);/;
const newVacMapping = `const groupedVacs = window.groupConsecutiveEvents(vacEventos);
        const allPeriods = groupedVacs.map(ev => ({
            id:        ev.id,
            ids:       ev.ids || [ev.id],
            isGroup:   ev.isGroup || false,
            empId:     ev.empleado_id,
            hotel:     ev.hotel_origen || ev.payload?.hotel_id || 'General',
            start:     ev.fecha_inicio,
            end:       ev.fecha_fin || ev.fecha_inicio,
            days:      Math.max(1, Math.round((new Date((ev.fecha_fin || ev.fecha_inicio) + 'T12:00:00') - new Date(ev.fecha_inicio + 'T12:00:00')) / 86400000) + 1),
            sustituto: ev.empleado_destino_id || ev.payload?.sustituto || '',
            estado:    ev.estado || 'activo'
        }));`;

js = js.replace(oldVacMapping, newVacMapping);

// Actualizar el botón de anular en renderVacations
js = js.replace('window.cancelVacationByIndex(${idx})', 'window.cancelVacationGroup(${idx})');

// 3. Modificar renderBajas para usar la agrupación
const oldBajasFetch = /const data = await window\.TurnosDB\.fetchBajasPermisos\([\s\S]+?\);/;
const newBajasFetch = `let rawData = await window.TurnosDB.fetchBajasPermisos({
            hotel: hotel !== 'all' ? hotel : null,
            empleado: emp !== 'all' ? emp : null,
            estadoFiltro: status,
            fechaInicio: start,
            fechaFin: end
        });
        const data = window.groupConsecutiveEvents(rawData);`;

js = js.replace(oldBajasFetch, newBajasFetch);

// Actualizar el mapeo de días en renderBajas
const oldBajasDays = /\${Math\.round\(\(new Date\(b\.fecha_fin \+ 'T12:00:00'\) - new Date\(b\.fecha_inicio \+ 'T12:00:00'\)\) \/ 86400000\) \+ 1\} DÍAS NATURALES/;
const newBajasDays = `\${Math.round((new Date((b.fecha_fin || b.fecha_inicio) + 'T12:00:00') - new Date(b.fecha_inicio + 'T12:00:00')) / 86400000) + 1} DÍAS \${b.isGroup ? '(Agrupados)' : 'NATURALES'}`;
js = js.replace(oldBajasDays, newBajasDays);

// Actualizar el botón de anular en renderBajas
// En renderBajas el botón está al final de la tabla
js = js.replace('window.editBajaPeriod(\'${b.id}\')', 'window.manageBajaGroup(\'${b.id}\', ${JSON.stringify(b.ids || [b.id])})');

// 4. Añadir funciones de gestión de grupos
const groupActions = `
window.cancelVacationGroup = async (idx) => {
    const p = _visibleVacationPeriods[idx];
    if (!p) return;
    
    const count = p.ids ? p.ids.length : 1;
    const msg = count > 1 
        ? \`Vas a anular \${p.days} días de vacaciones de \${p.empId} del \${window.fmtDateLegacy(p.start)} al \${window.fmtDateLegacy(p.end)}. ¿Continuar?\`
        : \`¿Anular las vacaciones de \${p.empId}?\`;
        
    if (!confirm(msg)) return;
    
    try {
        const ids = p.ids || [p.id];
        for (const id of ids) {
            await window.TurnosDB.anularEvento(id);
        }
        await window.renderVacations();
    } catch (e) { alert('Error: ' + e.message); }
};

window.manageBajaGroup = async (id, ids) => {
    if (ids && ids.length > 1) {
        if (confirm(\`Este periodo consta de \${ids.length} eventos diarios agrupados. ¿Deseas gestionar el periodo completo?\\n\\n(Pulsa Cancelar si prefieres gestionar solo el día inicial)\`)) {
            // Por ahora, como no hay edición masiva, abrimos el primero pero avisamos
            window._editingGroupIds = ids;
        }
    }
    window.editBajaPeriod(id);
};
`;

js += groupActions;

fs.writeFileSync(jsPath, js);
console.log("admin.js grouping logic and UI updates applied.");
