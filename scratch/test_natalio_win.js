const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

global.window = {
  window: null, // to be assigned
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
global.window.window = global.window;

const resolverText = fs.readFileSync('shift-resolver.js', 'utf8');
eval(resolverText);
const rulesText = fs.readFileSync('turnos-rules.js', 'utf8');
eval(rulesText);

const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

global.window.supabase = supabase;
global.window.TurnosDB = {
  client: supabase
};
global.window.buildPuestoId = (h, i) => `${h}::${String(i).padStart(3, '0')}`;
global.window.getV9ExcelOrder = () => 500;
global.window.loadAdminExcelSourceRows = async () => ({});

const adminText = fs.readFileSync('admin.js', 'utf8');
const createPuestosPreviewModelCode = adminText.match(/window\.createPuestosPreviewModel\s*=\s*\(\{([\s\S]+?)\n\};/)[0];
eval(createPuestosPreviewModelCode);

const hasPendingPublicationChangesCode = adminText.match(/window\.hasPendingPublicationChanges\s*=\s*async\s*function\s*\(\{([\s\S]+?)\n\};/)[0];
eval(hasPendingPublicationChangesCode);

async function run() {
  const weekStart = '2026-05-11';
  const weekEnd = '2026-05-17';
  
  const profiles = await supabase.from('empleados').select('*');
  const { data: turnosData } = await supabase.from('turnos').select('*').gte('fecha', weekStart).lte('fecha', weekEnd);
  
  const dates = [0,1,2,3,4,5,6].map(i => global.window.addIsoDays(weekStart, i));
  
  // Fetch raw events
  const { data: eventos } = await supabase.from('eventos_cuadrante').select('*').or('estado.is.null,estado.neq.anulado').lte('fecha_inicio', weekEnd).or(`fecha_fin.is.null,fecha_fin.gte.${weekStart}`);
  
  // Filter events for Cumbria
  const cumbriaEvents = eventos.filter(ev => {
      const evHotel = String(ev.hotel_origen || ev.hotel_id || ev.hotel || '').trim();
      return !evHotel || evHotel === 'Cumbria Spa&Hotel';
  });
  
  // Sort events so Natalio is processed last
  const otherEvents = cumbriaEvents.filter(e => e.id !== '51b9070c-6a44-4f2f-abdc-677543bc2fa2' && e.id !== '0275f0f3-e9ee-454e-8520-6f8e831da7d5');
  const evNatalio = cumbriaEvents.find(e => e.id === '51b9070c-6a44-4f2f-abdc-677543bc2fa2');
  const evIsabel = cumbriaEvents.find(e => e.id === '0275f0f3-e9ee-454e-8520-6f8e831da7d5');
  const sortedEvents = [...otherEvents, evIsabel, evNatalio]; // Natalio processed last

  // Build synthetic rows
  const hotelSourceRows = [];
  const hotelData = turnosData.filter(r => r.hotel_id === 'Cumbria Spa&Hotel');
  const empsInHotel = [...new Set(hotelData.map(r => r.empleado_id))];
  empsInHotel.forEach((empId, idx) => {
      const empProfile = (profiles.data || []).find(p => p.id === empId || p.nombre === empId);
      const row = {
          empleadoId: empId,
          displayName: empProfile?.nombre || empId,
          rowIndex: empProfile?.orden ?? empProfile?.display_order ?? empProfile?.sort_order ?? 999,
          weekStart: weekStart,
          values: dates.map(d => {
              const found = hotelData.find(r => r.empleado_id === empId && r.fecha === d);
              return found ? found.turno : null;
          })
      };
      hotelSourceRows.push(row);
  });

  const previewModel = global.window.createPuestosPreviewModel({
      hotel: 'Cumbria Spa&Hotel',
      dates: dates,
      sourceRows: hotelSourceRows,
      rows: turnosData.filter(r => r.hotel_id === 'Cumbria Spa&Hotel'),
      eventos: sortedEvents,
      employees: profiles.data
  });
  
  const employeesToRender = previewModel.getEmployees('weekly');
  
  // Build snapshot rows from cache simulation
  const newRows = employeesToRender.map((employee, idx) => {
      const daysMap = {};
      dates.forEach(date => {
          const resolved = previewModel.getTurnoEmpleado(employee.employee_id, date);
          const visual = global.window.TurnosRules ? global.window.TurnosRules.describeCell(resolved) : { label: resolved.turno, icons: resolved.icons || [] };
          
          const absCode = resolved.incidencia
              ? (resolved.incidencia === 'PERMISO' ? 'PERM'
                 : resolved.incidencia === 'FORMACION' ? 'FORM'
                 : resolved.incidencia === 'BAJA' ? 'BAJA'
                 : resolved.incidencia === 'VAC' ? 'VAC'
                 : resolved.incidencia)
              : null;

          const icons = [...new Set([
              ...(visual.icon ? [visual.icon] : (resolved.icon ? [resolved.icon] : [])),
              ...((resolved.cambio || resolved.intercambio) ? ['\u{1F504}'] : [])
          ])];

          daysMap[date] = {
              label: visual.label || absCode || resolved.turno || '',
              code: absCode || resolved.turno || '',
              icons: icons,
              estado: (resolved.isAbsent || resolved.incidencia) ? 'ausente' : 'operativo',
              origen: resolved.incidencia || resolved.origen || 'base',
              titular_cubierto: resolved.titular || null,
              sustituto: resolved.sustituidoPor || null,
              changed: !!resolved.cambio
          };
      });
      return {
          nombre: employee.nombre || employee.employee_id,
          nombreVisible: employee.nombreVisible || employee.displayName || employee.nombre || employee.employee_id,
          empleado_id: employee.employee_id,
          orden: employee.puestoOrden || (idx + 1),
          dias: daysMap
      };
  });

  const snaps = [{
      hotel_id: 'Cumbria Spa&Hotel',
      hotel_nombre: 'Cumbria Spa&Hotel',
      week_start: weekStart,
      week_end: weekEnd,
      source: 'admin_preview_resolved',
      rows: newRows
  }];

  console.log("Calling hasPendingPublicationChanges with Natalio-win preview...");
  const pendingResult = await global.window.hasPendingPublicationChanges({
      weekStart,
      weekEnd,
      hotels: ['Cumbria Spa&Hotel'],
      snapshots: snaps
  });
  
  console.log("Result:", JSON.stringify(pendingResult, null, 2));
}

run().catch(console.error);
