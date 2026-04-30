const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");

const client = createClient("https://drvmxranbpumianmlzqr.supabase.co", "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ");

const ABSENCE_TYPES = new Set(["VAC", "BAJA", "IT", "PERM", "PERMISO", "FORM"]);
const TURNO_LABELS = { "M": "Mañana", "T": "Tarde", "N": "Noche", "D": "Descanso", "VAC": "Vacaciones", "BAJA": "Baja", "PERM": "Permiso", "FORM": "Formación" };

function buildCell(code, extra = {}) {
    let c = String(code || "").toUpperCase().trim();
    if (c === "MAÑANA" || c === "MANANA") c = "M";
    if (c === "TARDE") c = "T";
    if (c === "NOCHE") c = "N";
    if (c === "DESCANSO") c = "D";
    if (c.startsWith("VAC")) c = "VAC";
    else if (c.startsWith("BAJA") || c.startsWith("IT")) c = "BAJA";
    else if (c.startsWith("PERM")) c = "PERM";

    const isAbsence = ABSENCE_TYPES.has(c);
    let icons = extra.icons || [];
    if (extra.origen === "SUSTITUCION") icons = icons.filter(i => i !== "🔄");

    return {
        code: c || "—",
        label: TURNO_LABELS[c] || (c || "—"),
        type: isAbsence ? c : "NORMAL",
        estado: "operativo",
        origen: extra.origen || "BASE",
        icons: icons,
        changed: !!extra.changed,
        evento_id: extra.evento_id || null,
        sustituto: extra.sustituto || null,
        titular_cubierto: extra.titular_cubierto || null
    };
}

