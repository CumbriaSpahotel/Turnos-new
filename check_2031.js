const fs = require('fs');
const data = JSON.parse(fs.readFileSync('c:\\Users\\comun\\Documents\\GitHub\\Turnos-new\\fb_dump.json', 'utf8'));

if (data && data.schedule) {
    data.schedule.forEach(h => {
        h.turnos.forEach(t => {
            if (t.fecha.startsWith('2031')) {
                console.log(`2031 item: ${t.fecha} - ${t.empleado} - ${typeof t.turno === 'string' ? t.turno : JSON.stringify(t.turno)}`);
            }
        });
    });
}
