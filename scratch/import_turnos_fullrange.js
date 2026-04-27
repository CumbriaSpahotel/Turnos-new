const fs = require('fs');
const XLSX = require('../xlsx.full.min.js');
const https = require('https');

const API_KEY = 'sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ';
const BASE_URL = 'drvmxranbpumianmlzqr.supabase.co';

async function fetchTable(path) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: BASE_URL,
            path: `/rest/v1/${path}`,
            headers: { 'apikey': API_KEY }
        };
        https.get(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => { 
                try { 
                    if (res.statusCode === 200) resolve(JSON.parse(data)); 
                    else reject(new Error(`Fetch error ${res.statusCode}: ${data}`));
                } catch(e) { reject(e); }
            });
        }).on('error', reject);
    });
}

async function upsertTable(tableName, data, onConflict) {
    if (data.length === 0) return { success: true, count: 0 };
    return new Promise((resolve, reject) => {
        const options = {
            hostname: BASE_URL,
            path: `/rest/v1/${tableName}${onConflict ? `?on_conflict=${onConflict}` : ''}`,
            method: 'POST',
            headers: {
                'apikey': API_KEY,
                'Content-Type': 'application/json',
                'Prefer': 'resolution=merge-duplicates'
            }
        };
        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => { body += chunk; });
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve({ success: true, count: data.length });
                } else {
                    reject(new Error(`Supabase Error ${res.statusCode}: ${body}`));
                }
            });
        });
        req.on('error', reject);
        req.write(JSON.stringify(data));
        req.end();
    });
}

async function insertLog(action, summary) {
    const logData = {
        usuario: 'ADMIN_V9_IMPORT',
        resumen: action,
        cambios_json: summary
    };
    try {
        await upsertTable('publicaciones_log', [logData]);
    } catch (e) {
        console.warn('Could not insert log:', e.message);
    }
}

function parseExcelDate(val) {
    if (typeof val === 'number') {
        const d = new Date(Math.round((val - 25569) * 86400 * 1000));
        return d.toISOString().split('T')[0];
    }
    if (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}/)) return val.slice(0, 10);
    return null;
}

function addDays(iso, days) {
    const d = new Date(iso + 'T12:00:00');
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
}

async function runImport() {
    console.log('--- STARTING TURNOS IMPORT FULL RANGE (2025-2036) ---');
    
    // Fetch reference data
    const employees = await fetchTable('empleados?select=id,nombre,id_interno,hotel_id&activo=eq.true');
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

    const wb = XLSX.read(fs.readFileSync(file), { type: 'buffer' });
    const turnosToUpsert = [];
    let stats = { read: 0, valid: 0, ignored_dates: 0, date_min: null, date_max: null };
    
    wb.SheetNames.forEach(sheetName => {
        if (sheetName.toLowerCase().includes('hoja')) return;
        const data = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]);
        data.forEach(row => {
            stats.read++;
            const empName = (row.Empleado || '').toString().trim();
            const emp = empMap.get(empName.toLowerCase());
            const weekStart = parseExcelDate(row.Semana);
            
            if (!emp || !weekStart) return;
            if (weekStart > '2036-12-15' || weekStart < '2025-01-01') { stats.ignored_dates++; return; }

            ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].forEach((day, idx) => {
                const fecha = addDays(weekStart, idx);
                const shift = row[day];
                if (shift && shift !== '—') {
                    turnosToUpsert.push({
                        hotel_id: sheetName,
                        empleado_id: emp.id,
                        fecha: fecha,
                        turno: shift
                    });
                    stats.valid++;
                    if (!stats.date_min || fecha < stats.date_min) stats.date_min = fecha;
                    if (!stats.date_max || fecha > stats.date_max) stats.date_max = fecha;
                }
            });
        });
    });

    const chunkSize = 100;
    for (let i = 0; i < turnosToUpsert.length; i += chunkSize) {
        await upsertTable('turnos', turnosToUpsert.slice(i, i + chunkSize), 'empleado_id,fecha');
    }
    
    await insertLog('recarga_turnos_v9_fullrange', { 
        file, 
        ...stats, 
        total_entries: turnosToUpsert.length,
        backup: 'backup_2026-04-26_00-38_turnos_antes_recarga_v9_fullrange.json'
    });
    
    console.log('--- IMPORT COMPLETE ---');
    console.log(JSON.stringify(stats, null, 2));
}

runImport().catch(console.error);