async function publishV125Fixed() {
    // Solo Sercotel 15/06 para esta prueba específica
    const scope = [
        { hotel: "Sercotel Guadiana", week: "2026-06-15" }
    ];

    let excelOrderRaw = [];
    try { excelOrderRaw = JSON.parse(fs.readFileSync("data/v9_excel_order_map.json", "utf8")); } catch(e){}

    console.log("--- RE-PUBLICACIÓN V12.5: REGLA PENDIENTE (SERCOTEL 15/06) ---");

    for (const item of scope) {
        const { hotel, week: weekStart } = item;
        const weekDates = [];
        let d = new Date(weekStart + "T12:00:00");
        for(let i=0; i<7; i++) { weekDates.push(d.toISOString().split("T")[0]); d.setDate(d.getDate()+1); }

        const { data: tbase } = await client.from("turnos").select("*").eq("hotel_id", hotel).gte("fecha", weekDates[0]).lte("fecha", weekDates[6]);
        const { data: snaps } = await client.from("publicaciones_cuadrante").select("*").eq("hotel", hotel).eq("semana_inicio", weekStart).order("version", { ascending: false });
        
        let baseSnap = snaps.find(s => !s.publicado_por.startsWith("IA_V12"));
        let rows = baseSnap.snapshot_json.rows || baseSnap.snapshot_json.empleados || [];

        const { data: events } = await client.from("eventos_cuadrante").select("*").eq("hotel_origen", hotel).gte("fecha_inicio", weekDates[0]).lte("fecha_inicio", weekDates[6]).eq("estado", "activo");

        const activeSubstitutes = new Set();
        events.forEach(e => { if (ABSENCE_TYPES.has(e.tipo) && e.empleado_destino_id) activeSubstitutes.add(e.empleado_destino_id); });

        const orderLookup = {};
        excelOrderRaw.filter(o => o.hotel === hotel && o.week_start === weekStart).forEach(o => {
            orderLookup[o.empleado_nombre] = o.order % 1000;
        });

        const enrichedRows = [];
        const processedAsSubstitute = new Set();

        rows.forEach((oldRow, idx) => {
            let empName = oldRow.nombre;
            
            // REGLA ESPECIAL V12.5: Si el nombre base es Carlitos pero no está en el mapa operativo,
            // y el usuario dice que es Pendiente, lo forzamos a Pendiente si no tiene eventos.
            if (empName === "Carlitos" && !orderLookup[empName]) {
                empName = "Pendiente";
            }

            if (activeSubstitutes.has(empName) && !processedAsSubstitute.has(empName)) return;

            const newCells = {};
            const infoCells = {};
            let hasSubstitution = false;
            let substituteName = null;

            weekDates.forEach(f => {
                const absEv = events.find(e => e.empleado_id === empName && e.fecha_inicio === f && ABSENCE_TYPES.has(e.tipo));
                const substEv = events.find(e => (e.empleado_destino_id === empName || (empName === "Pendiente" && e.empleado_destino_id === "¿?")) && e.fecha_inicio === f && ABSENCE_TYPES.has(e.tipo));
                
                if (absEv) {
                    infoCells[f] = buildCell(absEv.tipo, { origen: "EVENTO", icons: ["🏖️"] });
                    if (absEv.empleado_destino_id) {
                        hasSubstitution = true;
                        substituteName = absEv.empleado_destino_id === "¿?" ? "Pendiente" : absEv.empleado_destino_id;
                        processedAsSubstitute.add(substituteName);
                        const t = tbase.find(tb => tb.empleado_id === empName && tb.fecha === f);
                        newCells[f] = buildCell(t?.turno, { origen: "SUSTITUCION", icons: [] }); 
                    } else {
                        newCells[f] = buildCell(absEv.tipo, { origen: "EVENTO", icons: ["🏖️"] });
                    }
                } else if (substEv) {
                    const titName = substEv.empleado_id;
                    const t = tbase.find(tb => tb.empleado_id === titName && tb.fecha === f);
                    newCells[f] = buildCell(t?.turno, { origen: "SUSTITUCION", icons: [] }); 
                    infoCells[f] = buildCell(t?.turno, { origen: "BASE" });
                } else {
                    const c = (oldRow.dias || oldRow.cells || {})[f];
                    let code = c?.code;
                    if (!code || code === "—") {
                        const t = tbase.find(tb => tb.empleado_id === empName && tb.fecha === f);
                        code = t?.turno;
                    }
                    newCells[f] = buildCell(code || "—");
                    infoCells[f] = buildCell(code || "—");
                }
            });

            const po = orderLookup[empName] || oldRow.puestoOrden || (idx + 1);

            if (hasSubstitution) {
                enrichedRows.push({ nombre: substituteName, nombreVisible: substituteName, puestoOrden: po, rowType: "operativa", dias: newCells, titularOriginal: empName, ocupanteVisible: substituteName });
                enrichedRows.push({ nombre: empName, nombreVisible: empName, puestoOrden: po, rowType: "ausencia_informativa", dias: infoCells });
            } else {
                enrichedRows.push({ nombre: empName, nombreVisible: empName, puestoOrden: po, rowType: "operativa", dias: newCells });
            }
        });

        const finalRows = [
            ...enrichedRows.filter(r => r.rowType === "operativa").sort((a,b) => a.puestoOrden - b.puestoOrden),
            ...enrichedRows.filter(r => r.rowType === "ausencia_informativa").sort((a,b) => a.puestoOrden - b.puestoOrden)
        ].map(r => ({ ...r, cells: r.dias }));

        const record = {
            hotel, semana_inicio: weekStart, semana_fin: weekDates[6],
            snapshot_json: { hotel, semana_inicio: weekStart, rows: finalRows, empleados: finalRows },
            version: 123, // Version incrementada para corregir v121/v122
            estado: "activo",
            publicado_por: "IA_V12_5_PENDIENTE_FIX",
            resumen: { source: "admin_preview_resolved_v12_5", pendiente_fix_confirmed: true }
        };

        const { data: insData, error: insErr } = await client.from("publicaciones_cuadrante").insert([record]).select();
        if (insErr) console.error("❌ ERROR:", insErr);
        else console.log(`✅ PUBLICADO V12.5 FIX PARA ${weekStart}. ID: ${insData[0].id}`);
    }
}
publishV125Fixed();
