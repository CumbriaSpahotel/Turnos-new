const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

// Helpers replicated from admin.js
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

function mergeVacationRanges(vacations) {
    if (!Array.isArray(vacations) || vacations.length === 0) return [];
    
    const items = vacations.map(ev => {
        const start = parseLocalDate(ev.fecha_inicio || ev.desde || ev.fecha);
        const end = parseLocalDate(ev.fecha_fin || ev.hasta || ev.fecha_inicio || ev.fecha);
        if (!start || !end) return null;
        
        const p = ev.payload || {};
        const groupKeys = {
            requestId: ev.id || ev.peticion_id || p.peticion_id || p.requestId || '',
            batchId: p.batchId || p.batch_id || '',
            groupId: p.groupId || p.group_id || '',
            agrupado: ev.isGroup || p.isGroup || p.agrupado || p.importado_v9 || false,
            createdBy: ev.created_by || ev.updated_by || ''
        };
        
        return {
            start,
            end,
            groupKeys,
            originalEvents: [ev]
        };
    }).filter(Boolean);
    
    if (items.length === 0) return [];
    
    items.sort((a, b) => {
        const diff = a.start - b.start;
        if (diff !== 0) return diff;
        return b.end - a.end;
    });
    
    const merged = [];
    let current = items[0];
    
    for (let i = 1; i < items.length; i++) {
        const next = items[i];
        
        const diffDays = Math.round((next.start - current.end) / 86400000);
        
        let shouldMerge = false;
        if (diffDays <= 0) {
            shouldMerge = true;
        } else if (diffDays === 1) {
            const keyA = current.groupKeys;
            const keyB = next.groupKeys;
            
            const sameRequest = keyA.requestId && keyA.requestId === keyB.requestId;
            const sameBatch = keyA.batchId && keyA.batchId === keyB.batchId;
            const sameGroup = keyA.groupId && keyA.groupId === keyB.groupId;
            const bothGrouped = keyA.agrupado || keyB.agrupado;
            const sameCreator = keyA.createdBy && keyA.createdBy === keyB.createdBy;
            
            if (sameRequest || sameBatch || sameGroup || bothGrouped || sameCreator) {
                shouldMerge = true;
            }
        }
        
        if (shouldMerge) {
            current.end = new Date(Math.max(current.end, next.end));
            current.originalEvents.push(...next.originalEvents);
            if (next.groupKeys.requestId) current.groupKeys.requestId = next.groupKeys.requestId;
            if (next.groupKeys.batchId) current.groupKeys.batchId = next.groupKeys.batchId;
            if (next.groupKeys.groupId) current.groupKeys.groupId = next.groupKeys.groupId;
            if (next.groupKeys.agrupado) current.groupKeys.agrupado = true;
        } else {
            merged.push(current);
            current = next;
        }
    }
    merged.push(current);
    
    return merged.map(item => {
        const days = Math.round((item.end - item.start) / 86400000) + 1;
        const mainEvent = item.originalEvents[0];
        return {
            ...mainEvent,
            fecha_inicio: formatLocalDate(item.start),
            fecha_fin: formatLocalDate(item.end),
            days,
            isGroup: item.originalEvents.length > 1,
            ids: item.originalEvents.map(e => e.id).filter(Boolean),
            estado: mainEvent.estado || 'activo'
        };
    });
}

