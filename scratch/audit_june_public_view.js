
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
    DEBUG_MODE: true
};

// Load dependencies
const rulesCode = fs.readFileSync(path.join(__dirname, '..', 'turnos-rules.js'), 'utf8');
eval(rulesCode);

// Simular resultado del resolved para Diana y Dani
const resolvedDiana = {
  "turno": "D",
  "turnoBase": "T",
  "origen": "INTERCAMBIO_TURNO",
  "cambio": true,
  "intercambio": true,
  "icon": "🔄",
  "icons": ["🔄"],
  "turnoFinal": "D",
  "isModified": true,
  "isAbsence": false,
  "estadoFinal": "DESCANSO"
};

const resolvedDani = {
  "turno": "T",
  "turnoBase": "D",
  "origen": "INTERCAMBIO_TURNO",
  "cambio": true,
  "intercambio": true,
  "icon": "🔄",
  "icons": ["🔄"],
  "turnoFinal": "T",
  "isModified": true,
  "isAbsence": false,
  "estadoFinal": "NORMAL"
};

// Simular cómo se guardaría en el snapshot (como hace buildPublicationSnapshotPreview)
const snapCellDiana = {
    label: resolvedDiana.turnoFinal || resolvedDiana.turno || '',
    code: resolvedDiana.turnoFinal || resolvedDiana.turno || '',
    icons: resolvedDiana.icons || [],
    type: resolvedDiana.incidencia || 'NORMAL',
    changed: !!resolvedDiana.cambio,
    isAbsence: !!resolvedDiana.incidencia,
    origen: resolvedDiana.origen || 'base'
};

const snapCellDani = {
    label: resolvedDani.turnoFinal || resolvedDani.turno || '',
    code: resolvedDani.turnoFinal || resolvedDani.turno || '',
    icons: resolvedDani.icons || [],
    type: resolvedDani.incidencia || 'NORMAL',
    changed: !!resolvedDani.cambio,
    isAbsence: !!resolvedDani.incidencia,
    origen: resolvedDani.origen || 'base'
};

console.log("--- SNAPSHOT CELL: Diana ---");
console.log(JSON.stringify(snapCellDiana, null, 2));
const displayDiana = window.TurnosRules.getPublicCellDisplay(snapCellDiana);
console.log("DISPLAY (Public Index):", displayDiana);

console.log("\n--- SNAPSHOT CELL: Dani ---");
console.log(JSON.stringify(snapCellDani, null, 2));
const displayDani = window.TurnosRules.getPublicCellDisplay(snapCellDani);
console.log("DISPLAY (Public Index):", displayDani);
