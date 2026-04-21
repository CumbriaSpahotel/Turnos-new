const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

window.supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
if (window.TurnosDB) window.TurnosDB.client = window.supabase;
