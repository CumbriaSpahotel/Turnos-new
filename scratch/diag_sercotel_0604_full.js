
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnoseSercotel0604() {
    const hotel = 'Sercotel Guadiana';
    const date = '2026-04-06';
    const emps = ['Dani', 'Diana', 'Macarena'];

    console.log(`--- DIAGNÓSTICO SERCOTEL 06/04 ---`);

    // 1. Turnos Base
    const { data: turnos, error: tError } = await supabase
        .from('turnos')
        .select('*')
        .eq('fecha', date)
        .in('empleado_id', emps);
    
    if (tError) console.error('Error turnos:', tError);
    console.log('\nTurnos Base:');
    emps.forEach(name => {
        const t = turnos.find(x => x.empleado_id === name);
        console.log(`- ${name}: ${t ? t.turno : 'No encontrado'} (Hotel: ${t ? t.hotel_id : '-'})`);
    });

    // 2. Eventos
    const { data: eventos, error: eError } = await supabase
        .from('eventos_cuadrante')
        .select('*')
        .eq('fecha_inicio', date)
        .or(`empleado_id.in.(${emps.join(',')}),empleado_destino_id.in.(${emps.join(',')})`);

    if (eError) console.error('Error eventos:', eError);
    console.log('\nEventos Existentes:');
    eventos.forEach(ev => {
        console.log(`- ID: ${ev.id}`);
        console.log(`  Tipo: ${ev.tipo}`);
        console.log(`  Estado: ${ev.estado}`);
        console.log(`  Origen: ${ev.empleado_id} (Turno: ${ev.turno_original || ev.payload?.origen})`);
        console.log(`  Destino: ${ev.empleado_destino_id} (Turno: ${ev.turno_nuevo || ev.payload?.destino})`);
        console.log(`  Petición ID: ${ev.payload?.peticion_id || 'N/A'}`);
    });

    // 3. Peticiones relacionadas
    const petIds = eventos.map(ev => ev.payload?.peticion_id).filter(Boolean);
    if (petIds.length > 0) {
        const { data: requests, error: rError } = await supabase
            .from('peticiones_cambio')
            .select('*')
            .in('id', petIds);
        
        if (rError) console.error('Error peticiones:', rError);
        console.log('\nPeticiones de Cambio Asociadas:');
        requests.forEach(req => {
            console.log(`- ID: ${req.id}`);
            console.log(`  Solicitante: ${req.solicitante}`);
            console.log(`  Compañero: ${req.companero}`);
            console.log(`  Estado: ${req.estado}`);
            console.log(`  Fechas:`, JSON.stringify(req.fechas));
        });
    }

    // 4. Otros empleados de Sercotel ese día (para ver de dónde sale el M/T/N)
    const { data: allTurnos, error: aError } = await supabase
        .from('turnos')
        .select('*')
        .eq('fecha', date)
        .eq('hotel_id', hotel);
    
    console.log('\nDistribución Base Completa Sercotel 06/04:');
    allTurnos.forEach(t => {
        console.log(`- ${t.empleado_id}: ${t.turno}`);
    });
}

diagnoseSercotel0604();
