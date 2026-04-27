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
    console.log('--- STARTING IMPORT V.9 ---');
    
    // Fetch reference data
    const employees = await fetchTable('empleados?select=id,nombre,id_interno,hotel_id&activo=eq.true');
    const empMap = new Map();
    employees.forEach(e => {
        empMap.set(e.id.toLowerCase().trim(), e);
        empMap.set(e.nombre.toLowerCase().trim(), e);
    });

    const currentEventos = await fetchTable('eventos_cuadrante?select=id,empleado_id,fecha_inicio,tipo');
    const eventosMap = new Map();
    currentEventos.forEach(e => {
        const key = `${e.empleado_id}|${e.fecha_inicio}|${e.tipo}`;
        eventosMap.set(key, e.id);
    });

    const results = {};

    // 1. TURNOS
    console.log('Processing Turnos...');
    const turnosFile = 'V.9-Turnos.xlsx';
    if (fs.existsSync(turnosFile)) {
        const wb = XLSX.read(fs.readFileSync(turnosFile), { type: 'buffer' });
        const turnosToUpsert = [];
        let stats = { read: 0, valid: 0, ignored_dates: 0 };
        
        wb.SheetNames.forEach(sheetName => {
            if (sheetName.toLowerCase().includes('hoja')) return;
            const data = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]);
            data.forEach(row => {
                stats.read++;
                const empName = (row.Empleado || '').toString().trim();
                const emp = empMap.get(empName.toLowerCase());
                const weekStart = parseExcelDate(row.Semana);
                
                if (!emp || !weekStart) return;
                if (weekStart > '2026-12-31' || weekStart < '2025-01-01') { stats.ignored_dates++; return; }

                ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].forEach((day, idx) => {
                    const fecha = addDays(weekStart, idx);
                    let shift = String(row[day] || '').trim();
                    const normMap = { 'mañana': 'M', 'tarde': 'T', 'noche': 'N', 'descanso': 'D', 'm': 'M', 't': 'T', 'n': 'N', 'd': 'D' };
                    const lShift = shift.toLowerCase();
                    if (normMap[lShift]) shift = normMap[lShift];
                    
                    if (shift && shift !== '—' && shift !== '-') {
                        turnosToUpsert.push({
                            hotel_id: sheetName,
                            empleado_id: emp.id,
                            fecha: fecha,
                            turno: shift
                        });
                        stats.valid++;
                    }
                });
            });
        });

        // Deduplicar para evitar "ON CONFLICT DO UPDATE command cannot affect row a second time"
        const dedupMap = new Map();
        turnosToUpsert.forEach(t => {
            const key = `${t.empleado_id}|${t.fecha}`;
            dedupMap.set(key, t);
        });
        const finalTurnos = Array.from(dedupMap.values());

        const chunkSize = 100;
        for (let i = 0; i < finalTurnos.length; i += chunkSize) {
            await upsertTable('turnos', finalTurnos.slice(i, i + chunkSize), 'empleado_id,fecha');
        }
        await insertLog('importar_turnos_v9', { file: turnosFile, ...stats, total_entries: turnosToUpsert.length });
        results[turnosFile] = stats;
        console.log(`Turnos: ${stats.valid} records processed.`);
    }

    // 2. VACACIONES
    console.log('Processing Vacaciones...');
    const vacFile = 'V.9-Vacaciones.xlsx';
    if (fs.existsSync(vacFile)) {
        const wb = XLSX.read(fs.readFileSync(vacFile), { type: 'buffer' });
        const eventosToUpsert = [];
        let stats = { read: 0, valid: 0, inserted: 0, updated: 0 };
        
        wb.SheetNames.forEach(sheetName => {
            if (sheetName.toLowerCase().includes('hoja')) return;
            const data = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]);
            data.forEach(row => {
                stats.read++;
                const emp = empMap.get((row.Empleado || '').toString().trim().toLowerCase());
                const sustName = (row.Sustituto || '').toString().trim();
                const sust = empMap.get(sustName.toLowerCase());
                const fecha = parseExcelDate(row.Fecha);
                if (!emp || !fecha) return;

                const key = `${emp.id}|${fecha}|VAC`;
                const existingId = eventosMap.get(key);
                const record = {
                    hotel_origen: row.Hotel || emp.hotel_id || 'Cumbria Spa&Hotel',
                    empleado_id: emp.id,
                    empleado_destino_id: sust ? sust.id : null,
                    fecha_inicio: fecha,
                    fecha_fin: fecha,
                    tipo: 'VAC',
                    estado: 'activo',
                    payload: { sustituto_nombre: sustName, importado_v9: true }
                };
                if (existingId) {
                    record.id = existingId;
                    stats.updated++;
                } else {
                    stats.inserted++;
                }
                eventosToUpsert.push(record);
                stats.valid++;
            });
        });

        // Deduplicar eventos antes de separar en updates/inserts
        const dedupEvMap = new Map();
        eventosToUpsert.forEach(e => {
            const k = `${e.empleado_id}|${e.fecha_inicio}|${e.tipo}`;
            dedupEvMap.set(k, e);
        });
        const finalEventos = Array.from(dedupEvMap.values());

        const updates = finalEventos.filter(e => e.id);
        const inserts = finalEventos.filter(e => !e.id);
        const chunkSize = 100;
        for (let i = 0; i < updates.length; i += chunkSize) await upsertTable('eventos_cuadrante', updates.slice(i, i + chunkSize));
        for (let i = 0; i < inserts.length; i += chunkSize) await upsertTable('eventos_cuadrante', inserts.slice(i, i + chunkSize));

        await insertLog('importar_vacaciones_v9', { file: vacFile, ...stats });
        results[vacFile] = stats;
        console.log(`Vacaciones: ${stats.valid} records processed.`);
    }

    // 3. BAJAS Y PERMISOS
    console.log('Processing Bajas y Permisos...');
    const bajasFile = 'V.9-Bajas y permisos.xlsx';
    if (fs.existsSync(bajasFile)) {
        const wb = XLSX.read(fs.readFileSync(bajasFile), { type: 'buffer' });
        const eventosToUpsert = [];
        let stats = { read: 0, valid: 0, inserted: 0, updated: 0 };
        
        wb.SheetNames.forEach(sheetName => {
            if (sheetName.toLowerCase().includes('hoja')) return;
            const data = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]);
            data.forEach(row => {
                stats.read++;
                const emp = empMap.get((row.Empleado || '').toString().trim().toLowerCase());
                const sustName = (row.Sustituto || '').toString().trim();
                const sust = empMap.get(sustName.toLowerCase());
                const fecha = parseExcelDate(row.Fecha);
                if (!emp || !fecha) return;

                const tipo = (row.TipoAusencia || 'BAJA').toUpperCase().includes('PERM') ? 'PERMISO' : 'BAJA';
                const key = `${emp.id}|${fecha}|${tipo}`;
                const existingId = eventosMap.get(key);
                const record = {
                    hotel_origen: row.Hotel || emp.hotel_id || 'Cumbria Spa&Hotel',
                    empleado_id: emp.id,
                    empleado_destino_id: sust ? sust.id : null,
                    fecha_inicio: fecha,
                    fecha_fin: fecha,
                    tipo: tipo,
                    estado: 'activo',
                    observaciones: row.Motivo || null,
                    payload: { sustituto_nombre: sustName, importado_v9: true }
                };
                if (existingId) {
                    record.id = existingId;
                    stats.updated++;
                } else {
                    stats.inserted++;
                }
                eventosToUpsert.push(record);
                stats.valid++;
            });
        });

        // Deduplicar eventos antes de separar en updates/inserts
        const dedupEvMap = new Map();
        eventosToUpsert.forEach(e => {
            const k = `${e.empleado_id}|${e.fecha_inicio}|${e.tipo}`;
            dedupEvMap.set(k, e);
        });
        const finalEventos = Array.from(dedupEvMap.values());

        const updates = finalEventos.filter(e => e.id);
        const inserts = finalEventos.filter(e => !e.id);
        const chunkSize = 100;
        for (let i = 0; i < updates.length; i += chunkSize) await upsertTable('eventos_cuadrante', updates.slice(i, i + chunkSize));
        for (let i = 0; i < inserts.length; i += chunkSize) await upsertTable('eventos_cuadrante', inserts.slice(i, i + chunkSize));

        await insertLog('importar_bajas_permisos_v9', { file: bajasFile, ...stats });
        results[bajasFile] = stats;
        console.log(`Bajas: ${stats.valid} records processed.`);
    }

    // 4. CAMBIOS DE TURNO
    console.log('Processing Cambios de Turno...');
    const cambiosFile = 'V.9-Cambios de turno.xlsx';
    if (fs.existsSync(cambiosFile)) {
        const wb = XLSX.read(fs.readFileSync(cambiosFile), { type: 'buffer' });
        const eventosToUpsert = [];
        let stats = { read: 0, valid: 0, inserted: 0, updated: 0 };
        
        wb.SheetNames.forEach(sheetName => {
            if (sheetName.toLowerCase().includes('hoja')) return;
            const data = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]);
            data.forEach(row => {
                stats.read++;
                const emp = empMap.get((row.Empleado || '').toString().trim().toLowerCase());
                const fecha = parseExcelDate(row.Fecha);
                if (!emp || !fecha) return;

                const key = `${emp.id}|${fecha}|CAMBIO`;
                const existingId = eventosMap.get(key);
                const record = {
                    hotel_origen: row.Hotel || emp.hotel_id || 'Cumbria Spa&Hotel',
                    empleado_id: emp.id,
                    fecha_inicio: fecha,
                    fecha_fin: fecha,
                    tipo: 'CAMBIO',
                    estado: 'activo',
                    observaciones: row['Cambio de Turno'] || null,
                    payload: { importado_v9: true }
                };
                if (existingId) {
                    record.id = existingId;
                    stats.updated++;
                } else {
                    stats.inserted++;
                }
                eventosToUpsert.push(record);
                stats.valid++;
            });
        });

        // Deduplicar eventos antes de separar en updates/inserts
        const dedupEvMap = new Map();
        eventosToUpsert.forEach(e => {
            const k = `${e.empleado_id}|${e.fecha_inicio}|${e.tipo}`;
            dedupEvMap.set(k, e);
        });
        const finalEventos = Array.from(dedupEvMap.values());

        const updates = finalEventos.filter(e => e.id);
        const inserts = finalEventos.filter(e => !e.id);
        const chunkSize = 100;
        for (let i = 0; i < updates.length; i += chunkSize) await upsertTable('eventos_cuadrante', updates.slice(i, i + chunkSize));
        for (let i = 0; i < inserts.length; i += chunkSize) await upsertTable('eventos_cuadrante', inserts.slice(i, i + chunkSize));

        await insertLog('importar_cambios_turno_v9', { file: cambiosFile, ...stats });
        results[cambiosFile] = stats;
        console.log(`Cambios: ${stats.valid} records processed.`);
    }

    console.log('--- ALL IMPORTS COMPLETE ---');
    console.log(JSON.stringify(results, null, 2));
}

runImport().catch(console.error);
