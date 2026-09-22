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
    const snaps = await query("publicaciones_cuadrante", "select=*&semana_inicio=gte.2026-10-12");
    console.log("Snapshots >= 2026-10-12 in publicaciones_cuadrante:", snaps);
    const snaps2 = await query("snapshots_publicados", "select=*&semana_inicio=gte.2026-10-12");
    console.log("Snapshots >= 2026-10-12 in snapshots_publicados:", snaps2);
}

main().catch(console.error);
