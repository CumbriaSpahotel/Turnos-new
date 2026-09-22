const fs = require("fs");
const cfg = fs.readFileSync("supabase-config.js", "utf8");
const url = cfg.match(/SUPABASE_URL\s*=\s*['"]([^'"]+)/)[1];
const key = cfg.match(/SUPABASE_ANON_KEY\s*=\s*['"]([^'"]+)/)[1];

async function main() {
    let offset = 0;
    const all = new Set();
    while (true) {
        const res = await fetch(`${url}/rest/v1/turnos?select=empleado_id&limit=1000&offset=${offset}`, {
            headers: { "apikey": key, "Authorization": `Bearer ${key}` }
        });
        const rows = await res.json();
        if (!rows || rows.length === 0) break;
        rows.forEach(r => all.add(r.empleado_id));
        offset += 1000;
        if (offset > 50000) break;
    }
    console.log("All unique empleado_id in turnos:", [...all].sort());
}

main().catch(console.error);
