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

async function verifyVacationsOnly() {
    const url = `${SUPABASE_URL}/rest/v1/eventos_cuadrante?or=(empleado_id.ilike.*Diana*,empleado_id.eq.EMP-0009)`;
    
    try {
        const response = await fetch(url, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });
        const events = await response.json();
        
        const isVacationEvent = (ev) => String(ev.tipo || '').toUpperCase().includes('VAC');
        
        const rawVacs2026 = events.filter(ev => {
            const start = String(ev.fecha_inicio || '').slice(0, 10);
            const end = String(ev.fecha_fin || start || '').slice(0, 10);
            const state = String(ev.estado || '').toLowerCase();
            return start && end && start <= "2026-12-31" && end >= "2026-01-01" && isVacationEvent(ev) && state !== 'anulado';
        });
        
        const mergedVacs = mergeVacationRanges(rawVacs2026);
        console.log("=== CONSOLIDATED VACATIONS ===");
        mergedVacs.forEach(mv => {
            console.log(`- Range: ${mv.fecha_inicio} to ${mv.fecha_fin} (${mv.days} days)`);
        });
        
    } catch (e) {
        console.error(e);
    }
}

verifyVacationsOnly();
