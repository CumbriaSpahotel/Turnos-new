
// CHAIN RESOLUTION TEST (A -> B -> C)
global.window = {};
window.normalizeId = (id) => String(id || '').toLowerCase().trim();
window.normalizeDate = (d) => String(d || '').slice(0, 10);
window.normalizeTipo = (t) => String(t || '').toUpperCase().trim();
window.normalizeEstado = (e) => String(e || 'activo').toLowerCase().trim();
window.eventoAplicaEnFecha = (ev, date) => true;

// Mock getOperationalOccupant from shift-resolver.js
window.getOperationalOccupant = (empId, date, events, hotel, context = {}) => {
    const normId = window.normalizeId(empId);
    if (!normId) return null;
    
    const maps = context.baseIndex || context;
    if (maps.operationalOccupantByOriginalEmployeeId) {
        const dayMap = maps.operationalOccupantByOriginalEmployeeId.get(date);
        if (dayMap && dayMap.has(normId)) {
            const sustId = dayMap.get(normId);
            return window.getOperationalOccupant(sustId, date, events, hotel, context);
        }
        return normId;
    }
    return normId;
};

const date = '2026-06-01';
const opMap = new Map();
const dMap = new Map();

// Chain: A is substituted by B, B is substituted by C
dMap.set('a', 'b');
dMap.set('b', 'c');
opMap.set(date, dMap);

const context = { operationalOccupantByOriginalEmployeeId: opMap };

console.log('--- CHAIN RESOLUTION TEST ---');
console.log('Titular A resolves to:', window.getOperationalOccupant('A', date, [], 'hotel', context));
console.log('Titular B resolves to:', window.getOperationalOccupant('B', date, [], 'hotel', context));
console.log('Titular C resolves to:', window.getOperationalOccupant('C', date, [], 'hotel', context));

// Test Diana -> sin asignar
dMap.set('dani', 'sin asignar');
console.log('\n--- DIANA/DANI CASE ---');
console.log('Dani resolves to:', window.getOperationalOccupant('Dani', date, [], 'hotel', context));
