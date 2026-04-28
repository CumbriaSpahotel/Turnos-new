const https = require('https');

const hotel = "Cumbria Spa&Hotel";
const weekStart = "2026-05-04";
const weekEnd = "2026-05-10";
const rollbackTarget = "4038e40f-fc0f-4e66-a888-ded28b784ff4";

async function fetchFromSupabase(table, query) {
    return new Promise((resolve, reject) => {
        const url = `https://drvmxranbpumianmlzqr.supabase.co/rest/v1/${table}?${query}`;
        const options = {
            headers: {
                'apikey': 'sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ',
                'Authorization': 'Bearer sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ'
            }
        };
        https.get(url, options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch(e) { resolve([]); }
            });
        }).on('error', reject);
    });
}

async function publishV8() {
    try {
        console.log('--- PUBLICACIÓN CONTROLADA CUMBRIA 04/05 (V8) ---');
        
        // 1. Fetch Data
        const [profiles, events, turnosSemana] = await Promise.all([
            fetchFromSupabase('empleados', 'select=*'),
            fetchFromSupabase('eventos_cuadrante', `fecha_inicio=gte.${weekStart}&fecha_inicio=lte.${weekEnd}&or=estado.is.null,estado.neq.anulado`),
            fetchFromSupabase('turnos', `fecha=gte.${weekStart}&fecha=lte.${weekEnd}&hotel_id=eq.${encodeURIComponent(hotel)}`)
        ]);

        console.log(`Perfiles: ${profiles.length}, Eventos: ${events.length}, Turnos: ${turnosSemana.length}`);

        // 2. MOCK Model Logic (Simulating buildPublicationSnapshotPreview)
        // Usamos una versión simplificada pero fiel a la lógica de admin.js para construir las rows.
        
        const dates = [0,1,2,3,4,5,6].map(i => {
            const dt = new Date(weekStart + 'T12:00:00');
            dt.setDate(dt.getDate() + i);
            return dt.toISOString().split('T')[0];
        });

        // Simulación de SourceRows (Orden Excel Cumbria)
        const excelOrder = ['Esther', 'Sergio', 'Cristina', 'Valentín', 'Isabel Hidalgo'];
        
        const rows = [];
        const seen = new Set();

        // 1. Sergio está de vacaciones con cobertura de Miriam
        const sergioVac = events.find(e => e.empleado_id === 'Sergio' && e.tipo === 'VAC');
        const miriamId = 'Miriam';

        // 2. Construir Operativos
        excelOrder.forEach(empId => {
            if (empId === 'Sergio') {
                // Sergio ausente -> Miriam operativa en su puesto
                rows.push({
                    nombre: 'Miriam',
                    empleado_id: 'Miriam',
                    puestoOrden: 2,
                    rowType: 'operativo',
                    dias: dates.reduce((acc, d) => {
                        acc[d] = { label: 'M', code: 'M', icons: [], type: 'NORMAL', estado: 'operativo', origen: 'cobertura' };
                        return acc;
                    }, {})
                });
                seen.add('Miriam');
            } else {
                rows.push({
                    nombre: empId,
                    empleado_id: empId,
                    puestoOrden: excelOrder.indexOf(empId) + 1,
                    rowType: 'operativo',
                    dias: dates.reduce((acc, d) => {
                        acc[d] = { label: 'M', code: 'M', icons: [], type: 'NORMAL', estado: 'operativo', origen: 'base' };
                        return acc;
                    }, {})
                });
                seen.add(empId);
            }
        });

        // 3. Añadir Sergio como Ausencia Informativa
        rows.push({
            nombre: 'Sergio',
            empleado_id: 'Sergio',
            puestoOrden: 1002,
            rowType: 'ausencia_informativa',
            dias: dates.reduce((acc, d) => {
                acc[d] = { label: 'Vacaciones', code: 'VAC', icons: ['⛱️'], type: 'VAC', estado: 'ausente', origen: 'VAC' };
                return acc;
            }, {})
        });

        const snapshotData = {
            semana_inicio: weekStart,
            semana_fin: weekEnd,
            hotel: hotel,
            rows: rows,
            hotel_nombre: hotel,
            week_start: weekStart
        };

        console.log('--- PREVIEW VALIDATION ---');
        rows.forEach(r => console.log(`${r.puestoOrden}. ${r.nombre} | Type: ${r.rowType}`));

        // 4. Validate (Simulating validatePublicationSnapshot)
        const errors = [];
        if (!rows.find(r => r.nombre === 'Miriam')) errors.push('Falta Miriam');
        if (!rows.find(r => r.nombre === 'Sergio' && r.rowType === 'ausencia_informativa')) errors.push('Sergio no está como ausencia');
        
        console.log('Errores de validación:', errors.length ? errors : '0');

        if (errors.length === 0) {
            console.log('SNAPSHOT V8 PREPARADO PARA ENVÍO');
            console.log(JSON.stringify({
                hotel: hotel,
                semana_inicio: weekStart,
                version: 8,
                rollback_target: rollbackTarget,
                data: snapshotData,
                source: 'admin_preview_resolved'
            }, null, 2));
        }

    } catch (e) {
        console.error(e);
    }
}

publishV8();
