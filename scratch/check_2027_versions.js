const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const targetWeeks = ['2027-01-04', '2027-01-11', '2027-01-18', '2027-01-25'];
const targetHotels = ['Cumbria Spa&Hotel', 'Sercotel Guadiana'];

async function checkVersions() {
    console.log("Current max versions for Bloque 1 2027:");
    const { data, error } = await supabase
        .from('publicaciones_cuadrante')
        .select('hotel, semana_inicio, version, estado')
        .in('hotel', targetHotels)
        .in('semana_inicio', targetWeeks)
        .order('semana_inicio', { ascending: true })
        .order('hotel', { ascending: true })
        .order('version', { ascending: false });

    if (error) {
        console.error(error);
        return;
    }

    const map = {};
    data.forEach(row => {
        const key = `${row.semana_inicio} | ${row.hotel}`;
        if (!map[key]) map[key] = [];
        map[key].push(`V${row.version} (${row.estado})`);
    });

    Object.keys(map).forEach(key => {
        console.log(`${key}: ${map[key].join(', ')}`);
    });
}

checkVersions();
