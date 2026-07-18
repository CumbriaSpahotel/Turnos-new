const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Load window shim for browser variables
global.window = {
  normalizeId: (v) => {
    if (!v) return '';
    return String(v)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .replace(/\s+/g, ' ')
        .toLowerCase();
  },
  normalizePersonKey: (v) => {
    if (!v) return '';
    return String(v)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .replace(/\s+/g, ' ')
        .toLowerCase();
  },
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
  },
  detectarErrores: () => {},
  validarPreviewModel: () => {},
  loadV9ExcelOrderMap: () => {},
  fmtDateLegacy: (d) => d
};

// Load shift-resolver and turnos-rules
const resolverText = fs.readFileSync('shift-resolver.js', 'utf8');
eval(resolverText); // Populates global.window.resolveEmployeeDay etc.

const rulesText = fs.readFileSync('turnos-rules.js', 'utf8');
eval(rulesText); // Populates global.window.TurnosRules

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
global.window.buildPuestoId = (h, i) => `${h}::${String(i).padStart(3, '0')}`;
global.window.getV9ExcelOrder = () => 500;

// Browser loads excel source as {}
global.window.loadAdminExcelSourceRows = async () => {
  return {};
};

// Mock document.getElementById & selector
global.$ = (sel) => {
  if (sel === '#previewContent') return { set innerHTML(val) {} };
  return { value: 'Cumbria Spa&Hotel' };
};
global.document = {
  getElementById: (id) => {
    if (id === 'dateDisplay') return { set textContent(val) {} };
    return null;
  },
  createElement: () => ({ set innerHTML(val) {} })
};

const adminText = fs.readFileSync('admin.js', 'utf8');

// Extract createPuestosPreviewModel, renderPreview, buildPublicationSnapshotPreview, hasPendingPublicationChanges
const createPuestosPreviewModelCode = adminText.match(/window\.createPuestosPreviewModel\s*=\s*\(\{([\s\S]+?)\n\};/)[0];
eval(createPuestosPreviewModelCode);

const renderPreviewCode = adminText.match(/window\.renderPreview\s*=\s*async\s*\(\)\s*=>\s*\{([\s\S]+?)\n\};/)[0];
eval(renderPreviewCode);

const buildPublicationSnapshotPreviewCode = adminText.match(/window\.buildPublicationSnapshotPreview\s*=\s*async\s*\(weekStart,\s*hotelName\s*=\s*'all'\)\s*=>\s*\{([\s\S]+?)\n\};/)[0];
eval(buildPublicationSnapshotPreviewCode);

const hasPendingPublicationChangesCode = adminText.match(/window\.hasPendingPublicationChanges\s*=\s*async\s*function\s*\(\{([\s\S]+?)\n\};/)[0];
eval(hasPendingPublicationChangesCode);

async function run() {
  const weekStart = '2026-05-11';
  const weekEnd = '2026-05-17';
  global.window._previewDate = weekStart;
  global.window._previewMode = 'weekly';
  
  await global.window.renderPreview();
  const snaps = await global.window.buildPublicationSnapshotPreview(weekStart, 'Cumbria Spa&Hotel');
  
  console.log("Calling window.hasPendingPublicationChanges directly...");
  const pendingResult = await global.window.hasPendingPublicationChanges({
      weekStart,
      weekEnd,
      hotels: ['Cumbria Spa&Hotel'],
      snapshots: snaps
  });
  
  console.log("Result:", JSON.stringify(pendingResult, null, 2));
}

run().catch(console.error);
