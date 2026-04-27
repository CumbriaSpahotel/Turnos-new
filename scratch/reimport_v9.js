const XLSX = require('./xlsx.full.min.js');
const fs = require('fs');

const SUPABASE_URL = 'https://drvmxranbpumianmlzqr.supabase.co/rest/v1';
const SUPABASE_ANON_KEY = 'sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ';
const FILE_PATH = 'V.9-Turnos.xlsx';

const TURN_MAP = {
    'MAÑANA': 'M', 'M': 'M',
    'TARDE': 'T', 'T': 'T',
    'NOCHE': 'N', 'N': 'N',
    'DESCANSO': 'D', 'D': 'D',
    'PENDIENTE': '-', '-': '-', '—': '-', '': '-'
};

const PERMITTED_CODES = ['M', 'T', 'N', 'D', '-'];

async function reimport() {
    try {
        console.log('Fetching employees for UUID mapping...');
        const empResponse = await fetch(`${SUPABASE_URL}/empleados?select=id,uuid`, {
            headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY }
        });
        const emps = await empResponse.json();
        const uuidMap = {};
        emps.forEach(e => {
            uuidMap[String(e.id).trim().toLowerCase()] = e.uuid;
        });

        const buffer = fs.readFileSync(FILE_PATH);
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        
        const payloads = [];
        const ignored = [];

        workbook.SheetNames.forEach(sheetName => {
            const sheet = workbook.Sheets[sheetName];
            const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
            
            data.forEach((row, rowIndex) => {
                if (rowIndex === 0) return;
                if (!row[0] || !row[1]) return;

                const weekStartVal = row[0];
                const empName = String(row[1]).trim();
                if (empName.startsWith('_DUP')) return;

                let weekStartDate;
                if (typeof weekStartVal === 'number') {
                    weekStartDate = new Date(Math.round((weekStartVal - 25569) * 86400 * 1000));
                } else {
                    weekStartDate = new Date(weekStartVal);
                }

                if (isNaN(weekStartDate.getTime())) return;

                for (let i = 0; i < 7; i++) {
                    const currentDate = new Date(weekStartDate);
                    currentDate.setDate(weekStartDate.getDate() + i);
                    const dateStr = currentDate.toISOString().split('T')[0];

                    const rawVal = String(row[i + 2] || '').trim();
                    const normVal = TURN_MAP[rawVal.toUpperCase()] || rawVal.toUpperCase();

                    if (PERMITTED_CODES.includes(normVal)) {
                        const p = {
                            empleado_id: empName,
                            fecha: dateStr,
                            turno: normVal,
                            hotel_id: sheetName,
                            tipo: 'NORMAL',
                            updated_at: new Date().toISOString(),
                            updated_by: 'RECARGA_V9_CORREGIDO'
                        };
                        
                        // Map UUID if found
                        const uuid = uuidMap[empName.toLowerCase()];
                        if (uuid) {
                            p.empleado_uuid = uuid;
                        }

                        payloads.push(p);
                    } else {
                        ignored.push({ empName, dateStr, rawVal });
                    }
                }
            });
        });

        console.log(`Prepared ${payloads.length} records.`);
        console.log(`Ignored ${ignored.length} invalid records.`);

        // Iniciar Upsert en bloques de 100
        const chunkSize = 100;
        let inserted = 0;

        for (let i = 0; i < payloads.length; i += chunkSize) {
            const chunk = payloads.slice(i, i + chunkSize);
            const response = await fetch(`${SUPABASE_URL}/turnos`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
                    'Content-Type': 'application/json',
                    'Prefer': 'resolution=merge-duplicates'
                },
                body: JSON.stringify(chunk)
            });

            if (!response.ok) {
                const error = await response.json();
                console.error(`Error in chunk ${i/chunkSize}:`, error);
            } else {
                inserted += chunk.length;
                if (i % 1000 === 0) {
                    process.stdout.write(`Processed ${inserted}/${payloads.length}...\r`);
                }
            }
        }

        console.log(`\nFinalizado: ${inserted} registros procesados.`);
        
        // Logs de auditoría
        await fetch(`${SUPABASE_URL}/logs_auditoria`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                usuario: 'CODEX',
                accion: 'recarga_turnos_v9_corregido',
                resumen_json: {
                    archivo: FILE_PATH,
                    total_preparados: payloads.length,
                    procesados: inserted,
                    ignorados: ignored.length,
                    pestañas: workbook.SheetNames
                }
            })
        });

    } catch (err) {
        console.error('Reimport failed:', err);
    }
}

reimport();
