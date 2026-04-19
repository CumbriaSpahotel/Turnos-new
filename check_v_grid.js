const fs = require('fs');
const data = JSON.parse(fs.readFileSync('c:\\Users\\comun\\Documents\\GitHub\\Turnos-new\\fb_dump.json', 'utf8'));

let c = 0;
if (data && data.schedule) {
    data.schedule.forEach(h => {
        h.turnos.forEach(t => {
            if (t.fecha >= '2026-04-19' && t.fecha <= '2026-12-31') {
                if (typeof t.turno === 'string' && t.turno.trim().toLowerCase() === 'v') c++;
                if (typeof t.turno === 'object' && t.turno.TurnoOriginal && t.turno.TurnoOriginal.trim().toLowerCase() === 'v') c++;
            }
        });
    });
}
console.log(`Grid "V" count in 2026: ${c}`);
