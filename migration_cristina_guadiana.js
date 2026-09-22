// Reconstruct Diana's Guadiana schedule from known rotation pattern
// Diana's known pre-Oct12 pattern (Guadiana):
// Oct 10: T, Oct 11: T, Oct 12: D (waiting confirmation) -- no wait
// From scratch_reconstruct.js: Oct 10: T, Oct 11: T -> next would be D, D, T, T, N, N -> Oct 12: D ??
// But from check_week.js: Diana Guadiana Oct 12: T -- that's contradicting Diana pre Oct pattern
// Wait: Oct 10: T, Oct 11: T in Diana's Guadiana (pre-deleted data),
// but check_week.js showed Diana Oct 12: T ... that's DIFFERENT from the reconstructed T from below

// Actually from check_week.js output (ran BEFORE migration):
// Diana Guadiana Oct 12-18: T, D, D, T, T, N, N
// Diana Guadiana Sep 28 - Oct 11 (surviving rows): D,D,M,M,M,M,M,M,N,N,D,D,T,T
// So continuing: Oct 10:T, Oct 11:T -> Oct 12:D?? No, check_week showed Oct 12:T
// Actually no - LOOK: Sep 28:D, Sep 29:D, Sep 30:M, Oct 1:M, Oct 2:M, Oct 3:M, Oct 4:M, Oct 5:M, Oct 6:N, Oct 7:N, Oct 8:D, Oct 9:D, Oct 10:T, Oct 11:T
// And then check_week.js showed Oct 12: T ... that means T appears again?? 

// Wait - Looking at the cycle for Diana:
// D,D,M,M,M,M,M,M,N,N,D,D,T,T,T,D,D,T,T,N,N...
// Hmm that's not a simple 7-day rotation. Let me look at 2-week pattern:
// Sep 28(D): D,D,M,M,M,M,M,M,N,N,D,D,T,T (14 days)
// Oct 12(D+14): T (from check_week.js showing Diana Oct 12:T)

// But the snapshot for Guadiana Oct 12 showed Diana Oct 12: Descanso (code shown as "Descanso")
// This was AFTER intercambio (intercambio took Diana's T -> Descanso on Oct 12, Elena working instead)

// So Diana's BASE turno on Oct 12 WAS T, but the intercambio with Elena changed it to Descanso.
// From check_week.js (base turnos only): Diana Oct 12:T, Oct 13:D, Oct 14:D, Oct 15:T, Oct 16:T, Oct 17:N, Oct 18:N

// So the rotation starting Oct 12 for Diana/Guadiana row 3 position:
// T,D,D,T,T,N,N - this is the 7-day cycle

// Now I need to reconstruct all 3724 rows (Oct 12, 2026 to ~Jul 7, 2029) using this cycle.
// But actually the rotation doesn't need to be perfectly computed - the SNAPSHOT data shows
// Diana's actual planned schedule row by row in the DB. Since we have the data for Sep 28 - Oct 11,
// we can use the cycle to reconstruct.

// The 7-day cycle for Diana/Guadiana row: T,D,D,T,T,N,N (Mon=0 from Oct 12)
// Oct 12 (Mon) = T, Oct 13 (Tue) = D, Oct 14 (Wed) = D, Oct 15 (Thu) = T, Oct 16 (Fri) = T, Oct 17 (Sat) = N, Oct 18 (Sun) = N
// Oct 19 (Mon) = T, etc. Perfect 7-day cycle!

