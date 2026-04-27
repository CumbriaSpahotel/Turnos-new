const fs = require('fs');
const XLSX = require('../xlsx.full.min.js');
const https = require('https');

const API_KEY = 'sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ';
const BASE_URL = 'drvmxranbpumianmlzqr.supabase.co';

async function fetchEmployees() {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: BASE_URL,
            path: '/rest/v1/empleados?select=id,nombre,id_interno,hotel_id&activo=eq.true',
            headers: { 'apikey': API_KEY }
        };
        https.get(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => { 
                try { resolve(JSON.parse(data)); } catch(e) { reject(e); }
            });
        }).on('error', reject);
    });
}

function parseExcelDate(val) {
    if (typeof val === 'number') {
        const d = new Date(Math.round((val - 25569) * 86400 * 1000));
        return d.toISOString().split('T')[0];
    }
    if (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}/)) return val.slice(0, 10);
    return null;
}

async function runDryRun() {
    console.log('--- DRY RUN TURNOS FULL RANGE (2025-2036) ---');
    const employees = await fetchEmployees();
    const empMap = new Map();
    employees.forEach(e => {
        empMap.set(e.id.toLowerCase().trim(), e);
        empMap.set(e.nombre.toLowerCase().trim(), e);
    });

    const file = 'V.9-Turnos.xlsx';
    if (!fs.existsSync(file)) {
        console.error('File not found:', file);
        return;
    }

    const buf = fs.readFileSync(file);
    const wb = XLSX.read(buf, { type: 'buffer' });
    
    const stats = {
        sheets: wb.SheetNames,
        totalRows: 0,
        validRows: 0,
        invalidRows: 0,
        ignoredRangeRows: 0,
        dateRange: { min: null, max: null },
        hotels: new Set(),
        employees: new Set(),
        turnosCodes: {}
    };

    wb.SheetNames.forEach(sheetName => {
        if (sheetName.toLowerCase().includes('hoja')) return;
        const ws = wb.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(ws);
        stats.totalRows += data.length;

        data.forEach(row => {
            const weekStart = parseExcelDate(row.Semana);
            const empName = (row.Empleado || '').toString().trim();
            const emp = empMap.get(empName.toLowerCase());

            if (!weekStart || !emp) {
                stats.invalidRows++;
                return;
            }

            if (weekStart < '2025-01-06' || weekStart > '2036-12-15') {
                stats.ignoredRangeRows++;
                return;
            }

            stats.validRows++;
            stats.hotels.add(sheetName);
            stats.employees.add(empName);

            if (!stats.dateRange.min || weekStart < stats.dateRange.min) stats.dateRange.min = weekStart;
            if (!stats.dateRange.max || weekStart > stats.dateRange.max) stats.dateRange.max = weekStart;

            ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].forEach(day => {
                const code = (row[day] || '—').toString().trim();
                stats.turnosCodes[code] = (stats.turnosCodes[code] || 0) + 1;
            });
        });
    });

    console.log(JSON.stringify({
        file,
        ...stats,
        hotels: [...stats.hotels],
        employeesCount: stats.employees.size,
        employees: [...stats.employees]
    }, null, 2));
}

runDryRun().catch(console.error);
