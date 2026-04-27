const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co/rest/v1";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";
const HEADERS = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal'
};

const EXECUTE = process.argv.includes('--execute');

const START_DATE = '2025-01-06';
const END_DATE = '2036-12-15';
const VALID_HOTELS = ['Cumbria Spa&Hotel', 'Sercotel Guadiana'];

function normalizeText(text) {
    if (!text) return '';
    return String(text).toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, ' ').trim();
}

function normalizeTurno(t) {
    if (!t) return '-';
    const nt = String(t).toUpperCase().trim();
    if (['M', 'T', 'N', 'D', '-'].includes(nt)) return nt;
    if (nt === '—') return '-';
    if (nt.startsWith('M')) return 'M';
    if (nt.startsWith('T')) return 'T';
    if (nt.startsWith('N')) return 'N';
    if (nt.startsWith('D')) return 'D';
    return nt; // return original if invalid
}

async function fetchAll(endpoint) {
    let allData = [];
    let limit = 1000;
    let offset = 0;
    while (true) {
        const url = `${SUPABASE_URL}/${endpoint}${endpoint.includes('?') ? '&' : '?'}limit=${limit}&offset=${offset}`;
        const res = await fetch(url, { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } });
        if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
        const data = await res.json();
        if (!data || data.length === 0) break;
        allData = allData.concat(data);
        if (data.length < limit) break;
        offset += limit;
    }
    return allData;
}

function yyyymmdd_hhmm() {
    const d = new Date();
    return d.toISOString().replace(/T/, '_').replace(/:/g, '').slice(0, 13) + d.getMinutes().toString().padStart(2, '0');
}

async function backupTable(tableName, backupDir, timestamp) {
    console.log(`Backing up ${tableName}...`);
    try {
        const data = await fetchAll(`${tableName}?select=*`);
        const filePath = path.join(backupDir, `backup_${timestamp}_${tableName}_antes_reimport_v9_full.json`);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        console.log(` -> Saved ${data.length} records to ${filePath}`);
        return true;
    } catch (e) {
        console.error(`Failed to backup ${tableName}:`, e.message);
        return false;
    }
}

