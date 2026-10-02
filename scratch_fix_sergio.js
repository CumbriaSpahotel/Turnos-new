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

async function fixSergio() {
    // Check what S. Sánchez has
    let res = await fetch(`${url}/rest/v1/turnos?empleado_id=eq.Sergio%20Sánchez&fecha=gte.2026-09-28&fecha=lte.2026-10-04`, { headers: HEADERS });
    let ssanchez = await res.json();
    console.log("Sergio Sánchez currently has:", ssanchez);

    // Delete Sergio's shifts for the week
    res = await fetch(`${url}/rest/v1/turnos?empleado_id=eq.Sergio&fecha=gte.2026-09-28&fecha=lte.2026-10-04`, { 
        method: 'DELETE', 
        headers: HEADERS 
    });
    console.log("Deleted Sergio shifts. Status:", res.status);
    
    // If Sergio Sánchez doesn't have the M M shifts, insert them
    if (!ssanchez || ssanchez.length === 0) {
        console.log("Inserting M M for Sergio Sánchez...");
        const toInsert = [
            { hotel_id: 'Sercotel Guadiana', empleado_id: 'Sergio Sánchez', fecha: '2026-09-28', turno: 'M', tipo: 'NORMAL', updated_by: 'SCRIPT_MANUAL' },
            { hotel_id: 'Sercotel Guadiana', empleado_id: 'Sergio Sánchez', fecha: '2026-09-29', turno: 'M', tipo: 'NORMAL', updated_by: 'SCRIPT_MANUAL' }
        ];
        res = await fetch(`${url}/rest/v1/turnos`, {
            method: 'POST',
            headers: HEADERS,
            body: JSON.stringify(toInsert)
        });
        console.log("Insert status:", res.status);
    }
}

fixSergio().catch(console.error);
