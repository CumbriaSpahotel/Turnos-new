
const fs = require('fs');

const filePath = 'admin.js';
let content = fs.readFileSync(filePath, 'utf8');

// 1. UPDATE getEmployees with Activity Sorting for Monthly View
const oldSort = `        result.sort((a, b) => {
            if (a.puestoOrden !== b.puestoOrden) return a.puestoOrden - b.puestoOrden;
            return String(a.nombre || '').localeCompare(String(b.nombre || ''));
        });`;

const newSort = `        if (viewType === 'monthly') {
            result.forEach(row => {
                let count = 0;
                for (const d of dates) {
                    const res = getTurnoEmpleadoExtended(row.employee_id, d);
                    // Solo cuentan turnos operativos (no VAC, no BAJA, no D, no Vacío)
                    if (res && res.turno && res.turno !== 'D' && !res.incidencia) {
                        count++;
                    }
                }
                row.totalTurnosMes = count;
            });

            result.sort((a, b) => {
                // Primero: Volumen de actividad (descendente)
                if (b.totalTurnosMes !== a.totalTurnosMes) return b.totalTurnosMes - a.totalTurnosMes;
                // Segundo: Orden Excel (puestoOrden)
                if (a.puestoOrden !== b.puestoOrden) return a.puestoOrden - b.puestoOrden;
                return String(a.nombre || '').localeCompare(String(b.nombre || ''));
            });
        } else {
            result.sort((a, b) => {
                if (a.puestoOrden !== b.puestoOrden) return a.puestoOrden - b.puestoOrden;
                return String(a.nombre || '').localeCompare(String(b.nombre || ''));
            });
        }
`;

content = content.replace(oldSort, newSort);

fs.writeFileSync(filePath, content, 'utf8');
console.log("admin.js updated: Activity-based sorting implemented for Monthly View.");
