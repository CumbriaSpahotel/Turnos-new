const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

global.window = global;
global.document = {
    addEventListener: () => {},
    getElementById: (id) => ({ value: '', textContent: '', style: { background: '', display: '' } }),
    querySelector: (s) => ({ value: '2026-04-20', textContent: '', style: {} })
};
global.localStorage = { getItem: () => null, setItem: () => {} };
global.navigator = { userAgent: 'Node' };
global.localforage = { getItem: async () => null, setItem: async () => {} };

const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";
global.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function loadScript(filePath) {
    const code = fs.readFileSync(path.join(__dirname, '..', filePath), 'utf8');
    eval(code);
}

global.addIsoDays = (iso, days) => {
    const d = new Date(iso + 'T12:00:00');
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
};
global.getMonday = (date) => {
    const d = new Date(date);
    const day = d.getDay(), diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
};
global.isoDate = (d) => d.toISOString().split('T')[0];
global.normalizeId = (id) => String(id || '').trim().toLowerCase();
global.normalizeDate = (d) => String(d || '').split('T')[0];
global.normalizeTipo = (t) => String(t || '').trim().toUpperCase();
global.normalizeEstado = (e) => String(e || '').trim().toLowerCase();
global.fmtDateLegacy = (iso) => iso.split('-').reverse().join('/');

// Cargar dependencias en orden
loadScript('turnos-rules.js');
loadScript('shift-resolver.js');
loadScript('supabase-dao.js');
loadScript('excel-loader.js');
// admin.js tiene mucha lógica, cargarla con cuidado
const adminCode = fs.readFileSync(path.join(__dirname, '..', 'admin.js'), 'utf8');
// Mock de window.$ para evitar errores de selectores
global.$ = (s) => ({ value: '2026-04-20' });
eval(adminCode);

async function testFinalSnapshot() {
    const weekStart = '2026-04-20';
    console.log(`\n🚀 INICIANDO TEST DE PUBLICACIÓN REAL PARA: ${weekStart}`);
    
    try {
        const profiles = await window.TurnosDB.getEmpleados();
        const hotels = ['Cumbria Spa&Hotel', 'Sercotel Guadiana'];
        
        // MOCK EXCEL SOURCE (Exactly what Admin would have)
        const excelSource = {
            'Cumbria Spa&Hotel': [
                { empleadoId: 'Miriam', displayName: 'Miriam', rowIndex: 0, weekStart: '2026-04-20', values: [null,null,null,null,null,null,null] },
                { empleadoId: 'Esther', displayName: 'Esther', rowIndex: 1, weekStart: '2026-04-20', values: [null,null,null,null,null,null,null] },
                { empleadoId: 'Sergio', displayName: 'Sergio', rowIndex: 2, weekStart: '2026-04-20', values: [null,null,null,null,null,null,null] },
                { empleadoId: 'Valentin', displayName: 'Valentin', rowIndex: 3, weekStart: '2026-04-20', values: [null,null,null,null,null,null,null] },
                { empleadoId: 'Isabel Hidalgo', displayName: 'Isabel Hidalgo', rowIndex: 4, weekStart: '2026-04-20', values: [null,null,null,null,null,null,null] },
                { empleadoId: 'Cristina', displayName: 'Cristina', rowIndex: 5, weekStart: '2026-04-20', values: [null,null,null,null,null,null,null] }
            ],
            'Sercotel Guadiana': [
                { empleadoId: 'Macarena', displayName: 'Macarena', rowIndex: 0, weekStart: '2026-04-20', values: [null,null,null,null,null,null,null] },
                { empleadoId: 'Diana', displayName: 'Diana', rowIndex: 1, weekStart: '2026-04-20', values: [null,null,null,null,null,null,null] },
                { empleadoId: 'Dani', displayName: 'Dani', rowIndex: 2, weekStart: '2026-04-20', values: [null,null,null,null,null,null,null] },
                { empleadoId: 'Federico', displayName: 'Federico', rowIndex: 3, weekStart: '2026-04-20', values: [null,null,null,null,null,null,null] },
                { empleadoId: 'Sergio Sanchez', displayName: 'Sergio Sanchez', rowIndex: 4, weekStart: '2026-04-20', values: [null,null,null,null,null,null,null] }
            ]
        };
        
        const weekEnd = addIsoDays(weekStart, 6);
        const [eventos, turnosSemana] = await Promise.all([
            window.TurnosDB.fetchEventos(weekStart, weekEnd),
            window.TurnosDB.fetchRango(weekStart, weekEnd)
        ]);

        for (const hName of hotels) {
            console.log(`\n📦 Procesando ${hName}...`);
            const dates = [0,1,2,3,4,5,6].map(i => addIsoDays(weekStart, i));
            let weekExcelRows = (excelSource[hName] || []).filter(r => r.weekStart === weekStart);
            
            const previewModel = window.createPuestosPreviewModel({
                hotel: hName,
                dates: dates,
                sourceRows: weekExcelRows,
                rows: turnosSemana.filter(t => t.hotel_id === hName),
                eventos,
                employees: profiles
            });

            if (previewModel.puestos.length === 0) {
                console.warn(`- Sin datos operativos para ${hName}`);
                continue;
            }

            const emps = previewModel.getEmployees();
            const orderedEmps = previewModel.ordenarEmpleados ? previewModel.ordenarEmpleados(emps, dates) : emps;
            
            console.log(`- Empleados en Vista Previa: ${orderedEmps.length}`);
            orderedEmps.forEach((e, i) => console.log(`  ${i+1}. ${e.nombre || e.id}`));

            const snapshotObj = {
                semana_inicio: weekStart,
                semana_fin: weekEnd,
                hotel: hName,
                empleados: orderedEmps.map((emp, idx) => {
                    const daysMap = {};
                    dates.forEach(fecha => {
                        const celda = previewModel.getCeldaByEmpleado ? previewModel.getCeldaByEmpleado(emp.id, fecha) : null;
                        if (celda) {
                            daysMap[fecha] = {
                                label: celda.turnoLabel || celda.turno || '',
                                code: celda.turno || '',
                                icons: celda.icon ? [celda.icon] : [],
                                estado: celda.isAbsent ? 'ausente' : 'operativo',
                                origen: celda.incidencia || 'base'
                            };
                        }
                    });
                    return {
                        empleado_id: emp.id,
                        nombre: emp.nombre || emp.id,
                        orden: idx + 1,
                        dias: daysMap
                    };
                })
            };

            // Validar
            if (window.comparePreviewVsSnapshot(previewModel, snapshotObj)) {
                console.log(`✅ Validación OK para ${hName}. Publicando...`);
                await window.TurnosDB.publishCuadranteSnapshot({
                    semanaInicio: weekStart,
                    semanaFin: weekEnd,
                    hotel: hName,
                    snapshot: snapshotObj,
                    resumen: { count: orderedEmps.length },
                    usuario: 'TEST_FINAL_STABILIZATION'
                });
            } else {
                console.error(`❌ Validación FALLIDA para ${hName}.`);
            }
        }

    } catch (err) {
        console.error("Error en test:", err);
    }
}

testFinalSnapshot();