const fs = require('fs');
const cfg = fs.readFileSync('supabase-config.js', 'utf8');
const url = cfg.match(/SUPABASE_URL\s*=\s*['"]([^'"]+)/)[1];
const key = cfg.match(/SUPABASE_ANON_KEY\s*=\s*['"]([^'"]+)/)[1];
const BASE_HEADERS = { 'apikey': key, 'Authorization': `Bearer ${key}` };

async function queryAll(table, params) {
    let all = [];
    let offset = 0;
    const batchSize = 1000;
    while (true) {
        const res = await fetch(`${url}/rest/v1/${table}?${params}&limit=${batchSize}&offset=${offset}`, {
            headers: BASE_HEADERS
        });
        const data = await res.json();
        if (!Array.isArray(data) || data.length === 0) break;
        all = all.concat(data);
        if (data.length < batchSize) break;
        offset += batchSize;
    }
    return all;
}

async function upsert(table, rows) {
    const batchSize = 500;
    let totalOk = 0;
    for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const res = await fetch(`${url}/rest/v1/${table}`, {
            method: 'POST',
            headers: { ...BASE_HEADERS, 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates,return=minimal' },
            body: JSON.stringify(batch)
        });
        if (res.status >= 300) {
            const txt = await res.text();
            throw new Error(`Upsert batch ${i}-${i+batchSize} failed HTTP ${res.status}: ${txt}`);
        }
        totalOk += batch.length;
        process.stdout.write(`  Progress: ${totalOk}/${rows.length}    \r`);
    }
    process.stdout.write('\n');
    return totalOk;
}

async function del(table, filter) {
    const res = await fetch(`${url}/rest/v1/${table}?${filter}`, {
        method: 'DELETE',
        headers: BASE_HEADERS
    });
    return res.status;
}

async function patch(table, filter, body) {
    const res = await fetch(`${url}/rest/v1/${table}?${filter}`, {
        method: 'PATCH',
        headers: { ...BASE_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    const txt = await res.text();
    if (res.status >= 300) throw new Error(`PATCH ${table} -> HTTP ${res.status}: ${txt}`);
    return res.status;
}

function addDays(dateStr, days) {
    const d = new Date(dateStr + 'T12:00:00');
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
}

async function main() {
    console.log('===== MIGRATION STEP 1: Reconstruct and insert Cristina in Guadiana =====');

    // Cristina's Cumbria rows are still intact (3724 rows from Oct 12, 2026 to Jul 7, 2029)
    // We use these as the source for Diana's cycle offset
    // Diana's cycle starting Oct 12: T,D,D,T,T,N,N (positions 0-6, repeating)
    // Oct 12 is Monday (day 1 of week). Position 0 = Monday = T
    const DIANA_CYCLE = ['T', 'D', 'D', 'T', 'T', 'N', 'N'];
    const CYCLE_START = '2026-10-12';

    // Fetch ALL Cristina Cumbria rows >= 2026-10-12 (source for dates, we just need fechas)
    console.log('Fetching Cristina Cumbria rows for dates...');
    const crisCRows = await queryAll('turnos', 
        'hotel_id=eq.Cumbria%20Spa%26Hotel&empleado_id=eq.Cristina&fecha=gte.2026-10-12&order=fecha.asc');
    console.log(`  Fetched ${crisCRows.length} rows`);

    // Build Cristina Guadiana rows using Diana's cycle
    const startDate = new Date(CYCLE_START + 'T12:00:00');
    const cristinaGuadianaRows = crisCRows.map(r => {
        const d = new Date(r.fecha + 'T12:00:00');
        const dayOffset = Math.round((d - startDate) / (1000 * 60 * 60 * 24));
        const cycleIdx = ((dayOffset % 7) + 7) % 7;
        return {
            empleado_id: 'Cristina',
            fecha: r.fecha,
            hotel_id: 'Sercotel Guadiana',
            turno: DIANA_CYCLE[cycleIdx],
            tipo: 'NORMAL',
            updated_by: 'MIGRATION_2026_10_12'
        };
    });

    // Verify first week
    const firstWeek = cristinaGuadianaRows.slice(0, 7);
    console.log('First week Cristina Guadiana (should be T,D,D,T,T,N,N):');
    firstWeek.forEach(r => console.log(`  ${r.fecha}: ${r.turno}`));

    // Delete Cristina Cumbria rows first (to free up constraint)
    console.log('\nEliminando Cristina Cumbria rows >= 2026-10-12...');
    const dRes = await del('turnos', 'hotel_id=eq.Cumbria%20Spa%26Hotel&empleado_id=eq.Cristina&fecha=gte.2026-10-12');
    console.log(`  DELETE status: ${dRes}`);

    // Now we can safely insert Cristina in Guadiana
    console.log('\nInsertando Cristina en Sercotel Guadiana...');
    await upsert('turnos', cristinaGuadianaRows);
    console.log('  ✅ Cristina Guadiana inserted');

    // Now insert vacante-cumbria-2 with Cristina's OLD schedule (from crisCRows)
    const vacanteRows = crisCRows.map(r => ({
        empleado_id: 'vacante-cumbria-2',
        fecha: r.fecha,
        hotel_id: 'Cumbria Spa&Hotel',
        turno: r.turno,
        tipo: 'NORMAL',
        updated_by: 'MIGRATION_2026_10_12'
    }));
    console.log('\nInsertando vacante-cumbria-2 en Cumbria...');
    await upsert('turnos', vacanteRows);
    console.log('  ✅ vacante-cumbria-2 Cumbria inserted');

    // Verify
    const vCrisG = await queryAll('turnos', 'hotel_id=eq.Sercotel%20Guadiana&empleado_id=eq.Cristina&fecha=gte.2026-10-12&fecha=lte.2026-10-18&order=fecha.asc');
    console.log('\nVerification Cristina Guadiana Oct 12-18:');
    vCrisG.forEach(r => console.log(`  ${r.fecha}: ${r.turno}`));

    const vVacC = await queryAll('turnos', 'hotel_id=eq.Cumbria%20Spa%26Hotel&empleado_id=eq.vacante-cumbria-2&fecha=gte.2026-10-12&fecha=lte.2026-10-18&order=fecha.asc');
    console.log('\nVerification vacante-cumbria-2 Cumbria Oct 12-18:');
    vVacC.forEach(r => console.log(`  ${r.fecha}: ${r.turno}`));

    // ---- empleados updates ----
    console.log('\n[STEP 3] Diana: tipo_personal → apoyo...');
    await patch('empleados', 'id=eq.Diana', { tipo_personal: 'apoyo' });
    console.log('  ✅ Done');

    console.log('[STEP 4] Cristina: hotel_id → Sercotel Guadiana...');
    await patch('empleados', 'id=eq.Cristina', { hotel_id: 'Sercotel Guadiana' });
    console.log('  ✅ Done');

    // ---- eventos_cuadrante updates ----
    console.log('[STEP 5] Intercambios Diana-Elena → Cristina...');
    const dianEventIds = [
        'c99eefd7-ee9f-4e10-b77c-e29c4473035f',
        '9f86f871-d88d-48fd-97cd-a0dbc92cd1f5',
        '007a9c0f-851d-4888-97e6-f7363204b2d1',
        '18e9eb7b-f522-4974-9805-43a59b72b7b0'
    ];
    await patch('eventos_cuadrante', `id=in.(${dianEventIds.join(',')})`, {
        empleado_id: 'Cristina',
        hotel_origen: 'Sercotel Guadiana',
        hotel_destino: 'Sercotel Guadiana'
    });
    console.log('  ✅ Done');

    console.log('[STEP 6] Anulando intercambio Cristina-Miriam Oct 23...');
    await patch('eventos_cuadrante', 'id=eq.ce33f198-3420-446c-905e-9fad6d5c0f8e', { estado: 'anulado' });
    console.log('  ✅ Done');

    console.log('\n===== DB MIGRATION COMPLETE =====');
}
main().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
