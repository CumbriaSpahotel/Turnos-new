const fs = require('fs');
const cfg = fs.readFileSync('supabase-config.js', 'utf8');
const url = cfg.match(/SUPABASE_URL\s*=\s*['"]([^'"]+)/)[1];
const key = cfg.match(/SUPABASE_ANON_KEY\s*=\s*['"]([^'"]+)/)[1];
const HEADERS = { 
    'apikey': key, 
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal'
};

const guadianas = [
    { id: 'EMP-0018', shifts: ['D', 'D', 'M', 'M', 'M', 'M', 'M'] },
    { id: 'Macarena', shifts: ['T', 'T', 'T', 'T', 'T', 'D', 'D'] },
    { id: 'Natalio', shifts: [null, 'N', 'N', 'D', 'D', null, null] },
    { id: 'Dani', shifts: ['N', 'D', 'D', 'N', 'D', 'T', 'T'] },
    { id: 'Sergio', shifts: ['M', 'M', null, null, null, null, null] },
    { id: 'Federico', shifts: ['B', 'B', 'B', 'B', 'N', 'N', 'N'] }
];

const cumbrias = [
    { id: 'Gustavo Sánchez', shifts: ['D', 'D', 'M', 'M', 'M', null, null] },
    { id: 'Miriam', shifts: ['M', 'N', 'N', 'D', 'D', 'T', 'T'] },
    { id: 'Esther', shifts: ['D', 'T', 'T', 'T', 'T', 'D', 'M'] },
    { id: 'Valentín', shifts: ['N', 'D', 'D', 'N', 'N', 'N', 'N'] },
    { id: 'Isabel Hidalgo', shifts: [null, 'M', null, null, null, null, null] },
    { id: 'Natalio', shifts: ['T', null, null, null, null, 'M', 'D'] }
];

const dates = [
    '2026-09-28',
    '2026-09-29',
    '2026-09-30',
    '2026-10-01',
    '2026-10-02',
    '2026-10-03',
    '2026-10-04'
];

async function updateWeek() {
    let toInsert = [];

    // delete without hotel_id just to be absolutely sure all shifts for these employees are gone
    const allEmps = [...new Set([...guadianas.map(e => e.id), ...cumbrias.map(e => e.id)])];
    for (const empId of allEmps) {
        await fetch(`${url}/rest/v1/turnos?empleado_id=eq.${encodeURIComponent(empId)}&fecha=gte.2026-09-28&fecha=lte.2026-10-04`, { method: 'DELETE', headers: HEADERS });
    }

    for (const g of guadianas) {
        for (let i = 0; i < 7; i++) {
            if (g.shifts[i]) {
                toInsert.push({
                    hotel_id: 'Sercotel Guadiana',
                    empleado_id: g.id,
                    fecha: dates[i],
                    turno: g.shifts[i],
                    tipo: 'NORMAL',
                    updated_by: 'SCRIPT_MANUAL'
                });
            }
        }
    }

    for (const c of cumbrias) {
        for (let i = 0; i < 7; i++) {
            if (c.shifts[i]) {
                toInsert.push({
                    hotel_id: 'Cumbria Spa&Hotel',
                    empleado_id: c.id,
                    fecha: dates[i],
                    turno: c.shifts[i],
                    tipo: 'NORMAL',
                    updated_by: 'SCRIPT_MANUAL'
                });
            }
        }
    }

    console.log(`Inserting ${toInsert.length} shifts one by one to find conflict...`);
    for (const shift of toInsert) {
        const res = await fetch(`${url}/rest/v1/turnos`, {
            method: 'POST',
            headers: HEADERS,
            body: JSON.stringify([shift])
        });
        if (!res.ok) {
            console.error("Conflict on:", shift.empleado_id, shift.fecha, shift.hotel_id, await res.text());
        }
    }
    console.log("Done inserting.");
}

updateWeek().catch(console.error);
