const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

global.window = global;
global.document = { addEventListener: () => {}, getElementById: () => ({ value: '' }), querySelector: () => ({ value: '' }) };
global.localStorage = { getItem: () => null, setItem: () => {} };
global.navigator = { userAgent: 'Node' };
global.localforage = { getItem: async () => null, setItem: async () => {} };

const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";
global.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function loadScript(filePath) {
    eval(fs.readFileSync(path.join(__dirname, '..', filePath), 'utf8'));
}

loadScript('supabase-dao.js');

async function testDedup() {
    console.log("--- TEST DEDUPLICACIÓN EN CLIENTE ---");
    const result = await window.TurnosDB.loadPublishedSchedule({
        semanaInicio: '2026-04-20',
        semanaFin: '2026-04-26'
    });
    
    console.log(`OK: ${result.ok}`);
    console.log(`Snapshots devueltos: ${result.snapshots.length}`);
    result.snapshots.forEach(s => {
        console.log(`- Hotel: ${s.hotel} | Ver: ${s.version}`);
    });
}

testDedup();
