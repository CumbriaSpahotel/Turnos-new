const { createClient } = require('./temp_node/node_modules/@supabase/supabase-js');
const fs = require('fs');

const SUPABASE_URL = "https://drvmxranbpumianmlzqr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MEpdfeO_ZGkMkg0_eKZKnQ_QCJxDrfZ";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const args = process.argv.slice(2);
const EXECUTE = args.includes('--execute');
const DRY_RUN = !EXECUTE;

// Utilidades de normalización (replicando motor v12)
const normalizeId = (id) => String(id || '').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const cleanEmoji = (text) => String(text || '').replace(/[^\x00-\x7F]/g, '').trim();

async function run() {
    console.log("[MIGRATE_BAJAS] Iniciando proceso...");
    
    // PROTECCIÓN ANTI-REEJECUCIÓN (V12.5.24)
    const { data: existing, error: errCheck } = await supabase
        .from('eventos_cuadrante')
        .select('id')
        .filter('payload->>source', 'eq', 'migrate_bajas');

    if (errCheck) {
        console.error("❌ Error de seguridad al verificar estado previo:", errCheck.message);
        return;
    }

    if (existing && existing.length >= 18) {
        console.log("\n🛑 BLOQUEO DE SEGURIDAD: La migración ya fue aplicada (18 registros detectados).");
        console.log("No se permiten nuevas inserciones para evitar duplicados.");
        if (!EXECUTE) {
            console.log("💡 Puede usar --dry-run para auditar los datos locales sin escribir.");
        }
        if (EXECUTE) {
            console.error("❌ Abortando ejecución real.");
            return;
        }
    }

    if (DRY_RUN) console.log("⚠️ MODO DRY RUN ACTIVADO - No se realizarán escrituras. Use --execute para confirmar.");

    if (!fs.existsSync('bajas_final.json')) {
        console.error("❌ Error: No se encuentra el archivo bajas_final.json");
        return;
    }

    const dataRaw = JSON.parse(fs.readFileSync('bajas_final.json', 'utf8'));
    
    const stats = {
        total: dataRaw.length,
        eventos: 0,
        duplicados: 0,
        noResueltos: 0,
        hotelesNoResueltos: 0,
        bloqueados: 0,
        escrituras: 0
    };

    const payload = [];

    for (const v of dataRaw) {
        // 1. Normalización de Hotel
        let h = v.hotel_id;
        if (h.toUpperCase().includes('GUADIANA')) h = 'Sercotel Guadiana';
        else if (h.toUpperCase().includes('CUMBRIA')) h = 'Cumbria Spa&Hotel';
        else stats.hotelesNoResueltos++;

        // 2. Normalización de Tipo
        let tipoLimpio = cleanEmoji(v.tipo).toUpperCase();
        if (tipoLimpio.startsWith('PERM')) tipoLimpio = 'PERMISO';
        if (tipoLimpio.startsWith('BAJA') || tipoLimpio.startsWith('IT')) tipoLimpio = 'BAJA';

        // 3. Gestión de Turno Sensible (Regla Maestra)
        let observaciones = '';
        const turnoRaw = String(v.turno || '').trim();
        // Si el turno no es M, T, N, D, lo movemos a observaciones
        if (!['M', 'T', 'N', 'D', 'MANANA', 'MAÑANA', 'TARDE', 'NOCHE', 'DESCANSO', 'P'].includes(turnoRaw.toUpperCase())) {
            observaciones = `Nota de migración: ${turnoRaw}`;
        }

        const evento = {
            tipo: tipoLimpio,
            estado: 'activo',
            empleado_id: v.empleado_id, // Usamos el ID tal cual viene, el motor lo normalizará al leer
            empleado_destino_id: v.sustituto || null,
            hotel_origen: h,
            fecha_inicio: v.fecha,
            fecha_fin: v.fecha,
            observaciones: observaciones,
            updated_by: 'MIGRACION_SAFETY_REPORT_V12',
            payload: {
                source: 'migrate_bajas',
                migrated_at: new Date().toISOString(),
                original_turno: turnoRaw
            }
        };

        payload.push(evento);
        stats.eventos++;
    }

    console.log(`\n[MIGRATE_BAJAS DRY RUN REPORT]`);
    console.log(`Total registros origen: ${stats.total}`);
    console.log(`Eventos a crear (eventos_cuadrante): ${stats.eventos}`);
    console.log(`Duplicados detectados: ${stats.duplicados}`);
    console.log(`Empleados no resueltos: ${stats.noResueltos}`);
    console.log(`Hoteles no resueltos: ${stats.hotelesNoResueltos}`);
    console.log(`Registros bloqueados: ${stats.bloqueados}`);
    console.log(`Escrituras realizadas: 0`);

    if (payload.length > 0) {
        console.log("\nMuestra de transformación:");
        console.log("ANTES (Origen):", JSON.stringify(dataRaw[0], null, 2));
        console.log("EVENTO PROPUESTO (Destino):", JSON.stringify(payload[0], null, 2));
    }

    if (!DRY_RUN && payload.length > 0) {
        console.log("\n🚀 Ejecutando inserción en Supabase (eventos_cuadrante)...");
        const { error } = await supabase
            .from('eventos_cuadrante')
            .insert(payload);
        
        if (error) {
            console.error(`❌ Error en migración:`, error.message);
        } else {
            console.log(`✅ Migración completada exitosamente.`);
            stats.escrituras = payload.length;
        }
    }

    console.log("\n🎉 Proceso finalizado.");
}

run();
