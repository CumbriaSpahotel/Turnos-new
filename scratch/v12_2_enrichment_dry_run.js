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

async function dryRunV122() {
    const scope = [
        { hotel: "Cumbria Spa&Hotel", week: "2026-03-30" },
        { hotel: "Sercotel Guadiana", week: "2026-04-13" },
        { hotel: "Sercotel Guadiana", week: "2026-04-20" },
        { hotel: "Sercotel Guadiana", week: "2026-04-27" }
    ];

    let excelOrderRaw = [];
    try { excelOrderRaw = JSON.parse(fs.readFileSync("data/v9_excel_order_map.json", "utf8")); } catch(e){}

    console.log("--- DRY RUN MOTOR ENRIQUECIMIENTO V12.2 (REFINADO) ---");

    for (const item of scope) {
        const { hotel, week: weekStart } = item;
        const weekDates = [];
        let d = new Date(weekStart + "T12:00:00");
        for(let i=0; i<7; i++) { weekDates.push(d.toISOString().split("T")[0]); d.setDate(d.getDate()+1); }

        const { data: snaps } = await client.from("publicaciones_cuadrante").select("*").eq("hotel", hotel).eq("semana_inicio", weekStart).order("version", { ascending: true });
        let baseSnap = snaps.find(s => s.publicado_por !== "IA_V12_1_FINAL");
        
        let rows = [];
        if (baseSnap) {
            rows = baseSnap.snapshot_json.rows || baseSnap.snapshot_json.empleados || [];
        } else {
            console.log(`[${hotel} ${weekStart}] ⚠️ Sin snapshot base. Usando esqueleto de empleados.`);
            const { data: employees } = await client.from("empleados").select("nombre").eq("hotel_id", hotel).eq("estado_empresa", "activo");
            const { data: tbase } = await client.from("turnos").select("*").eq("hotel_id", hotel).gte("fecha", weekDates[0]).lte("fecha", weekDates[6]);
            
            rows = employees.map(e => {
                const cells = {};
                weekDates.forEach(f => {
                    const t = tbase.find(tb => tb.empleado_id === e.nombre && tb.fecha === f);
                    cells[f] = { code: t?.turno || "—" };
                });
                return { nombre: e.nombre, dias: cells };
            });
        }

        const { data: events } = await client.from("eventos_cuadrante").select("*").eq("hotel_origen", hotel).gte("fecha_inicio", weekDates[0]).lte("fecha_inicio", weekDates[6]);

        const inheritanceMap = {};
        events.forEach(e => {
            if (e.tipo === "VAC" || e.tipo === "BAJA" || e.tipo === "IT") {
                if (e.empleado_destino_id) inheritanceMap[`${e.fecha_inicio}::${e.empleado_destino_id}`] = { titular: e.empleado_id, evento_id: e.id };
            }
        });

        const orderLookup = {};
        excelOrderRaw.filter(o => o.hotel === hotel && o.week_start === weekStart).forEach(o => {
            orderLookup[o.empleado_nombre] = o.order % 100;
        });

        const enrichedRows = [];
        rows.forEach((oldRow, idx) => {
            const empName = oldRow.nombre;
            const newCells = {};
            let isAbsent = false;

            weekDates.forEach(f => {
                const k = `${f}::${empName}`;
                const ev = events.find(e => (e.empleado_id === empName || e.empleado_destino_id === empName) && e.fecha_inicio === f && e.estado === "activo");
                
                if (ev && ABSENCE_TYPES.has(ev.tipo)) {
                    newCells[f] = buildCell(ev.tipo, { origen: "EVENTO", icons: ["🏖️"] });
                    isAbsent = true;
                } else if (ev && (ev.tipo === "INTERCAMBIO_TURNO" || ev.tipo === "CAMBIO_TURNO")) {
                    let code = (ev.empleado_id === empName) ? ev.turno_nuevo : ev.turno_original;
                    if (!code || code === "CT") {
                        const partner = (ev.empleado_id === empName) ? ev.empleado_destino_id : ev.empleado_id;
                        const pRow = rows.find(r => r.nombre === partner);
                        code = (pRow?.dias || pRow?.cells || {})[f]?.code;
                    }
                    newCells[f] = buildCell(code, { origen: "EVENTO", icons: ["🔄"], changed: true });
                } else if (inheritanceMap[k]) {
                    const tRow = rows.find(r => r.nombre === inheritanceMap[k].titular);
                    newCells[f] = buildCell((tRow?.dias || tRow?.cells || {})[f]?.code, { origen: "SUSTITUCION" });
                } else {
                    const c = (oldRow.dias || oldRow.cells || {})[f];
                    newCells[f] = buildCell(c?.code || "—");
                }
            });

            let po = orderLookup[empName] || (Number(oldRow.puestoOrden) < 900 ? oldRow.puestoOrden : idx + 1);
            enrichedRows.push({ nombre: empName, puestoOrden: po, rowType: isAbsent ? "ausencia_informativa" : "operativa", dias: newCells });
        });

        const finalRows = [
            ...enrichedRows.filter(r => r.rowType === "operativa").sort((a,b) => a.puestoOrden - b.puestoOrden),
            ...enrichedRows.filter(r => r.rowType === "ausencia_informativa").sort((a,b) => a.puestoOrden - b.puestoOrden)
        ];

        console.log(`[${hotel} ${weekStart}] Resultado: ${finalRows.length} filas.`);
        const nat = finalRows.find(r => r.nombre.includes("Natalio"));
        if (nat) console.log(`   Natalio 27/04: ${nat.dias["2026-04-27"]?.code}`);
    }
}
dryRunV122();
