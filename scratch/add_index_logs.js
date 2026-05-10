const fs = require('fs');
const path = 'c:\\Users\\comun\\OneDrive\\Documentos\\GitHub\\Turnos-new\\index.html';
let content = fs.readFileSync(path, 'utf8');

const target = `        const filteredRows = rows.filter(r => {
            const isVisible = window.TurnosRules.isPublicEmployeeVisible(r);
            return isVisible;
        });`;

const replacement = `        const filteredRows = rows.filter(r => {
            const isVisible = window.TurnosRules.isPublicEmployeeVisible(r);
            const name = String(r.nombre || r.nombreVisible || r.name || '').trim();
            
            if (name.includes('Próximamente') || name.includes('VACANTE') || name.includes('Dani')) {
                console.log('[PUBLIC_ROW_FILTER]', {
                    view: 'index',
                    hotel: snap.hotel,
                    weekStart: snap.semana_inicio,
                    empleado: name,
                    hasOperationalTurns: !!(Object.values(r.turnosOperativos || r.cells || r.dias || {}).some(t => (t.code || t.turno || '').toUpperCase() && (t.code || t.turno || '').toUpperCase() !== '—')),
                    renderPublic: isVisible,
                    reason: isVisible ? 'operational_substitute_visible' : 'internal_placeholder_hidden'
                });
            }
            return isVisible;
        });`;

if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync(path, content, 'utf8');
    console.log('Added row filter logs to index.html');
} else {
    console.log('Target for index.html logs not found');
}
