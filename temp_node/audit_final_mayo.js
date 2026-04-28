const { createClient } = require('@supabase/supabase-js');
const client = createClient('https://drvmxranbpumianmlzqr.supabase.co','sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ');

function isValidPublicSnapshot(snapshot) {
    if (!snapshot) return false;
    const data = snapshot.snapshot_json || snapshot.data || snapshot;
    const emps = data.empleados || data.rows || [];
    if (!Array.isArray(emps) || emps.length === 0) return false;

    // 1. VALIDACIÓN ESTRUCTURAL
    const orders = emps.map(e => Number(e.puestoOrden || e.orden || 9999));
    const all999 = orders.every(o => o === 999);
    if (all999) return false;

    const baseRows = emps.filter(e => e.rowType !== 'extra' && e.rowType !== 'refuerzo');
    const hasValidBaseOrder = baseRows.length > 0 && baseRows.every(e => {
        const po = Number(e.puestoOrden || e.orden || 9999);
        return po < 900;
    });
    if (!hasValidBaseOrder) return false;

    if (emps.some(e => (e.nombreVisible || e.nombre || "").includes("_DUP"))) return false;

    // 2. VALIDACIÓN SEMÁNTICA
    for (const emp of emps) {
        const cells = emp.dias || emp.cells || {};
        let hasAnyIncidenceInRow = false;
        for (const fecha in cells) {
            const c = cells[fecha];
            const type = (c.type || "").toUpperCase();
            const code = (c.code || "").toUpperCase().trim();
            if (["VAC", "BAJA", "IT", "PERM", "PERMISO", "FORM"].includes(type)) {
                hasAnyIncidenceInRow = true;
                if (!code || code === "—" || code === "" || code === "-") return false;
                if (type === "VAC" && !code.includes("VAC")) return false;
                if (["BAJA", "IT"].includes(type) && (!code.includes("BAJA") && !code.includes("IT"))) return false;
            }
        }
        
        const isBase = !emp.rowType || (emp.rowType !== 'extra' && emp.rowType !== 'refuerzo');
        if (isBase) {
            const codes = Object.values(cells).map(c => String(c.code || '').trim());
            const allEmpty = codes.every(code => code === '' || code === '—' || code === '-');
            if (allEmpty) return false;
        }

        if (emp.rowType === 'ausencia_informativa' && !hasAnyIncidenceInRow) return false;
    }
    return true;
}

async function runAudit() {
    const { data } = await client
        .from('publicaciones_cuadrante')
        .select('*')
        .gte('semana_inicio','2026-04-20')
        .lte('semana_inicio','2026-05-25');

    const weeks = ['2026-04-20','2026-04-27','2026-05-04','2026-05-11','2026-05-18','2026-05-25'];
    const hotels = ['Cumbria Spa&Hotel', 'Sercotel Guadiana'];

    console.log('| Semana | Hotel | Versión Elegida | Motivo |');
    console.log('|---|---|---|---|');

    weeks.forEach(w => {
        hotels.forEach(h => {
            const versions = data.filter(s => s.semana_inicio === w && s.hotel === h);
            if (!versions.length) return;
            
            const validOnes = versions.filter(isValidPublicSnapshot).sort((a,b)=>b.version - a.version);
            const chosen = validOnes.length ? validOnes[0].version : 'NINGUNA';
            
            let reason = '';
            if (chosen === 'NINGUNA') {
                reason = 'Sin versiones válidas (Falla Orden o VAC)';
            } else {
                const maxV = Math.max(...versions.map(v=>v.version));
                reason = chosen === maxV ? 'Máxima versión sana' : `v${maxV} inválida, se usa v${chosen}`;
            }

            console.log(`| ${w} | ${h} | ${chosen} | ${reason} |`);
        });
    });
}

runAudit();
