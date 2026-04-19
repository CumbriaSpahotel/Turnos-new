const fs = require('fs');
const data = JSON.parse(fs.readFileSync('c:\\Users\\comun\\Documents\\GitHub\\Turnos-new\\fb_dump.json', 'utf8'));

let count = 0;
if (data && data.schedule) {
    data.schedule.forEach(h => {
        h.turnos.forEach(t => {
            if (t.fecha && t.fecha.startsWith('2026') && t.fecha >= '2026-04-19') {
                let label = typeof t.turno === 'string' ? t.turno : (t.turno && (t.turno.TipoInterpretado || t.turno.TurnoOriginal || ''));
                const l = label ? label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim() : '';
                const isVac = l.startsWith('v') || l.includes('vac') || (t.turno && typeof t.turno === 'object' && String(t.turno.TipoAusencia || '').toLowerCase().includes('vac'));
                if (isVac) count++;
            }
        });
    });
}
console.log(`Vacations in 2026 (after April 19): ${count}`);
