const fs = require('fs');

async function migrateVShifts() {
    const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co/rest/v1";
    const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

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
        if (method !== 'DELETE') return await response.json();
    };

    try {
        console.log("Obteniendo turnos con V...");
        const turnosV = await fetchSupabase("/turnos?turno=eq.V&select=id,fecha,hotel_id,empleado_id,turno");
        console.log(`Total turnos 'V': ${turnosV.length}`);
        
        if (turnosV.length === 0) {
            console.log("No hay turnos V que migrar.");
            return;
        }

        // Agrupar por empleado
        const byEmp = {};
        turnosV.forEach(t => {
            const emp = t.empleado_id;
            if (!byEmp[emp]) byEmp[emp] = [];
            byEmp[emp].push(t);
        });

        // Agrupar fechas contiguas en eventos
        const newEvents = [];
        const turnosToUpdate = [];

        for (const emp of Object.keys(byEmp)) {
            const turnos = byEmp[emp].sort((a, b) => a.fecha.localeCompare(b.fecha));
            
            let currentEvent = null;
            
            for (let i = 0; i < turnos.length; i++) {
                const t = turnos[i];
                turnosToUpdate.push(t.id);
                
                const d = new Date(t.fecha);
                if (!currentEvent) {
                    currentEvent = { 
                        tipo: 'VAC', 
                        estado: 'activo', 
                        empleado_id: emp, 
                        hotel_origen: t.hotel_id, 
                        fecha_inicio: t.fecha, 
                        fecha_fin: t.fecha,
                        observaciones: 'Migrado desde turnos base (código V)',
                        payload: { importado_v9: true, auto_migrado: true }
                    };
                } else {
                    const lastD = new Date(currentEvent.fecha_fin);
                    const diffDays = (d - lastD) / (1000 * 60 * 60 * 24);
                    if (diffDays === 1) {
                        currentEvent.fecha_fin = t.fecha;
                    } else {
                        newEvents.push(currentEvent);
                        currentEvent = { 
                            tipo: 'VAC', 
                            estado: 'activo', 
                            empleado_id: emp, 
                            hotel_origen: t.hotel_id, 
                            fecha_inicio: t.fecha, 
                            fecha_fin: t.fecha,
                            observaciones: 'Migrado desde turnos base (código V)',
                            payload: { importado_v9: true, auto_migrado: true }
                        };
                    }
                }
            }
            if (currentEvent) newEvents.push(currentEvent);
        }

        console.log(`Se generaron ${newEvents.length} eventos VAC potenciales.`);

        // Comprobar eventos existentes
        const existingEvents = await fetchSupabase("/eventos_cuadrante?tipo=eq.VAC&select=empleado_id,fecha_inicio,fecha_fin");
        
        const eventsToInsert = newEvents.filter(ne => {
            return !existingEvents.some(ee => 
                ee.empleado_id === ne.empleado_id &&
                ((ne.fecha_inicio >= ee.fecha_inicio && ne.fecha_inicio <= ee.fecha_fin) ||
                 (ne.fecha_fin >= ee.fecha_inicio && ne.fecha_fin <= ee.fecha_fin))
            );
        });

        console.log(`Se insertarán ${eventsToInsert.length} eventos VAC nuevos.`);
        
        // Ejecutar inserciones y actualizaciones si no estamos en dry run
        // Por precaución, haremos esto:
        if (eventsToInsert.length > 0) {
            await fetchSupabase("/eventos_cuadrante", "POST", eventsToInsert);
            console.log("Eventos insertados.");
        }

        // Update turnos (patch batch)
        if (turnosToUpdate.length > 0) {
            console.log(`Actualizando ${turnosToUpdate.length} turnos a '—'...`);
            // Supabase REST no soporta patch bulk con distintos IDs sin usar rpc o in.
            // Para cambiar TODOS los turno='V' a '—':
            await fetchSupabase("/turnos?turno=eq.V", "PATCH", { turno: '—' });
            console.log("Turnos actualizados.");
        }

    } catch (e) {
        console.error("Error:", e);
    }
}
migrateVShifts();
