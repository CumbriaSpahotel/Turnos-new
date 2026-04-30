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
    return {
        code: c || "—",
        label: TURNO_LABELS[c] || (c || "—"),
        type: isAbsence ? c : "NORMAL",
        estado: "operativo",
        origen: extra.origen || "BASE",
        icons: extra.icons || [],
        changed: !!extra.changed,
        evento_id: extra.evento_id || null,
        sustituto: extra.sustituto || null,
        titular_cubierto: extra.titular_cubierto || null
    };
}

async function dryRunV123() {
    const hotel = "Sercotel Guadiana";
    const weekStart = "2026-04-27";
    const weekDates = ["2026-04-27", "2026-04-28", "2026-04-29", "2026-04-30", "2026-05-01", "2026-05-02", "2026-05-03"];

    const { data: tbase } = await client.from("turnos").select("*").eq("hotel_id", hotel).gte("fecha", weekDates[0]).lte("fecha", weekDates[6]);

    const { data: snaps } = await client.from("publicaciones_cuadrante").select("*").eq("hotel", hotel).eq("semana_inicio", weekStart).order("version", { ascending: true });
    let baseSnap = snaps[0];
    let rows = baseSnap.snapshot_json.rows || baseSnap.snapshot_json.empleados || [];

    const { data: events } = await client.from("eventos_cuadrante").select("*").eq("hotel_origen", hotel).gte("fecha_inicio", weekDates[0]).lte("fecha_inicio", weekDates[6]).eq("estado", "activo");

    const enrichedRows = [];

    rows.forEach((oldRow, idx) => {
        const empName = oldRow.nombre;
        const newCells = {};
        let forcedInformativa = false;

        weekDates.forEach(f => {
            const absenceEvent = events.find(e => e.empleado_id === empName && e.fecha_inicio === f && ABSENCE_TYPES.has(e.tipo));
            const substitutionEvent = events.find(e => e.empleado_destino_id === empName && e.fecha_inicio === f && ABSENCE_TYPES.has(e.tipo));
            const exchangeEvent = events.find(e => (e.empleado_id === empName || e.empleado_destino_id === empName) && e.fecha_inicio === f && (e.tipo === "INTERCAMBIO_TURNO" || e.tipo === "CAMBIO_TURNO"));

            if (absenceEvent) {
                newCells[f] = buildCell(absenceEvent.tipo, { origen: "EVENTO", icons: ["🏖️"] });
                if (absenceEvent.empleado_destino_id) forcedInformativa = true;
            } else if (substitutionEvent) {
                const titName = substitutionEvent.empleado_id;
                const titRow = rows.find(r => r.nombre === titName);
                let code = (titRow?.dias || titRow?.cells || {})[f]?.code;
                
                // FALLBACK A TABLA TURNOS SI EL TITULAR ESTÁ VACÍO EN EL SNAPSHOT
                if (!code || code === "—") {
                    const t = tbase.find(tb => tb.empleado_id === titName && tb.fecha === f);
                    code = t?.turno;
                }
                newCells[f] = buildCell(code, { origen: "SUSTITUCION", icons: ["🔄"] });
            } else if (exchangeEvent) {
                let code = (exchangeEvent.empleado_id === empName) ? exchangeEvent.turno_nuevo : exchangeEvent.turno_original;
                if (!code || code === "CT") {
                   const partner = (exchangeEvent.empleado_id === empName) ? exchangeEvent.empleado_destino_id : exchangeEvent.empleado_id;
                   const pRow = rows.find(r => r.nombre === partner);
                   code = (pRow?.dias || pRow?.cells || {})[f]?.code;
                   if (!code || code === "—") {
                       const t = tbase.find(tb => tb.empleado_id === partner && tb.fecha === f);
                       code = t?.turno;
                   }
                }
                newCells[f] = buildCell(code, { origen: "EVENTO", icons: ["🔄"], changed: true });
            } else {
                const c = (oldRow.dias || oldRow.cells || {})[f];
                newCells[f] = buildCell(c?.code || "—");
            }
        });

        enrichedRows.push({
            nombre: empName,
            puestoOrden: oldRow.puestoOrden || (idx + 1),
            rowType: forcedInformativa ? "ausencia_informativa" : "operativa",
            dias: newCells
        });
    });

    console.log("RESULTADOS SIMULADOS V12.3:");
    const nat = enrichedRows.find(r => r.nombre === "Natalio");
    const ser = enrichedRows.find(r => r.nombre === "Sergio Sánchez");
    console.log(`Natalio [${nat.rowType}] 28/04: ${JSON.stringify(nat.dias["2026-04-28"])}`);
    console.log(`Sergio  [${ser.rowType}] 28/04: ${JSON.stringify(ser.dias["2026-04-28"])}`);
}
dryRunV123();
