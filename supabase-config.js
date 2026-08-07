const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

// Exponer en window para permitir reconexión automática desde el DAO
window.SUPABASE_URL = SUPABASE_URL;
window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;

try {
    window.supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    if (window.TurnosDB) window.TurnosDB.client = window.supabase;
} catch (e) {
    console.error('[CONFIG] No se pudo inicializar el cliente Supabase:', e.message);
}

// Verificar conexión una vez que el DOM esté listo y activar el banner si falla
document.addEventListener('DOMContentLoaded', () => {
    if (window.TurnosDB && typeof window.TurnosDB.ensureClient === 'function') {
        window.TurnosDB.ensureClient();
    }
}, { once: true });
