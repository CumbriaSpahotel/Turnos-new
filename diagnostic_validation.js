const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Mock window object for the DAO
global.window = {
    supabase: null,
    localforage: { clear: async () => {} }
};

// Load supabase config
const configPath = 'c:/Users/comun/Documents/GitHub/Turnos-new/supabase-config.js';
const configContent = fs.readFileSync(configPath, 'utf8');
// Extract URL and Key using regex
const urlMatch = configContent.match(/const SUPABASE_URL = ["'](.+?)["']/);
const keyMatch = configContent.match(/const SUPABASE_ANON_KEY = ["'](.+?)["']/);

if (!urlMatch || !keyMatch) {
    console.error("Could not find Supabase config");
    process.exit(1);
}

const supabase = createClient(urlMatch[1], keyMatch[1]);
global.window.supabase = supabase;

// Load DAO
const daoPath = 'c:/Users/comun/Documents/GitHub/Turnos-new/supabase-dao.js';
require(daoPath);

const TurnosDB = global.window.TurnosDB;
TurnosDB.client = supabase;

async function validate() {
    console.log("--- INICIO VALIDACIÓN DAO ---");
    
    // 1. Fetch peticiones
    const peticiones = await TurnosDB.fetchPeticiones();
    const testReq = peticiones.find(p => p.solicitante === 'Dani' && p.companero === 'Macarena' && p.estado === 'pendiente');
    
    if (!testReq) {
        console.error("No se encontró la solicitud de Dani/Macarena en estado pendiente");
        process.exit(1);
    }
    console.log("ID Solicitud:", testReq.id);

    // 2. Aprobar
    console.log("Aprobando solicitud...");
    await TurnosDB.procesarAprobacionPeticion(testReq);
    
    // 3. Verificar cambio de estado
    const updated = await TurnosDB.fetchPeticiones();
    const approvedReq = updated.find(p => p.id === testReq.id);
    console.log("Nuevo estado:", approvedReq.estado);

    // 4. Verificar mensaje en bandeja
    const mensajes = await TurnosDB.fetchMensajes();
    const testMsg = mensajes.find(m => m.emisor === 'Dani' && m.cuerpo.includes('solicitado un cambio'));
    console.log("Mensaje en bandeja encontrado:", !!testMsg);

    console.log("--- FIN VALIDACIÓN DAO ---");
}

validate().catch(err => {
    console.error(err);
    process.exit(1);
});