function expandVacationDays(ranges) {
    const dates = new Set();
    if (!Array.isArray(ranges)) return dates;
    ranges.forEach(r => {
        const start = parseLocalDate(r.fecha_inicio);
        const end = parseLocalDate(r.fecha_fin || r.fecha_inicio);
        if (!start || !end) return;
        let curr = new Date(start);
        while (curr <= end) {
            dates.add(formatLocalDate(curr));
            curr.setDate(curr.getDate() + 1);
        }
    });
    return dates;
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
    const activeChanges = (changes || []).filter(c => {
        const estado = String(c.estado || '').toLowerCase();
        return estado === 'activo';
    });
    
    if (activeChanges.length === 0) return [];
    
    const items = activeChanges.map(c => {
        const dateStr = c.fecha_inicio || c.fecha || '';
        const d = parseLocalDate(dateStr);
        const type = String(c.tipo || '').toUpperCase().includes('INTERCAMBIO') ? 'INTERCAMBIO_TURNO' : 'CAMBIO_TURNO';
        const reason = normalizeChangeReason(c.observaciones || c.payload?.motivo || '');
        const origin = String(c.empleado_id || '').toLowerCase().trim();
        
        return {
            dateStr,
            date: d,
            type,
            reason,
            origin,
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
        status: 'activo',
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
        
        if (isConsecutive && isSameType && isSameReason && isSameOrigin) {
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
                status: 'activo',
                events: [next.originalEvent]
            };
        }
    }
    groups.push(current);
    
    return groups;
}

async function verifyDiana() {
    const url = `${SUPABASE_URL}/rest/v1/eventos_cuadrante?or=(empleado_id.ilike.*Diana*,empleado_id.eq.EMP-0009,empleado_destino_id.ilike.*Diana*,empleado_destino_id.eq.EMP-0009)`;
    
    try {
        const response = await fetch(url, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });
        const events = await response.json();
        
        // Filter events for year 2026 and employee Diana (active only)
        const isVacationEvent = (ev) => String(ev.tipo || '').toUpperCase().includes('VAC');
        const isChangeType = (ev) => /CAMBIO|INTERCAMBIO|CT/.test(String(ev.tipo || '').toUpperCase());
        
        const rawVacs2026 = events.filter(ev => {
            const start = String(ev.fecha_inicio || '').slice(0, 10);
            const end = String(ev.fecha_fin || start || '').slice(0, 10);
            const state = String(ev.estado || '').toLowerCase();
            return start && end && start <= "2026-12-31" && end >= "2026-01-01" && isVacationEvent(ev) && state !== 'anulado';
        });
        
        const rawChanges2026 = events.filter(ev => {
            const start = String(ev.fecha_inicio || '').slice(0, 10);
            const end = String(ev.fecha_fin || start || '').slice(0, 10);
            const state = String(ev.estado || '').toLowerCase();
            return start && end && start <= "2026-12-31" && end >= "2026-01-01" && isChangeType(ev) && state !== 'anulado';
        });
        
        console.log("=== RAW VACATIONS 2026 ===");
        rawVacs2026.forEach(ev => {
            console.log(`- ${ev.fecha_inicio} to ${ev.fecha_fin || ev.fecha_inicio} (${ev.estado})`);
        });
        
        const mergedVacs = mergeVacationRanges(rawVacs2026);
        console.log("\n=== CONSOLIDATED VACATIONS ===");
        mergedVacs.forEach(mv => {
            console.log(`- ${mv.fecha_inicio} to ${mv.fecha_fin} (${mv.days} days)`);
        });
        
        const uniqueVacs = expandVacationDays(mergedVacs);
        console.log(`\nUnique Vacation Days Count: ${uniqueVacs.size}`);
        console.log(`Derecho Anual: 44`);
        console.log(`Saldo Neto: ${44 - uniqueVacs.size}`);
        
        console.log("\n=== RAW CHANGES 2026 ===");
        rawChanges2026.forEach(ev => {
            console.log(`- ${ev.fecha_inicio} (Tipo: ${ev.tipo}, Estado: ${ev.estado}, Motivo: ${ev.observaciones})`);
        });
        
        const activeChanges = rawChanges2026.filter(ev => {
            const state = String(ev.estado || '').toLowerCase();
            return state !== 'pendiente' && state !== 'anulado' && state !== 'rechazado' && state !== 'cancelado';
        });
        
        const groupedChanges = groupShiftChangeRequests(activeChanges);
        console.log("\n=== GROUPED CHANGE REQUESTS ===");
        groupedChanges.forEach(gc => {
            console.log(`- From ${gc.from} to ${gc.to} (${gc.days} days affected) - Reason: "${gc.reason}"`);
        });
        
        const uniqueChangeDays = new Set();
        activeChanges.forEach(ev => {
            const s = parseLocalDate(ev.fecha_inicio);
            const e = parseLocalDate(ev.fecha_fin || ev.fecha_inicio);
            if (!s || !e) return;
            let curr = new Date(s);
            while (curr <= e) {
                uniqueChangeDays.add(formatLocalDate(curr));
                curr.setDate(curr.getDate() + 1);
            }
        });
        
        console.log(`\nGrouped change requests: ${groupedChanges.length}`);
        console.log(`Total days affected: ${uniqueChangeDays.size}`);
        
    } catch (error) {
        console.error("Error in verification:", error);
    }
}

verifyDiana();
