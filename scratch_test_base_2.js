const fs = require('fs');
const cfg = fs.readFileSync('supabase-config.js', 'utf8');
const url = cfg.match(/SUPABASE_URL\s*=\s*['"]([^'"]+)/)[1];
const key = cfg.match(/SUPABASE_ANON_KEY\s*=\s*['"]([^'"]+)/)[1];
const HEADERS = { 
    'apikey': key, 
    'Authorization': `Bearer ${key}`
};
fetch(`${url}/rest/v1/turnos_base?select=*`, { headers: HEADERS }).then(r=>r.json()).then(data => {
    if (data.error) console.log(data);
    else console.log(data.slice(0, 3));
}).catch(console.error);
