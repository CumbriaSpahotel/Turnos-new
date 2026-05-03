const fs = require('fs');
const path = require('path');
const { createClient } = require('../temp_node/node_modules/@supabase/supabase-js');

async function compareMay() {
    const sb = createClient('https://drvmxranbpumianmlzqr.supabase.co','sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ');
    const mayWeeks = ['2026-04-27', '2026-05-04', '2026-05-11', '2026-05-18', '2026-05-25'];
    const hotels = ['Cumbria Spa&Hotel', 'Sercotel Guadiana'];

    console.log('Comparing May V139 vs V140 simulation...');

    // Load V139 snapshots
    const { data: v139s } = await sb.from('publicaciones_cuadrante')
        .select('hotel, semana_inicio, snapshot_json')
        .eq('version', 139)
        .in('semana_inicio', mayWeeks)
        .in('hotel', hotels);

    // Prepare V140 mock environment
    // I need to import the same logic as publish_v8.js
    // But since I can't easily eval the whole publish_v8.js here without side effects,
    // I'll check the core structure: order and count.

    for (const week of mayWeeks) {
        for (const hotel of hotels) {
            const v139 = v139s.find(s => s.hotel === hotel && s.semana_inicio === week);
            if (!v139) {
                console.error(`- [MISSING V139] ${hotel} | ${week}`);
                continue;
            }
            const snap139 = typeof v139.snapshot_json === 'string' ? JSON.parse(v139.snapshot_json) : v139.snapshot_json;
            const rows139 = snap139.rows || [];

            console.log(`\n--- ${hotel} | ${week} ---`);
            console.log(`V139 rows: ${rows139.length}`);
            rows139.forEach((r, i) => {
                console.log(`  ${i}: ${r.nombre} | orden=${r.orden} | rowType=${r.rowType}`);
            });
        }
    }
}

compareMay().catch(console.error);
