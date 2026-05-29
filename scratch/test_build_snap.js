const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Load window shim for browser variables
global.window = {
  normalizeId: (v) => String(v || '').trim().toLowerCase(),
  normalizePersonKey: (v) => String(v || '').trim().toLowerCase(),
  normalizeDate: (v) => String(v || '').split(/[T ]/)[0],
  normalizeTipo: (v) => String(v || '').toUpperCase(),
  normalizeEstado: (v) => String(v || '').toLowerCase(),
  isPlaceholderId: () => false,
  getEmployeeStructuralType: () => 'fijo',
  isEmpleadoOcasionalOApoyo: () => false,
  isValidShiftValue: (v) => ["M","T","N","D","MANANA","TARDE","NOCHE","DESCANSO"].includes(String(v || '').toUpperCase()),
  isInvalidLegacyChangeValue: () => false,
  normalizeShiftValue: (v) => {
    const t = String(v || '').toUpperCase();
    if (t === 'M' || t === 'T' || t === 'N' || t === 'D') return t;
    return null;
  },
  getTurnoIcon: () => '',
  employeeNorm: (val) => String(val || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
  addIsoDays: (d, i) => {
    const base = new Date(d + 'T12:00:00');
    base.setDate(base.getDate() + i);
    const y = base.getFullYear();
    const m = String(base.getMonth() + 1).padStart(2, '0');
    const day = String(base.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  },
  getMonday: (d) => {
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  },
  isoDate: (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
};

// Load shift-resolver and turnos-rules
const resolverText = fs.readFileSync('shift-resolver.js', 'utf8');
eval(resolverText); // Populates global.window.resolveEmployeeDay etc.

const rulesText = fs.readFileSync('turnos-rules.js', 'utf8');
eval(rulesText); // Populates global.window.TurnosRules

// Load excel-loader
const XLSX = require('../xlsx.full.min.js');
global.window.XLSX = XLSX;
const loaderText = fs.readFileSync('excel-loader.js', 'utf8');
eval(loaderText); // Populates global.window.ExcelLoader

// Override loadExcelSourceRows for Node filesystem
global.window.ExcelLoader.loadExcelSourceRows = async () => {
  const fs = require('fs');
  const buf = fs.readFileSync('V.9-Turnos.xlsx');
  const workbook = XLSX.read(buf, { type: 'buffer', cellDates: true });
  const result = {};
  const HOTEL_SHEETS = ['Cumbria Spa&Hotel', 'Sercotel Guadiana'];
  HOTEL_SHEETS.forEach(hotel => {
    const sheet = workbook.Sheets[hotel];
    if (!sheet) return;
    const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true });
    result[hotel] = matrix.slice(1)
        .map((row, index) => ({
            hotel,
            rowIndex: index,
            weekStart: global.window.ExcelLoader.excelCellDate(row[0]),
            displayName: String(row[1] || '').trim(),
            empleadoId:  String(row[1] || '').trim(),
            values: [0, 1, 2, 3, 4, 5, 6].map(i =>
                global.window.ExcelLoader.shiftFromExcel(row[i + 2])
            )
        }))
        .filter(r => r.weekStart && r.empleadoId);
  });
  return result;
};

const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Mock window.supabase and TurnosDB
global.window.supabase = supabase;
global.window.TurnosDB = {
  client: supabase,
  fetchEventos: async (start, end) => {
    let q = supabase.from('eventos_cuadrante').select('*').or('estado.is.null,estado.neq.anulado');
    if (start && end) {
      q = q.lte('fecha_inicio', end).or(`fecha_fin.is.null,fecha_fin.gte.${start}`);
    }
    const { data } = await q;
    return data || [];
  },
  fetchRango: async (start, end) => {
    const { data } = await supabase.from('turnos').select('*').gte('fecha', start).lte('fecha', end);
    return data || [];
  },
  fetchRangoCalculado: async (start, end) => {
    const { data: rows } = await supabase.from('turnos').select('*').gte('fecha', start).lte('fecha', end);
    const { data: eventos } = await supabase.from('eventos_cuadrante').select('*').or('estado.is.null,estado.neq.anulado').lte('fecha_inicio', end).or(`fecha_fin.is.null,fecha_fin.gte.${start}`);
    return { rows, eventos };
  },
  getEmpleados: async () => {
    const { data } = await supabase.from('empleados').select('*');
    return data || [];
  },
  getHotels: async () => {
    return ['Cumbria Spa&Hotel', 'Sercotel Guadiana'];
  }
};

// Mock other admin.js functions
global.window.buildPuestoId = (h, i) => `${h}_${i}`;
global.window.getV9ExcelOrder = () => 500;
global.window.fmtDateLegacy = (d) => d;
global.window.loadV9ExcelOrderMap = () => {};
global.window.loadAdminExcelSourceRows = async () => {
  return global.window.ExcelLoader.loadExcelSourceRows();
};

// Now let's implement and execute buildPublicationSnapshotPreview and validatePublicationSnapshot
const adminText = fs.readFileSync('admin.js', 'utf8');

// We will extract createPuestosPreviewModel, buildPublicationSnapshotPreview, validatePublicationSnapshot from admin.js
const createPuestosPreviewModelCode = adminText.match(/window\.createPuestosPreviewModel\s*=\s*\(\{([\s\S]+?)\n\};/)[0];
eval(createPuestosPreviewModelCode);

const buildPublicationSnapshotPreviewCode = adminText.match(/window\.buildPublicationSnapshotPreview\s*=\s*async\s*\(weekStart,\s*hotelName\s*=\s*'all'\)\s*=>\s*\{([\s\S]+?)\n\};/)[0];
eval(buildPublicationSnapshotPreviewCode);

const validatePublicationSnapshotCode = adminText.match(/window\.validatePublicationSnapshot\s*=\s*async\s*\(snapshots\)\s*=>\s*\{([\s\S]+?)\n\};/)[0];
eval(validatePublicationSnapshotCode);

async function run() {
  const weekStart = '2026-06-01';
  console.log("Simulating buildPublicationSnapshotPreview for Cumbria and Guadiana...");
  const snaps = await global.window.buildPublicationSnapshotPreview(weekStart, 'all');
  
  console.log(`Generated ${snaps.length} snapshots:`);
  for (const snap of snaps) {
    console.log(`- Hotel: ${snap.hotel_nombre}`);
    const natalio = snap.rows.find(r => r.empleado_id === 'Natalio');
    if (natalio) {
      console.log(`  Natalio cells on 2026-06-01:`, JSON.stringify(natalio.cells['2026-06-01'], null, 2));
    } else {
      console.log(`  Natalio NOT found in ${snap.hotel_nombre}`);
    }
  }
  
  console.log("\nValidating snapshots...");
  const validation = await global.window.validatePublicationSnapshot(snaps);
  console.log("Validation result:", validation);
}

run().catch(console.error);
