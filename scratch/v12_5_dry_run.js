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
    if (extra.origen === "SUSTITUCION") {
        icons = icons.filter(i => i !== "🔄");
    }

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

async function dryRunV125() {
    const hotel = "Cumbria Spa&Hotel";
    const weekStart = "2026-05-18";
    const weekDates = ["2026-05-18", "2026-05-19", "2026-05-20", "2026-05-21", "2026-05-22", "2026-05-23", "2026-05-24"];

    console.log("--- DRY RUN V12.5: NO-ICON SUBSTITUTION (CUMBRIA 18/05) ---");

    const { data: tbase } = await client.from("turnos").select("*").eq("hotel_id", hotel).gte("fecha", weekDates[0]).lte("fecha", weekDates[6]);
    const { data: snaps } = await client.from("publicaciones_cuadrante").select("*").eq("hotel", hotel).eq("semana_inicio", weekStart).order("version", { ascending: false });
    
    let baseSnap = snaps.find(s => !s.publicado_por.startsWith("IA_V12"));
    let rows = baseSnap.snapshot_json.rows || baseSnap.snapshot_json.empleados || [];

    const { data: events } = await client.from("eventos_cuadrante").select("*").eq("hotel_origen", hotel).gte("fecha_inicio", weekDates[0]).lte("fecha_inicio", weekDates[6]).eq("estado", "activo");

    const activeSubstitutes = new Set();
    events.forEach(e => { if (ABSENCE_TYPES.has(e.tipo) && e.empleado_destino_id) activeSubstitutes.add(e.empleado_destino_id); });

    const enrichedRows = [];
    const processedAsSubstitute = new Set();

    rows.forEach((oldRow, idx) => {
        const empName = oldRow.nombre;
        if (activeSubstitutes.has(empName) && !processedAsSubstitute.has(empName)) return;

        const newCells = {};
        const infoCells = {};
        let hasSubstitution = false;
        let substituteName = null;

        weekDates.forEach(f => {
            const absEv = events.find(e => e.empleado_id === empName && e.fecha_inicio === f && ABSENCE_TYPES.has(e.tipo));
            const substEv = events.find(e => e.empleado_destino_id === empName && e.fecha_inicio === f && ABSENCE_TYPES.has(e.tipo));
            const exchEv = events.find(e => (e.empleado_id === empName || e.empleado_destino_id === empName) && e.fecha_inicio === f && (e.tipo === "INTERCAMBIO_TURNO" || e.tipo === "CAMBIO_TURNO"));

            if (absEv) {
                infoCells[f] = buildCell(absEv.tipo, { origen: "EVENTO", icons: ["🏖️"] });
                if (absEv.empleado_destino_id) {
                    hasSubstitution = true;
                    substituteName = absEv.empleado_destino_id;
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
            } else if (exchEv) {
                let code = (exchEv.empleado_id === empName) ? exchEv.turno_nuevo : exchEv.turno_original;
                if (!code || code === "CT") {
                    const partner = (exchEv.empleado_id === empName) ? exchEv.empleado_destino_id : exchEv.empleado_id;
                    const t = tbase.find(tb => tb.empleado_id === partner && tb.fecha === f);
                    code = t?.turno;
                }
                newCells[f] = buildCell(code, { origen: "EVENTO", icons: ["🔄"], changed: true });
                infoCells[f] = buildCell(code, { origen: "BASE" });
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

        if (hasSubstitution) {
            enrichedRows.push({ nombre: substituteName, rowType: "operativa", dias: newCells, titularOriginal: empName });
            enrichedRows.push({ nombre: empName, rowType: "ausencia_informativa", dias: infoCells });
        } else {
            enrichedRows.push({ nombre: empName, rowType: "operativa", dias: newCells });
        }
    });

    const miriam = enrichedRows.find(r => r.nombre === "Miriam");
    console.log("MIRIAM V12.5 (Simulada):", JSON.stringify(miriam.dias, null, 2));
}
dryRunV125();
