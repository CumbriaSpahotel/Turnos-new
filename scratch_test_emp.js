const fs = require('fs');
const cfg = fs.readFileSync('supabase-config.js', 'utf8');
const url = cfg.match(/SUPABASE_URL\s*=\s*['"]([^'"]+)/)[1];
const key = cfg.match(/SUPABASE_ANON_KEY\s*=\s*['"]([^'"]+)/)[1];
const HEADERS = { 
    'apikey': key, 
    'Authorization': `Bearer ${key}`
};

async function checkEmp() {
    let res = await fetch(`${url}/rest/v1/empleados?id=eq.Miriam`, { headers: HEADERS });
    console.log("Miriam emp:", await res.json());

    res = await fetch(`${url}/rest/v1/empleados?id=eq.Esther`, { headers: HEADERS });
    console.log("Esther emp:", await res.json());
}

checkEmp().catch(console.error);
