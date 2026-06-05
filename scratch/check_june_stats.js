const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

function parseLocalDate(isoStr) {
    if (!isoStr) return null;
    const [y, m, d] = String(isoStr).slice(0, 10).split('-').map(Number);
    if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
    return new Date(y, m - 1, d);
}

function formatLocalDate(date) {
    if (!date) return '';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function normalizeChangeReason(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[·\-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function groupShiftChangeRequests(changes) {
    if (!Array.isArray(changes) || changes.length === 0) return [];
    
    const items = changes.map(c => {
        const dateStr = c.fecha_inicio || c.fecha || '';
        const d = parseLocalDate(dateStr);
        const type = String(c.tipo || '').toUpperCase().includes('INTERCAMBIO') ? 'INTERCAMBIO_TURNO' : 'CAMBIO_TURNO';
        const reason = normalizeChangeReason(c.observaciones || c.payload?.motivo || '');
        const origin = String(c.empleado_id || '').toLowerCase().trim();
        const state = String(c.estado || '').toLowerCase();
        
        return {
            dateStr,
            date: d,
            type,
            reason,
            origin,
            state,
            originalEvent: c
        };
    }).filter(item => item.date !== null);
    
    if (items.length === 0) return [];
    
    items.sort((a, b) => a.date - b.date);
    
    const groups = [];
    let current = {
        from: items[0].dateStr,
        to: items[0].dateStr,
        fromDate: items[0].date,
        toDate: items[0].date,
        days: 1,
        type: items[0].type,
        reason: items[0].reason,
        origin: items[0].origin,
        state: items[0].state,
        events: [items[0].originalEvent]
    };
    
    for (let i = 1; i < items.length; i++) {
        const next = items[i];
        
        const oneDayLater = new Date(current.toDate);
        oneDayLater.setDate(oneDayLater.getDate() + 1);
        const isConsecutive = formatLocalDate(next.date) === formatLocalDate(oneDayLater);
        
        const isSameType = next.type === current.type;
        const isSameReason = next.reason === current.reason;
        const isSameOrigin = next.origin === current.origin;
        const isSameState = next.state === current.state;
        const isSameYear = next.date.getFullYear() === current.fromDate.getFullYear();
        
        if (isConsecutive && isSameType && isSameReason && isSameOrigin && isSameState && isSameYear) {
            current.toDate = next.date;
            current.to = next.dateStr;
            current.days += 1;
            current.events.push(next.originalEvent);
        } else {
            groups.push(current);
            current = {
                from: next.dateStr,
                to: next.dateStr,
                fromDate: next.date,
                toDate: next.date,
                days: 1,
                type: next.type,
                reason: next.reason,
                origin: next.origin,
                state: next.state,
                events: [next.originalEvent]
            };
        }
    }
    groups.push(current);
    
    return groups;
}

async function run() {
    // Range of window loaded for June 2026: 2026-05-15 to 2026-07-15
    const url = `${SUPABASE_URL}/rest/v1/eventos_cuadrante?or=(empleado_id.ilike.*Diana*,empleado_id.eq.EMP-0009,empleado_destino_id.ilike.*Diana*,empleado_destino_id.eq.EMP-0009)&fecha_inicio=gte.2026-05-15&fecha_inicio=lte.2026-07-15`;
    
    try {
        const response = await fetch(url, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });
        const events = await response.json();
        
        const isChangeType = (ev) => /CAMBIO|INTERCAMBIO|CT/.test(String(ev.tipo || '').toUpperCase());
        
        // Filter events for year 2026 (active/pending only)
        const yearChanges = events.filter(ev => {
            const start = String(ev.fecha_inicio || '').slice(0, 10);
            const end = String(ev.fecha_fin || start || '').slice(0, 10);
            const state = String(ev.estado || '').toLowerCase();
            return start && end && start <= "2026-12-31" && end >= "2026-01-01" && isChangeType(ev) && (state === 'activo' || state === 'pendiente');
        });
        
        const activeYearChanges = yearChanges.filter(ev => String(ev.estado || '').toLowerCase() === 'activo');
        const pendingYearChanges = yearChanges.filter(ev => String(ev.estado || '').toLowerCase() === 'pendiente');
        
        console.log("=== YEAR CHANGES LOADED IN JUN WINDOW ===");
        activeYearChanges.forEach(ev => {
            console.log(`- ${ev.fecha_inicio} (Tipo: ${ev.tipo}, Estado: ${ev.estado}, Motivo: ${ev.observaciones || ev.payload?.motivo})`);
        });
        
        const groupedRequests = groupShiftChangeRequests(activeYearChanges);
        const groupedPending = groupShiftChangeRequests(pendingYearChanges);
        
        const uniqueChangeDays = new Set();
        activeYearChanges.forEach(ev => {
            const s = parseLocalDate(ev.fecha_inicio);
            const e = parseLocalDate(ev.fecha_fin || ev.fecha_inicio);
            if (!s || !e) return;
            let curr = new Date(s);
            while (curr <= e) {
                uniqueChangeDays.add(formatLocalDate(curr));
                curr.setDate(curr.getDate() + 1);
            }
        });
        
        console.log(`\nGrouped active change requests: ${groupedRequests.length}`);
        console.log(`Total days affected: ${uniqueChangeDays.size}`);
        console.log(`Grouped pending requests: ${groupedPending.length}`);
        
    } catch (e) {
        console.error(e);
    }
}

run();
