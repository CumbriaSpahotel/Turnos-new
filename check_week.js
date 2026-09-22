const fs = require("fs");
const cfg = fs.readFileSync("supabase-config.js", "utf8");
const url = cfg.match(/SUPABASE_URL\s*=\s*['"]([^'"]+)/)[1];
const key = cfg.match(/SUPABASE_ANON_KEY\s*=\s*['"]([^'"]+)/)[1];

async function query(table, params = "") {
    const res = await fetch(`${url}/rest/v1/${table}?${params}`, {
        headers: { "apikey": key, "Authorization": `Bearer ${key}` }
    });
    return res.json();
}

async function main() {
    // Check all turnos for Cumbria 2026-10-12 to 2026-10-18
    const cumbriaTurnos = await query("turnos", "select=*&hotel_id=eq.Cumbria Spa%26Hotel&fecha=gte.2026-10-12&fecha=lte.2026-10-18&order=empleado_id.asc,fecha.asc");
    console.log("Cumbria Turnos Oct 12-18:", cumbriaTurnos.length);
    const byEmp = {};
    cumbriaTurnos.forEach(t => {
        if (!byEmp[t.empleado_id]) byEmp[t.empleado_id] = {};
        byEmp[t.empleado_id][t.fecha] = t.turno;
    });
    console.log("By employee in Cumbria Oct 12-18:", JSON.stringify(byEmp, null, 2));

    // Check Guadiana turnos Oct 12-18
    const guadianaTurnos = await query("turnos", "select=*&hotel_id=eq.Sercotel Guadiana&fecha=gte.2026-10-12&fecha=lte.2026-10-18&order=empleado_id.asc,fecha.asc");
    console.log("Guadiana Turnos Oct 12-18:", guadianaTurnos.length);
    const byEmpG = {};
    guadianaTurnos.forEach(t => {
        if (!byEmpG[t.empleado_id]) byEmpG[t.empleado_id] = {};
        byEmpG[t.empleado_id][t.fecha] = t.turno;
    });
    console.log("By employee in Guadiana Oct 12-18:", JSON.stringify(byEmpG, null, 2));
}

main().catch(console.error);
