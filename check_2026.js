const fs = require('fs');
const data = JSON.parse(fs.readFileSync('c:\\Users\\comun\\Documents\\GitHub\\Turnos-new\\fb_dump.json', 'utf8'));

let matches26 = 0;
if (data && data.schedule) {
    data.schedule.forEach(h => {
        h.turnos.forEach(t => {
            if (t.fecha && t.fecha.startsWith('2026')) {
                matches26++;
            }
        });
    });
}
console.log(`Items in 2026: ${matches26}`);
