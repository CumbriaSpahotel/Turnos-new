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

async function runFinalPublication() {
    const weekStart = '2026-04-20';
    const weekEnd = '2026-04-26';
    const hotels = ['Cumbria Spa&Hotel', 'Sercotel Guadiana'];
    
    console.log(`🚀 RE-PUBLICACIÓN FINAL (DATOS REALES): ${weekStart}...`);
    
    try {
        const [eventos, turnosSemana, profiles] = await Promise.all([
            window.TurnosDB.fetchEventos(weekStart, weekEnd),
            window.TurnosDB.fetchRango(weekStart, weekEnd),
            window.TurnosDB.getEmpleados()
        ]);
        
        console.log(`- Turnos encontrados en DB: ${turnosSemana.length}`);
        
        const dates = [0,1,2,3,4,5,6].map(i => {
            const d = new Date(weekStart + 'T12:00:00');
            d.setDate(d.getDate() + i);
            return d.toISOString().split('T')[0];
        });

        for (const hName of hotels) {
            console.log(`\n📦 Procesando ${hName}`);
            
            const hotelProfiles = profiles.filter(p => p.hotel_id === hName && p.activo !== false);
            
            // Usar NULL en los valores para que el motor busque en el baseIndex (turnos de la DB)
            const mockSourceRows = hotelProfiles.map((p, idx) => ({
                empleadoId: p.id,
                displayName: p.nombre,
                rowIndex: p.orden || (idx + 1),
                weekStart: weekStart,
                values: new Array(7).fill(null) 
            }));

            const hotelTurns = turnosSemana.filter(t => t.hotel_id === hName);
            
            const rosterGrid = window.TurnosEngine.buildRosterGrid({
                rows: hotelTurns,
                events: eventos,
                employees: profiles,
                dates: dates,
                hotel: hName,
                sourceRows: mockSourceRows
            });

            console.log(`  * Cuadrante resuelto con ${rosterGrid.entries.length} empleados.`);

            const snapshotObj = {
                semana_inicio: weekStart,
                semana_fin: weekEnd,
                hotel: hName,
                empleados: rosterGrid.entries.map(entry => {
                    const daysMap = {};
                    entry.cells.forEach((cell, idx) => {
                        const fecha = dates[idx];
                        const visual = window.TurnosRules.describeCell(cell);
                        const state = cell._finalState || {};

                        daysMap[fecha] = {
                            label: visual.label || cell.turno || '',
                            code: cell.turno || '',
                            icons: visual.icon ? [visual.icon] : [],
                            estado: entry.isAbsent ? 'ausente' : 'operativo',
                            origen: state.origen || 'base',
                            titular_cubierto: state.sustituyeA || null,
                            sustituto: state.sustituidoPor || null
                        };
                    });
                    return {
                        empleado_id: entry.id,
                        nombre: entry.name,
                        puesto: entry.profile?.puesto || '',
                        orden: entry.sourceOrder || 999,
                        dias: daysMap
                    };
                })
            };

            await window.TurnosDB.publishCuadranteSnapshot({
                semanaInicio: weekStart,
                semanaFin: weekEnd,
                hotel: hName,
                snapshot: snapshotObj,
                resumen: { emps: rosterGrid.entries.length },
                usuario: 'IA_REAL_DATA_RECOVERY'
            });
            console.log(`✅ ${hName} publicado con datos reales.`);
        }

    } catch (err) {
        console.error("Error:", err);
    }
}

runFinalPublication();
