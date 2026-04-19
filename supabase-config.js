// ══════════════════════════════════════════════
// SUPABASE CONFIGURATION — TurnosWeb Project
// ══════════════════════════════════════════════

// URL exacta de tu proyecto
const supabaseUrl = 'https://drvmxranbpumianmlzqr.supabase.co';

// 🔑 CLAVE PUBLICABLE FINAL (Verificada)
const supabaseKey = 'sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ';

// Inicializar cliente y exponerlo globalmente
if (typeof supabase !== 'undefined' && window.supabase.createClient) {
    window.supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
    console.log("Supabase inicializado correctamente.");
} else {
    console.error("Supabase SDK no está cargada correctamente.");
}
