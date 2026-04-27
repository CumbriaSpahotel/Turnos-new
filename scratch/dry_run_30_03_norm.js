const XLSX = require('xlsx');

async function dryRun() {
    const SUPABASE_URL = 'https://drvmxranbpumianmlzqr.supabase.co/rest/v1';
    const SUPABASE_ANON_KEY = 'sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ';

    const fetchSupabase = async (path, method = 'GET') => {
        const url = new URL(`${SUPABASE_URL}${path}`);
        const response = await fetch(url.toString(), {
            method,
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });
        return await response.json();
    };

    // 1. Read Excel
    const filePath = 'c:\\Users\\comun\\Documents\\GitHub\\Turnos-new\\V.9-Turnos.xlsx';
    const workbook = XLSX.readFile(filePath, { cellDates: true });
    const sheetName = 'Cumbria Spa&Hotel';
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' });

    const formatDate = (dateObj) => {
        if (!dateObj) return null;
        if (dateObj instanceof Date) {
            const y = dateObj.getFullYear();
            const m = String(dateObj.getMonth() + 1).padStart(2, '0');
            const d = String(dateObj.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        }
        if (typeof dateObj === 'string') return dateObj.split('T')[0];
        return String(dateObj);
    };

    const addDays = (dateStr, days) => {
        const d = new Date(dateStr + 'T12:00:00');
        d.setDate(d.getDate() + days);
        return formatDate(d);
    };

    const proposed = [];
    const normMap = { 'mañana': 'M', 'tarde': 'T', 'noche': 'N', 'descanso': 'D', 'm': 'M', 't': 'T', 'n': 'N', 'd': 'D' };
    
    data.slice(1).forEach(row => {
        const empName = String(row[1] || '').trim();
        let weekStart = formatDate(row[0]);
        if (!empName || !weekStart) return;
        
        if (weekStart === '2026-03-30') {
            ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].forEach((day, idx) => {
                let shift = String(row[2 + idx]).trim();
                const lShift = shift.toLowerCase();
                if (normMap[lShift]) shift = normMap[lShift];
                
                if (shift && shift !== '—' && shift !== '-') {
                    proposed.push({
                        empleado_id: empName,
                        fecha: addDays(weekStart, idx),
                        turno: shift
                    });
                } else if (shift === '—' || shift === '-') {
                    proposed.push({
                        empleado_id: empName,
                        fecha: addDays(weekStart, idx),
                        turno: '—'
                    });
                }
            });
        }
    });

    // 2. Read DB
    const dbRows = await fetchSupabase("/turnos?hotel_id=eq.Cumbria%20Spa%26Hotel&fecha=gte.2026-03-30&fecha=lte.2026-04-05&select=id,fecha,empleado_id,turno");
    
    const dbMap = {};
    dbRows.forEach(r => {
        if (!r.empleado_id.includes('_DUP')) {
            const normalizedEmp = r.empleado_id.toLowerCase().trim();
            dbMap[`${normalizedEmp}_${r.fecha}`] = r;
        }
    });

    // 3. Compare
    console.log("=== DRY RUN DE DIFERENCIAS (30/03/26 - 05/04/26) ===");
    console.log("Empleado | Fecha | Excel(Norm) | BD Actual | Acción");
    console.log("-----------------------------------------------------");

    const empsToCheck = ['cristina', 'esther', 'sergio', 'valentín'];

    proposed.forEach(p => {
        const normEmp = p.empleado_id.toLowerCase().trim();
        if (!empsToCheck.includes(normEmp)) return;

        let empKey = normEmp;
        
        const dbRow = dbMap[`${empKey}_${p.fecha}`];
        const dbTurno = dbRow ? dbRow.turno : 'N/A';
        const excelTurno = p.turno;

        let action = 'sin cambio';
        if (!dbRow) {
            action = 'INSERTAR';
        } else if (dbTurno !== excelTurno) {
            action = 'UPDATE';
        }

        console.log(`${p.empleado_id.padEnd(10)} | ${p.fecha} | ${excelTurno.padEnd(10)} | ${dbTurno.padEnd(8)} | ${action}`);
    });
}
dryRun();
