const fs = require('fs');
const data = JSON.parse(fs.readFileSync('c:\\Users\\comun\\Documents\\GitHub\\Turnos-new\\fb_dump.json', 'utf8'));

let labels = new Set();
if (data && data.schedule) {
    data.schedule.forEach(h => {
        h.turnos.forEach(t => {
            if (t.fecha && t.fecha >= '2026-04-19' && t.fecha <= '2026-12-31') {
                let label = typeof t.turno === 'string' ? t.turno : (t.turno && (t.turno.TipoInterpretado || t.turno.TurnoOriginal || ''));
                if (label) labels.add(label.trim());
            }
        });
    });
}
console.log(`Labels found:`, Array.from(labels));
