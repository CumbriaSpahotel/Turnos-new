
const fs = require('fs');
const path = require('path');

// Mock Environment
global.window = {
    normalizeId: (id) => String(id || '').trim().toLowerCase(),
    normalizeTipo: (t) => {
        const v = String(t || '').replace(/[^\x00-\x7F]/g, '').trim().toUpperCase();
        if (v.startsWith('VAC')) return 'VAC';
        if (['BAJA', 'BAJA_MEDICA', 'BM', 'IT', 'INCAPACIDAD'].includes(v)) return 'BAJA';
        if (v.startsWith('PERM')) return 'PERM';
        if (v === 'CT' || v === 'CAMBIO_TURNO' || v === 'CAMBIO_DE_TURNO') return 'CAMBIO_TURNO';
        if (v === 'INTERCAMBIO' || v === 'INTERCAMBIO_TURNO') return 'INTERCAMBIO_TURNO';
        return v;
    },
    normalizeDate: (d) => String(d || '').split('T')[0],
    normalizeEstado: (s) => (['anulado', 'rechazado'].includes(String(s||'').toLowerCase()) ? 'anulado' : 'activo'),
    eventoAplicaEnFecha: (ev, f) => f === ev.fecha_inicio,
    getEventoHotel: (ev) => ev.hotel_origen || ev.hotel_id || '',
    eventoPerteneceAHotel: (ev, h) => window.normalizeId(window.getEventoHotel(ev)) === window.normalizeId(h),
    DEBUG_MODE: true
};

// Load shift-resolver.js
const resolverCode = fs.readFileSync(path.join(__dirname, '..', 'shift-resolver.js'), 'utf8');
eval(resolverCode);

// Test Data
const date = "2026-06-23";
const hotel = "Sercotel Guadiana";
const event = {
    "id": "c7cf2b97-0628-4fed-89c1-dfd150dad902",
    "tipo": "INTERCAMBIO_TURNO",
    "estado": "activo",
    "empleado_id": "Diana",
    "empleado_destino_id": "Dani",
    "hotel_origen": "Sercotel Guadiana",
    "fecha_inicio": "2026-06-23",
    "fecha_fin": "2026-06-23",
    "turno_original": "T",
    "turno_nuevo": "Descanso"
};

const dianaBase = "T";
const daniBase = "D";

const baseIndex = {
    porEmpleadoFecha: new Map([
        ["diana_" + date, dianaBase],
        ["dani_" + date, daniBase]
    ]),
    aliasesEmpleado: new Map()
};

console.log("--- DRY RUN: Diana ---");
const resDiana = window.resolveEmployeeDay({
    empleadoId: "Diana",
    hotel: hotel,
    fecha: date,
    turnoBase: dianaBase,
    eventos: [event],
    baseIndex: baseIndex
});
console.log(JSON.stringify(resDiana, null, 2));

console.log("\n--- DRY RUN: Dani ---");
const resDani = window.resolveEmployeeDay({
    empleadoId: "Dani",
    hotel: hotel,
    fecha: date,
    turnoBase: daniBase,
    eventos: [event],
    baseIndex: baseIndex
});
console.log(JSON.stringify(resDani, null, 2));
