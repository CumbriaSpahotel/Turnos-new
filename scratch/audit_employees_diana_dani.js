
const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

async function auditEmployees() {
    console.log("Auditing Diana and Dani in empleados table...");
    
    const url = `${SUPABASE_URL}/rest/v1/empleados?or=(nombre.ilike.*Diana*,nombre.ilike.*Dani*,id.ilike.*Diana*,id.ilike.*Dani*)`;
    
    try {
        const response = await fetch(url, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });
        
        const data = await response.json();
        console.log("Employees found:", JSON.stringify(data, null, 2));
    } catch (error) {
        console.error("Error auditing:", error);
    }
}

auditEmployees();
