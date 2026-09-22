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
    const sample = await query("turnos", "limit=1");
    console.log("Turnos sample row:", sample);
}

main().catch(console.error);
