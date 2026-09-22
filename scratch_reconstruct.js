// The unique constraint "uniq_turno_emp_fecha" is on (empleado_id, fecha) across ALL hotels.
// We need to:
// 1. First delete Cristina's Cumbria rows >= 2026-10-12
// 2. Then insert Cristina's Guadiana rows
// 
// ORDER MATTERS:
// A) Delete Diana Guadiana >= 2026-10-12 (already done)
// B) Delete Cristina Cumbria >= 2026-10-12 (not done yet)
// C) Insert Cristina Guadiana (Diana's schedule)
// D) Insert vacante-cumbria-2 Cumbria (Cristina's old schedule)

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
    console.log(`  Done: ${totalOk} rows`);
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

async function main() {
    console.log('===== MIGRATION (CONTINUATION) =====');
    console.log('State: Diana Guadiana already deleted (0 rows). Now need to:');
    console.log('  1. Fetch Diana schedule (was in Guadiana, now deleted - fetch from backup or use Cristina Cumbria schedule as diana schedule)\n');

    // NOTE: Diana's Guadiana rows were already deleted in the failed attempt!
    // We lost Diana's Guadiana schedule >= 2026-10-12.
    // However, Cristina's Cumbria rows are still intact.
    // The user says "Cristina assumes Diana's rotation" and per the order map, both were different.
    // Diana's schedule: T, D, D, T, T, N, N... (starting Oct 12)
    // Cristina's schedule: M, T, T, D, D, T, T... (starting Oct 12)
    // We verified this from check_week.js output.
    
    // We no longer have Diana's rows. Let's check what's in Cumbria for Cristina (that's what we need to move to vacante).
    // And we need to reconstruct Diana's Guadiana schedule.
    
    // Actually - let me check if there's a backup we can use...
    // Check the state right now
    const dGSample = await queryAll('turnos', 'hotel_id=eq.Sercotel%20Guadiana&empleado_id=eq.Diana&fecha=gte.2026-10-12');
    const cGSample = await queryAll('turnos', 'hotel_id=eq.Sercotel%20Guadiana&empleado_id=eq.Cristina&fecha=gte.2026-10-12');
    const cCSample = await queryAll('turnos', 'hotel_id=eq.Cumbria%20Spa%26Hotel&empleado_id=eq.Cristina&fecha=gte.2026-10-12');
    const vCSample = await queryAll('turnos', 'hotel_id=eq.Cumbria%20Spa%26Hotel&empleado_id=eq.vacante-cumbria-2&fecha=gte.2026-10-12');
    
    console.log(`State check:
  Diana Guadiana >= 2026-10-12: ${dGSample.length}
  Cristina Guadiana >= 2026-10-12: ${cGSample.length}
  Cristina Cumbria >= 2026-10-12: ${cCSample.length}
  vacante-cumbria-2 Cumbria >= 2026-10-12: ${vCSample.length}
`);

    // Reconstruct Diana's schedule from Cristina's Cumbria turnos
    // Wait, they are DIFFERENT schedules. Diana had T,D,D,T,T,N,N... and Cristina had M,T,T,D,D,T,T...
    // Cristina is TAKING Diana's schedule (the rotation of that row/position).
    // So we need to use Cristina's Cumbria rows as vacante-cumbria-2 (preserving planning for that slot).
    // And we need to create Cristina's Guadiana rows = Diana's old schedule.
    
    // Since Diana's rows are deleted, we need to reconstruct.
    // The rotation pattern is: T, D, D, T, T, N, N repeating.
    // Starting 2026-10-12 (Monday):
    // Mon Oct 12: T, Tue Oct 13: D, Wed Oct 14: D, Thu Oct 15: T, Fri Oct 16: T, Sat Oct 17: N, Sun Oct 18: N ...
    // This was confirmed from check_week.js output earlier.
    
    // But we have 3724 rows to reconstruct. Instead, let's look at what Diana had in Guadiana BEFORE 2026-10-12
    // to understand the cycle, and extrapolate.
    
    const dianaPreOct = await queryAll('turnos', 'hotel_id=eq.Sercotel%20Guadiana&empleado_id=eq.Diana&fecha=gte.2026-09-28&fecha=lte.2026-10-11&order=fecha.asc');
    console.log('Diana Guadiana Sep 28 - Oct 11:');
    dianaPreOct.forEach(r => console.log(`  ${r.fecha}: ${r.turno}`));
    
    // Also check Cristina Cumbria to understand her OLD schedule
    const crisCPre = await queryAll('turnos', 'hotel_id=eq.Cumbria%20Spa%26Hotel&empleado_id=eq.Cristina&fecha=gte.2026-09-28&fecha=lte.2026-10-11&order=fecha.asc');
    console.log('\nCristina Cumbria Sep 28 - Oct 11:');
    crisCPre.forEach(r => console.log(`  ${r.fecha}: ${r.turno}`));
}
main().catch(console.error);