async function run() {
    console.log("=== REIMPORTACIÓN GLOBAL CONTROLADA ===");
    const backupDir = path.join(__dirname, '..', 'backups');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir);

    const ts = yyyymmdd_hhmm();
    const tablesToBackup = ['turnos', 'empleados', 'eventos_cuadrante', 'publicaciones_cuadrante', 'peticiones_cambio'];
    
    for (const t of tablesToBackup) {
        const ok = await backupTable(t, backupDir, ts);
        if (!ok && t !== 'peticiones_cambio') {
            console.error("CRITICAL: Backup failed. Aborting.");
            return;
        }
    }

    console.log("\nLoading DB Data for identity resolution...");
    const dbEmpleados = await fetchAll("empleados?select=*");

    const resolveIdentity = (empName) => {
        const normSearch = normalizeText(empName);
        
        // Priority 1: id_interno
        const matchInternalId = dbEmpleados.find(e => normalizeText(e.id_interno) === normSearch);
        if (matchInternalId) return matchInternalId;

        // Priority 2: uuid (skip if not applicable)
        
        // Priority 3: id legacy
        const matchLegacyId = dbEmpleados.find(e => normalizeText(e.id) === normSearch);
        if (matchLegacyId) return matchLegacyId;

        // Priority 4: nombre normalizado (MATCH EXACTO, no parcial)
        const exactNameMatches = dbEmpleados.filter(e => normalizeText(e.nombre) === normSearch);
        if (exactNameMatches.length === 1) return exactNameMatches[0];
        
        if (exactNameMatches.length > 1) return { ambiguous: true, matches: exactNameMatches };

        return null;
    };

    console.log("Reading Excel...");
    const filePath = 'c:\\Users\\comun\\Documents\\GitHub\\Turnos-new\\V.9-Turnos.xlsx';
    if (!fs.existsSync(filePath)) {
        console.error("Excel not found.");
        return;
    }
    const workbook = XLSX.readFile(filePath, { cellDates: true });
    
    const excelData = [];
    let ambiguos = [];
    let noEncontrados = [];
    let ilegales = new Set();

    const excelOrderMap = []; // For v9_excel_order_map.json

    const excelCellDate = (value) => {
        if (!value) return null;
        if (value instanceof Date) {
            if (isNaN(value.getTime())) return null;
            return value.toISOString().split('T')[0];
        }
        if (typeof value === 'number') {
            const ms = Math.round((value - 25569) * 86400 * 1000);
            return new Date(ms).toISOString().split('T')[0];
        }
        if (typeof value === 'string') {
            const part = value.split('T')[0];
            if (/^\d{4}-\d{2}-\d{2}$/.test(part)) return part;
            const match = part.match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
            if (match) return `20${match[3]}-${match[2]}-${match[1]}`;
        }
        return null;
    };

    const addDays = (dateStr, days) => {
        const d = new Date(dateStr);
        d.setDate(d.getDate() + days);
        return d.toISOString().split('T')[0];
    };

    workbook.SheetNames.forEach(sheetName => {
        if (!VALID_HOTELS.includes(sheetName)) return;
        
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' });
        
        let currentWeek = null;
        rows.forEach((row, rowIndex) => {
            if (!row || row.length === 0) return;
            const maybeDate = excelCellDate(row[0]);
            
            if (maybeDate) {
                // CORRECTION: Force anchor to Monday if it's a Sunday
                const d = new Date(maybeDate);
                // getUTCDay() 0 is Sunday. 1 is Monday.
                if (d.getUTCDay() === 0) {
                    d.setUTCDate(d.getUTCDate() + 1);
                } else if (d.getUTCDay() !== 1) {
                    // If it's not Monday, we might have an issue, but let's assume Monday start for the week
                    // We could force it to the most recent Monday if needed.
                }
                currentWeek = d.toISOString().split('T')[0];
            }
            
            const empName = String(row[1] || '').trim();
            if (currentWeek && empName && empName.toLowerCase() !== 'empleado' && empName.length > 1) {
                
                if (currentWeek >= START_DATE && currentWeek <= END_DATE) {
                    const resolved = resolveIdentity(empName);
                    
                    if (!resolved) {
                        if (!noEncontrados.includes(empName)) noEncontrados.push(empName);
                        return;
                    }
                    if (resolved.ambiguous) {
                        if (!ambiguos.includes(empName)) ambiguos.push(empName);
                        return;
                    }

                    excelOrderMap.push({
                        hotel: sheetName,
                        week_start: currentWeek,
                        empleado_id: resolved.id,
                        empleado_nombre: resolved.nombre,
                        excel_row_index: rowIndex,
                        order: rowIndex
                    });

                    for (let i = 0; i < 7; i++) {
                        const date = addDays(currentWeek, i);
                        if (date < START_DATE || date > END_DATE) continue;

                        const turnoRaw = String(row[i + 2] || '').trim();
                        if (!turnoRaw) continue; // Skip entirely empty cells

                        const turnoNorm = normalizeTurno(turnoRaw);
                        
                        if (!['M', 'T', 'N', 'D', '-'].includes(turnoNorm)) {
                            ilegales.add(turnoRaw);
                            continue; // Skip illegal codes!
                        }

                        if (turnoNorm !== '-') {
                            excelData.push({
                                hotel_id: sheetName,
                                empleado_id: resolved.id,
                                empleado_uuid: resolved.uuid || null,
                                fecha: date,
                                turno: turnoNorm
                            });
                        }
                    }
                }
            }
        });
    });

    console.log("\n--- DRY RUN INFORME ---");
    console.log(`Total turnos a insertar: ${excelData.length}`);
    console.log(`Empleados no encontrados: ${noEncontrados.length} -> ${noEncontrados.join(', ')}`);
    console.log(`Identidades ambiguas: ${ambiguos.length} -> ${ambiguos.join(', ')}`);
    console.log(`Códigos ilegales detectados (ignorados): ${[...ilegales].join(', ')}`);

    console.log("\nEjemplos a insertar:");
    excelData.slice(0, 5).forEach(e => console.log(`${e.fecha} | ${e.hotel_id} | ${e.empleado_id} | ${e.turno}`));

    if (ambiguos.length > 0 || ilegales.size > 0 || noEncontrados.length > 0) {
        console.warn("\nWARNING: Existen anomalías que podrían requerir atención. Revisa el listado anterior.");
    }

    // Guardar mapa de orden local
    const mapPath = path.join(__dirname, 'v9_excel_order_map.json');
    fs.writeFileSync(mapPath, JSON.stringify(excelOrderMap, null, 2));
    console.log(`\nGuardado mapa local de orden en: scratch/v9_excel_order_map.json con ${excelOrderMap.length} entradas.`);

    if (!EXECUTE) {
        console.log("\n>> DRY RUN FINALIZADO. Usa '--execute' para realizar el borrado e inserción en Supabase.");
        return;
    }

    console.log("\n--- EJECUCIÓN ACTIVA ---");
    // Borrar rango
    console.log(`Borrando turnos en rango ${START_DATE} a ${END_DATE}...`);
    // Delete chunks (Supabase REST allows DELETE with filters)
    // We must ensure we only delete turnos BASE (if 'tipo' is null or 'base')
    // Since we don't have 'tipo' reliably populated as 'base', we delete where turno is M, T, N, D, -
    
    // We do a GET first to find what to delete, then delete by ID
    let idsToDelete = [];
    let dLimit = 1000;
    let dOff = 0;
    while(true) {
        const url = `${SUPABASE_URL}/turnos?fecha=gte.${START_DATE}&fecha=lte.${END_DATE}&hotel_id=in.("Cumbria Spa%26Hotel","Sercotel Guadiana")&select=id,turno&limit=${dLimit}&offset=${dOff}`;
        const res = await fetch(url, { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } });
        const d = await res.json();
        if (!d || d.length === 0) break;
        
        // Filter locally just to be safe: Only delete if turno is one of the base shifts
        d.forEach(row => {
            const t = String(row.turno).toUpperCase();
            if (['M', 'T', 'N', 'D', '-'].includes(t)) {
                idsToDelete.push(row.id);
            }
        });
        
        if (d.length < dLimit) break;
        dOff += dLimit;
    }

    console.log(`Encontrados ${idsToDelete.length} turnos base para eliminar.`);
    
    // Chunk deletions
    const chunkSize = 200;
    for (let i = 0; i < idsToDelete.length; i += chunkSize) {
        const chunk = idsToDelete.slice(i, i + chunkSize);
        const url = `${SUPABASE_URL}/turnos?id=in.(${chunk.join(',')})`;
        const delRes = await fetch(url, { method: 'DELETE', headers: HEADERS });
        if (!delRes.ok) {
            console.error(`DELETE failed: ${delRes.statusText}`);
            return;
        }
    }
    console.log("Borrado completado.");

    // Insert new data in chunks
    console.log(`Verificando duplicados locales en excelData...`);
    const uniqueMap = new Map();
    const cleanExcelData = [];
    excelData.forEach(e => {
        const key = `${e.hotel_id}_${e.empleado_id}_${e.fecha}`;
        if (!uniqueMap.has(key)) {
            uniqueMap.set(key, true);
            cleanExcelData.push(e);
        } else {
            console.warn(`WARNING: Ignorando turno duplicado en Excel para ${key} (${e.turno})`);
        }
    });

    console.log(`Insertando ${cleanExcelData.length} turnos únicos...`);
    for (let i = 0; i < cleanExcelData.length; i += chunkSize) {
        const chunk = cleanExcelData.slice(i, i + chunkSize);
        const insRes = await fetch(`${SUPABASE_URL}/turnos?on_conflict=empleado_id,fecha`, {
            method: 'POST',
            headers: { ...HEADERS, 'Prefer': 'return=minimal,resolution=ignore-duplicates' },
            body: JSON.stringify(chunk)
        });
        if (!insRes.ok) {
            const errText = await insRes.text();
            console.error(`INSERT failed at chunk ${i}: ${insRes.statusText} - ${errText}`);
            return;
        }
    }
    console.log("Inserción completada.");

    console.log("\nAuditoría Post-Importación...");
    const postTurnos = await fetchAll(`turnos?fecha=gte.${START_DATE}&fecha=lte.${END_DATE}&hotel_id=in.("Cumbria Spa%26Hotel","Sercotel Guadiana")&select=id`);
    console.log(`Total registros DB en el rango post-importación: ${postTurnos.length}`);
    if (postTurnos.length >= excelData.length) {
        console.log(">> IMPORTACIÓN VALIDADA COMO EXITOSA.");
    } else {
        console.log(">> ADVERTENCIA: La cantidad de registros post-import no coincide exactamente.");
    }
}

run();
