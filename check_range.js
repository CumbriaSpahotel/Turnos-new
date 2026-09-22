const fs = require("fs");

const cfg = fs.readFileSync("supabase-config.js", "utf8");
const url = cfg.match(/SUPABASE_URL\s*=\s*['"]([^'"]+)/)[1];
const key = cfg.match(/SUPABASE_ANON_KEY\s*=\s*['"]([^'"]+)/)[1];

async function query(table, params = "") {
    const res = await fetch(`${url}/rest/v1/${table}?${params}`, {
        headers: {
            "apikey": key,
            "Authorization": `Bearer ${key}`
        }
    });
    return res.json();
}

async function main() {
    // Count turnos for Diana >= 2026-10-12
    const dianaTurnos = await query("turnos", "select=fecha,turno,hotel_id&fecha=gte.2026-10-12&empleado_id=eq.Diana&order=fecha.asc");
    console.log("Diana turnos total >= 2026-10-12:", dianaTurnos.length);
    if (dianaTurnos.length > 0) {
        console.log("Diana first:", dianaTurnos[0], "last:", dianaTurnos[dianaTurnos.length - 1]);
    }

    // Count turnos for Cristina >= 2026-10-12
    const cristinaTurnos = await query("turnos", "select=fecha,turno,hotel_id&fecha=gte.2026-10-12&empleado_id=eq.Cristina&order=fecha.asc");
    console.log("Cristina turnos total >= 2026-10-12:", cristinaTurnos.length);
    if (cristinaTurnos.length > 0) {
        console.log("Cristina first:", cristinaTurnos[0], "last:", cristinaTurnos[cristinaTurnos.length - 1]);
    }

    // Check all turnos max date in DB
    const maxDate = await query("turnos", "select=fecha&order=fecha.desc&limit=1");
    console.log("Max date in turnos:", maxDate);

    // Check Natalio hotel in empleados
    const natalio = await query("empleados", "select=*&id=eq.Natalio");
    console.log("Natalio in empleados:", natalio);

    // Check Diana in empleados
    const diana = await query("empleados", "select=*&id=eq.Diana");
    console.log("Diana in empleados:", diana);

    // Check Cristina in empleados
    const cristina = await query("empleados", "select=*&id=eq.Cristina");
    console.log("Cristina in empleados:", cristina);

    // Check events_cuadrante for Diana or Cristina >= 2026-10-12
    const events = await query("eventos_cuadrante", "select=*&fecha_inicio=gte.2026-10-12&or=(empleado_id.in.(Diana,Cristina),empleado_destino_id.in.(Diana,Cristina))");
    console.log("Events >= 2026-10-12:", events);
}

main().catch(console.error);
