const fs = require('fs');
const path = require('path');

// Mock de window y dependencias
global.window = {
    normalizeId: (id) => String(id || '').trim(),
    normalizeTipo: (t) => String(t || '').toUpperCase(),
    normalizeDate: (d) => d,
    addIsoDays: (d, n) => {
        const dt = new Date(d + 'T12:00:00');
        dt.setDate(dt.getDate() + n);
        return dt.toISOString().split('T')[0];
    },
    getV9ExcelOrder: () => 500 // Fallback
};

// Cargar lógica de admin.js (necesitamos createPuestosPreviewModel)
const adminCode = fs.readFileSync(path.join(__dirname, '../admin.js'), 'utf8');
eval(adminCode);

// Datos de prueba (extraídos del diagnóstico)
const hotel = "Cumbria Spa&Hotel";
const weekStart = "2026-05-04";
const dates = [0,1,2,3,4,5,6].map(i => global.window.addIsoDays(weekStart, i));

async function generatePreview() {
    try {
        // En un entorno real cargaríamos de Supabase, aquí simulamos con lo que ya sabemos
        const sourceRows = [
            { empleadoId: 'Esther', displayName: 'Esther', weekStart: weekStart },
            { empleadoId: 'Sergio', displayName: 'Sergio', weekStart: weekStart },
            { empleadoId: 'Cristina', displayName: 'Cristina', weekStart: weekStart },
            { empleadoId: 'Valentín', displayName: 'Valentín', weekStart: weekStart },
            { empleadoId: 'Isabel Hidalgo', displayName: 'Isabel Hidalgo', weekStart: weekStart }
        ];

        // Eventos reales detectados
        const eventos = [
            { id: 'ev1', empleado_id: 'Sergio', empleado_destino_id: 'Miriam', tipo: 'VAC', fecha_inicio: '2026-05-04', fecha_fin: '2026-05-10', estado: 'activo' }
        ];

        // Turnos base (simulados para la demo)
        const turnosSemana = [
            { empleado_id: 'Esther', fecha: '2026-05-04', turno: 'N' },
            { empleado_id: 'Sergio', fecha: '2026-05-04', turno: 'M' }, // Sergio originalmente de mañana
            { empleado_id: 'Miriam', fecha: '2026-05-04', turno: 'OFF' }
        ];

        const employees = [
            { id: 'Esther', nombre: 'Esther' },
            { id: 'Sergio', nombre: 'Sergio' },
            { id: 'Miriam', nombre: 'Miriam' },
            { id: 'Cristina', nombre: 'Cristina' },
            { id: 'Valentín', nombre: 'Valentín' },
            { id: 'Isabel Hidalgo', nombre: 'Isabel Hidalgo' }
        ];

        const model = global.window.createPuestosPreviewModel({
            hotel,
            dates,
            sourceRows,
            rows: turnosSemana,
            eventos,
            employees
        });

        const emps = model.getEmployees();
        console.log('--- PREVIEW V12.1 ROWS ---');
        emps.forEach((e, idx) => {
            console.log(`${idx+1}. ${e.nombre} (ID: ${e.employee_id}) | PO: ${e.puestoOrden} | Type: ${e.rowType}`);
        });

        const miriam = emps.find(e => e.nombre === 'Miriam');
        const sergio = emps.find(e => e.nombre === 'Sergio');

        if (miriam && miriam.rowType === 'operativo' && sergio && sergio.rowType === 'ausencia_informativa') {
            console.log('RESULTADO: VALIDACIÓN EXITOSA - Miriam operativa, Sergio ausente.');
        } else {
            console.log('RESULTADO: FALLO - Estructura incorrecta.');
        }

    } catch (e) {
        console.error(e);
    }
}

generatePreview();
