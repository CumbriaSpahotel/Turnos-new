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
    const dianaTurnos = await query("turnos", "select=fecha,turno,hotel_id&fecha=gte.2026-10-12&empleado_id=eq.Diana&order=fecha.asc");
    console.log("Diana turnos count >= 2026-10-12:", dianaTurnos.length);
    if (dianaTurnos.length > 0) {
        console.log("Diana first:", dianaTurnos[0], "last:", dianaTurnos[dianaTurnos.length - 1]);
    }
    const cristinaTurnos = await query("turnos", "select=fecha,turno,hotel_id&fecha=gte.2026-10-12&empleado_id=eq.Cristina&order=fecha.asc");
    console.log("Cristina turnos count >= 2026-10-12:", cristinaTurnos.length);
    if (cristinaTurnos.length > 0) {
        console.log("Cristina first:", cristinaTurnos[0], "last:", cristinaTurnos[cristinaTurnos.length - 1]);
    }
    const emps = await query("empleados", "select=id,nombre,hotel_id,tipo_personal,puesto,activo");
    console.log("ALL EMPLEADOS:", emps);
}

main().catch(console.error);
