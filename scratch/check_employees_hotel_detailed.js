const { createClient } = require('../temp_node/node_modules/@supabase/supabase-js');

const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkEmployeesDetailed() {
    console.log("[EMPLOYEE HOTEL CHECK DETAILED]");
    const { data: emps, error } = await supabase
        .from('empleados')
        .select('nombre, hotel_id, hotel_principal, id')
        .or('nombre.ilike.%sergio%,nombre.ilike.%natalio%');

    if (error) {
        console.error("Error:", error);
        return;
    }

    emps.forEach(e => {
        console.log(`${e.nombre}: HotelId=${e.hotel_id}, HotelPrincipal=${e.hotel_principal}, ID=${e.id}`);
    });
}

checkEmployeesDetailed();
