const { createClient } = require('../temp_node/node_modules/@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkSnapshot() {
    const hotel = "Sercotel Guadiana";
    const week = "2026-06-01";
    
    console.log(`Checking latest snapshot for ${hotel} | ${week}...`);
    
    const { data, error } = await supabase
        .from('publicaciones_cuadrante')
        .select('*')
        .eq('hotel', hotel)
        .eq('semana_inicio', week)
        .order('version', { ascending: false })
        .limit(1);
        
    if (error) {
        console.error('Error fetching snapshot:', error);
        return;
    }
    
    if (!data || data.length === 0) {
        console.log('No snapshot found.');
        return;
    }
    
    const snap = data[0];
    console.log(`Found Snapshot V${snap.version} (ID: ${snap.id})`);
    console.log(`Created at: ${snap.created_at}`);
    
    const rows = snap.snapshot_json.rows || snap.snapshot_json.empleados || [];
    console.log(`Total rows: ${rows.length}`);
    
    // Check for "Dani" and "Diana" and "sin asignar"
    const dani = rows.find(r => String(r.nombreVisible || r.nombre).includes('Dani'));
    const diana = rows.find(r => String(r.nombreVisible || r.nombre).includes('Diana'));
    const sinAsignar = rows.find(r => String(r.nombreVisible || r.nombre).includes('sin asignar'));
    
    console.log('\nAudit Results:');
    if (dani) console.log(`- Dani: rowType=${dani.rowType}, orden=${dani.puestoOrden || dani.orden}`);
    if (diana) console.log(`- Diana: rowType=${diana.rowType}, orden=${diana.puestoOrden || diana.orden}`);
    if (sinAsignar) console.log(`- sin asignar: rowType=${sinAsignar.rowType}, orden=${sinAsignar.puestoOrden || sinAsignar.orden}`);
    
    // Check Tuesday 2026-06-02 (the day of the swap)
    const targetDate = '2026-06-02';
    console.log(`\nShifts on ${targetDate}:`);
    if (dani) console.log(`- Dani: ${JSON.stringify((dani.cells || dani.dias)[targetDate])}`);
    if (diana) console.log(`- Diana: ${JSON.stringify((diana.cells || diana.dias)[targetDate])}`);
    if (sinAsignar) console.log(`- sin asignar: ${JSON.stringify((sinAsignar.cells || sinAsignar.dias)[targetDate])}`);
}

checkSnapshot();
