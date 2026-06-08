const fs = require('fs');
const path = 'c:/Users/comun/Documents/GitHub/Turnos-new/admin.js';
let content = fs.readFileSync(path, 'utf8');

// The original loop ends with:
//                     s.history.push({ fecha: date, turno: label || '', cls: cls || 'x', cell });
//                 });
//             });
//         });

const goodBlock = `                    s.history.push({ fecha: date, turno: label || '', cls: cls || 'x', cell });
                });
            });
        });
        profilesResult.forEach(profile => {
            const s = getStat(profile.id || profile.nombre, profile.hotel_id || profile.hotel || 'Sin hotel');
            if (s) { s.id = profile.id || s.id; s.emp = profile.nombre || s.emp; }
        });
        eventos.forEach(ev => {
            [ev.empleado_id, ev.empleado_destino_id, ev.sustituto, ev.sustituto_id, ev.payload?.empleado_destino_id, ev.payload?.sustituto].forEach(empId => {
                const profile = profileByNorm.get(window.employeeNorm(empId));
                const s = getStat(profile?.id || profile?.nombre || empId, ev.hotel_origen || ev.hotel_destino || profile?.hotel_id || 'Sin hotel');
                if (s) s.eventos.push(ev);
            });
        });
        const models = Object.values(stats)
            .filter(s => {
                const n = s.emp || s.id || '';
                const lower = n.toLowerCase();
                return n.trim() !== '' && !n.includes('---') && !n.includes('___') && lower !== 'vacante' && lower !== '¿?';
            })
            .map(s => {
                const profile = profileByNorm.get(window.employeeNorm(s.id)) || profileByNorm.get(window.employeeNorm(s.emp)) || {};
                return window.buildEmployeeLineModel({ stats: s, profile, todayISO, eventos: s.eventos });
            });
        window._employeeLineModels = models;`;

// We need to find from dayRoster.forEach to window._employeeLineModels = models;
const searchStart = 'const dayRoster = window.TurnosEngine.buildDayRoster';
const searchEnd = 'window._employeeLineModels = models;';

const startIdx = content.indexOf(searchStart);
const endIdx = content.indexOf(searchEnd, startIdx) + searchEnd.length;

if (startIdx !== -1 && endIdx !== -1) {
    let before = content.substring(0, startIdx);
    let after = content.substring(endIdx);
    
    let middle = `const dayRoster = window.TurnosEngine.buildDayRoster({ rows, events: eventos, employees: profilesResult, date, hotel: hName, sourceRows: weekExcelRows, sourceIndex });
                dayRoster.forEach(entry => {
                    const s = getStat(entry.displayAs || entry.id || entry.norm, hName);
                    if (!s) return;
                    const cell = entry.cell || {};
                    let label = cell.turno || '';
                    if (cell.tipo && cell.tipo !== 'NORMAL' && cell.tipo !== 'CT') label = cell.tipo;
                    const cls = window.TurnosRules ? window.TurnosRules.shiftKey(label, cell.tipo) : '';
                    if (date <= todayISO) {
                        if (cls === 'm') s.m++;
                        else if (cls === 't') s.t++;
                        else if (cls === 'n') s.n++;
                        else if (cls === 'v') s.v++;
                        else if (cls === 'd') s.d++;
                        else if (cls === 'b') s.b++;
                        else if (String(cell.tipo || '').toUpperCase().startsWith('PERM')) s.p++;
                    }
${goodBlock}`;
    fs.writeFileSync(path, before + middle + after);
    console.log('Fixed admin.js');
} else {
    console.log('Could not find indices');
}
