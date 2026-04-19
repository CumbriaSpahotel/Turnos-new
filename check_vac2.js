const fs = require('fs');
const data = JSON.parse(fs.readFileSync('c:\\Users\\comun\\Documents\\GitHub\\Turnos-new\\fb_dump.json', 'utf8'));

if (data && data.schedule) {
    data.schedule.forEach(h => {
        h.turnos.forEach(t => {
            let label = typeof t.turno === 'string' ? t.turno : (t.turno && (t.turno.TipoInterpretado || t.turno.TurnoOriginal || ''));
            const l = label ? label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim() : '';
            const isVac = l.startsWith('v') || l.includes('vac') || (t.turno && typeof t.turno === 'object' && String(t.turno.TipoAusencia || '').toLowerCase().includes('vac'));
            if (isVac) {
                console.log(`Vacation: ${t.fecha} - ${t.empleado} - ${label}`);
            }
        });
    });
}
