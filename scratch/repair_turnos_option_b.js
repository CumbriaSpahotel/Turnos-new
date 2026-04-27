const fs = require('fs');

async function repair() {
    const SUPABASE_URL = 'https://drvmxranbpumianmlzqr.supabase.co/rest/v1';
    const SUPABASE_ANON_KEY = 'sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ';

    const fetchSupabase = async (path, method = 'GET', body = null) => {
        const url = new URL(`${SUPABASE_URL}${path}`);
        const options = {
            method,
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json'
            }
        };
        if (body) options.body = JSON.stringify(body);
        
        const response = await fetch(url.toString(), options);
        if (!response.ok) {
            const txt = await response.text();
            throw new Error(`HTTP error! status: ${response.status} msg: ${txt}`);
        }
        if (method !== 'DELETE') {
            const text = await response.text();
            return text ? JSON.parse(text) : null;
        }
    };

    try {
        console.log("1. Arreglando Valentín duplicado (con espacio)");
        // Los registros 'Valentín ' que ahora tienen '—' u otros.
        const valentinDupe = await fetchSupabase("/turnos?empleado_id=eq.Valent%C3%ADn%20&select=id");
        console.log("IDs a renombrar:", valentinDupe.length);
        if (valentinDupe.length > 0) {
            await fetchSupabase("/turnos?empleado_id=eq.Valent%C3%ADn%20", "PATCH", { empleado_id: '_DUP_Valentin' });
        }

        console.log("2. Arreglando CT de Miriam en turnos base");
        const miriamCT = await fetchSupabase("/turnos?empleado_id=eq.Miriam&turno=eq.CT&select=id");
        console.log("IDs de Miriam CT:", miriamCT.length);
        if (miriamCT.length > 0) {
            // Renombrar empleado_id para sacarla de la vista si no estaba programada, o simplemente turno="—"
            await fetchSupabase("/turnos?empleado_id=eq.Miriam&turno=eq.CT", "PATCH", { empleado_id: '_DUP_Miriam_CT', turno: '—' });
        }
        
        console.log("3. Arreglando cualquier otro CT en turnos base");
        const otrosCT = await fetchSupabase("/turnos?turno=eq.CT&select=id");
        console.log("Otros CT en base:", otrosCT.length);
        if (otrosCT.length > 0) {
            // Actualizarlos a "—" ya que CT no es un turno base válido
            await fetchSupabase("/turnos?turno=eq.CT", "PATCH", { turno: '—' });
        }

        console.log("Reparación completada.");
    } catch (e) {
        console.error(e);
    }
}

repair();
