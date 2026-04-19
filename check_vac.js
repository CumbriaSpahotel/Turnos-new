const fs = require('fs');
const data = JSON.parse(fs.readFileSync('c:\\Users\\comun\\Documents\\GitHub\\Turnos-new\\fb_dump.json', 'utf8'));

let vacs = 0;
let oldest = '9999';
let newest = '0000';

if (data && data.schedule) {
    data.schedule.forEach(h => {
        h.turnos.forEach(t => {
            if (t.fecha < oldest) oldest = t.fecha;
            if (t.fecha > newest) newest = t.fecha;
            
            let label = typeof t.turno === 'string' ? t.turno : (t.turno && (t.turno.TipoInterpretado || t.turno.TurnoOriginal || ''));
            if (label && label.toLowerCase().includes('v')) {
                vacs++;
            } else if (label && label.toLowerCase().includes('vac')) vacs++;
        });
    });
}
console.log(`Vacation matches: ${vacs}, Oldest: ${oldest}, Newest: ${newest}`);
