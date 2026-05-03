
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const configContent = fs.readFileSync('supabase-config.js', 'utf8');
const url = configContent.match(/supabaseUrl\s*=\s*['"]([^'"]+)['"]/)[1];
const key = configContent.match(/supabaseKey\s*=\s*['"]([^'"]+)['"]/)[1];
const supabase = createClient(url, key);

async function check() {
    console.log("--- Checking Publications for 2026-06-22 ---");
    const { data, error } = await supabase
        .from('publicaciones_cuadrante')
        .select('hotel, version, created_at')
        .eq('semana_inicio', '2026-06-22')
        .order('version', { ascending: false });

    if (error) {
        console.error("Error:", error);
        return;
    }

    if (data.length === 0) {
        console.log("No publications found for this week.");
    } else {
        console.table(data);
    }
    
    // Also check global latest version to propose next one
    const { data: latest, error: err2 } = await supabase
        .from('publicaciones_cuadrante')
        .select('version')
        .order('version', { ascending: false })
        .limit(1);
    
    if (latest && latest[0]) {
        console.log("\nLatest global version in DB:", latest[0].version);
    }
}

check();
