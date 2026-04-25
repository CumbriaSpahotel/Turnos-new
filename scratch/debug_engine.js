const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

global.window = global;
global.document = {
    addEventListener: () => {},
    getElementById: () => ({ value: '', textContent: '', style: { background: '', display: '' } }),
    querySelector: (s) => ({ value: '2026-04-20', textContent: '', style: {} })
};
global.localStorage = { getItem: () => null, setItem: () => {} };
global.navigator = { userAgent: 'Node' };
global.localforage = { getItem: async () => null, setItem: async () => {} };

const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";
global.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function loadScript(filePath) {
    eval(fs.readFileSync(path.join(__dirname, '..', filePath), 'utf8'));
}

loadScript('turnos-rules.js');
loadScript('shift-resolver.js');
loadScript('turnos-engine.js');
loadScript('supabase-dao.js');

async function debugTurns() {
    const weekStart = '2026-04-20';
    const weekEnd = '2026-04-26';
    const hName = 'Cumbria Spa&Hotel';
    
    console.log("--- DEBUG TURNS ---");
    const [eventos, turnosSemana, profiles] = await Promise.all([
        window.TurnosDB.fetchEventos(weekStart, weekEnd),
        window.TurnosDB.fetchRango(weekStart, weekEnd),
        window.TurnosDB.getEmpleados()
    ]);
    
    const hotelTurns = turnosSemana.filter(t => t.hotel_id === hName);
    console.log(`Eventos: ${eventos.length}, Turnos: ${hotelTurns.length}`);

    const dates = [0,1,2,3,4,5,6].map(i => {
        const d = new Date(weekStart + 'T12:00:00');
        d.setDate(d.getDate() + i);
        return d.toISOString().split('T')[0];
    });

    const rosterGrid = window.TurnosEngine.buildRosterGrid({
        rows: hotelTurns,
        events: eventos,
        employees: profiles,
        dates: dates,
        hotel: hName,
        sourceRows: []
    });

    rosterGrid.entries.forEach(e => {
        console.log(`Emp: ${e.name}`);
        e.cells.forEach((c, i) => {
            console.log(`  Day ${i} (${dates[i]}):`, JSON.stringify(c));
        });
    });
}

debugTurns();
