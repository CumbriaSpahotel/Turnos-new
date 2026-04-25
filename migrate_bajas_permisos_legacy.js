/**
 * migrate_bajas_permisos_legacy.js  –  v2.0
 *
 * REGLAS OPERATIVAS:
 *  - Todo evento va a eventos_cuadrante (fuente de verdad)
 *  - NUNCA se borra físicamente: anular = UPDATE estado='anulado'
 *  - Migración idempotente: no duplica si ya existe evento equivalente
 *  - Legacy no se toca ni se borra
 *  - La auditoría de la migración queda en publicaciones_log
 *
 * DATOS LEGACY (11 grupos pre-agrupados):
 *   A  Cristina  / Gustavo Sánchez  / PERMISO / 04–05/oct/25
 *   B  Cristina  / Isabel Hidalgo   / PERMISO / 06/oct/25
 *   C  Cristina  / Miriam           / PERMISO / 07/oct/25
 *   D  Cristina  / Isabel Hidalgo   / PERMISO / 08/oct/25
 *   E  Esther    / Natalio          / PERMISO / 29–30/nov/25  (sin obs)
 *   F  Esther    / Natalio          / PERMISO / 01/dic/25     (Muerte del Padre)
 *   G  Sergio    / Natalio          / BAJA    / 29–30/dic/25
 *   H  Sergio    / sin sustituto    / BAJA    / 31/dic/25     (Baja - Pater)
 *   I  Sergio Sánchez / Natalio     / PERMISO / 17/feb/26
 *   J  Diana     / Natalio          / PERMISO / 04–08/mar/26  (Operación Nacho)
 *   K  Sergio Sánchez / Natalio     / PERMISO / 09/abr/26
 *
 * USO (desde consola de admin.html):
 *   window.migrateBajasPermisosPrueba()    ← solo grupo J (Diana, test)
 *   window.migrateBajasPermisosLegacy()    ← todos los grupos (requiere autorización)
 */

// ─── GRUPOS LEGACY PRE-AGRUPADOS ──────────────────────────────────────────────
const GRUPOS_LEGACY = [
    // A - Cristina / Gustavo Sánchez / 04-05 oct 2025
    {
        grupo: 'A',
        hotel: 'Cumbria Spa&Hotel',
        titular: 'Cristina',
        tipo: 'PERMISO',
        fi: '2025-10-04',
        ff: '2025-10-05',
        sustituto: 'Gustavo Sanchez',
        observacion: 'Permiso octubre 2025',
        registros_origen: [
            { fecha: 'sa 04/oct 25' },
            { fecha: 'do 05/oct 25' }
        ]
    },
    // B - Cristina / Isabel Hidalgo / 06 oct 2025
    {
        grupo: 'B',
        hotel: 'Cumbria Spa&Hotel',
        titular: 'Cristina',
        tipo: 'PERMISO',
        fi: '2025-10-06',
        ff: '2025-10-06',
        sustituto: 'Isabel Hidalgo',
        observacion: 'Permiso octubre 2025',
        registros_origen: [{ fecha: 'lu 06/oct 25' }]
    },
    // C - Cristina / Miriam / 07 oct 2025
    {
        grupo: 'C',
        hotel: 'Cumbria Spa&Hotel',
        titular: 'Cristina',
        tipo: 'PERMISO',
        fi: '2025-10-07',
        ff: '2025-10-07',
        sustituto: 'Miriam',
        observacion: 'Permiso octubre 2025',
        registros_origen: [{ fecha: 'ma 07/oct 25' }]
    },
    // D - Cristina / Isabel Hidalgo / 08 oct 2025  (no consecutivo con B)
    {
        grupo: 'D',
        hotel: 'Cumbria Spa&Hotel',
        titular: 'Cristina',
        tipo: 'PERMISO',
        fi: '2025-10-08',
        ff: '2025-10-08',
        sustituto: 'Isabel Hidalgo',
        observacion: 'Permiso octubre 2025',
        registros_origen: [{ fecha: 'mi 08/oct 25' }]
    },
    // E - Esther / Natalio / 29-30 nov 2025 (sin observación)
    {
        grupo: 'E',
        hotel: 'Cumbria Spa&Hotel',
        titular: 'Esther',
        tipo: 'PERMISO',
        fi: '2025-11-29',
        ff: '2025-11-30',
        sustituto: 'Natalio',
        observacion: '',
        registros_origen: [
            { fecha: 'sa 29/nov 25' },
            { fecha: 'do 30/nov 25' }
        ]
    },
    // F - Esther / Natalio / 01 dic 2025 (obs diferente: Muerte del Padre)
    {
        grupo: 'F',
        hotel: 'Cumbria Spa&Hotel',
        titular: 'Esther',
        tipo: 'PERMISO',
        fi: '2025-12-01',
        ff: '2025-12-01',
        sustituto: 'Natalio',
        observacion: 'Muerte del Padre',
        registros_origen: [{ fecha: 'lu 01/dic 25' }]
    },
    // G - Sergio / Natalio / 29-30 dic 2025 (Baja)
    {
        grupo: 'G',
        hotel: 'Cumbria Spa&Hotel',
        titular: 'Sergio',
        tipo: 'BAJA',
        fi: '2025-12-29',
        ff: '2025-12-30',
        sustituto: 'Natalio',
        observacion: 'Estar con sus hijos la manana del 6 de enero.',
        registros_origen: [
            { fecha: 'lu 29/dic 25' },
            { fecha: 'ma 30/dic 25' }
        ]
    },
    // H - Sergio / sin sustituto / 31 dic 2025 (Baja - Pater)
    {
        grupo: 'H',
        hotel: 'Cumbria Spa&Hotel',
        titular: 'Sergio',
        tipo: 'BAJA',
        fi: '2025-12-31',
        ff: '2025-12-31',
        sustituto: null,
        observacion: 'Baja - Pater',
        registros_origen: [{ fecha: 'mi 31/dic 25' }]
    },
    // I - Sergio Sánchez / Natalio / 17 feb 2026
    {
        grupo: 'I',
        hotel: 'Sercotel Guadiana',
        titular: 'Sergio Sanchez',
        tipo: 'PERMISO',
        fi: '2026-02-17',
        ff: '2026-02-17',
        sustituto: 'Natalio',
        observacion: '',
        registros_origen: [{ fecha: 'ma 17/feb 26' }]
    },
    // J - Diana / Natalio / 04-08 mar 2026  (Operación Nacho)
    {
        grupo: 'J',
        hotel: 'Sercotel Guadiana',
        titular: 'Diana',
        tipo: 'PERMISO',
        fi: '2026-03-04',
        ff: '2026-03-08',
        sustituto: 'Natalio',
        observacion: 'Operacion Nacho',
        registros_origen: [
            { fecha: 'mi 04/mar 26' },
            { fecha: 'ju 05/mar 26' },
            { fecha: 'vi 06/mar 26' },
            { fecha: 'sa 07/mar 26' },
            { fecha: 'do 08/mar 26' }
        ]
    },
    // K - Sergio Sánchez / Natalio / 09 abr 2026
    {
        grupo: 'K',
        hotel: 'Sercotel Guadiana',
        titular: 'Sergio Sanchez',
        tipo: 'PERMISO',
        fi: '2026-04-09',
        ff: '2026-04-09',
        sustituto: 'Natalio',
        observacion: '',
        registros_origen: [{ fecha: 'ju 09/abr 26' }]
    }
];

// ─── FUNCIÓN NÚCLEO ───────────────────────────────────────────────────────────
async function _ejecutarMigracion(grupos, etiqueta) {
    const client = window.supabase;
    if (!client) {
        console.error('❌ Supabase no disponible.');
        return { ok: false, error: 'Supabase no disponible' };
    }

    console.group(`🚀 MIGRACIÓN BAJAS/PERMISOS LEGACY [${etiqueta}]`);
    console.log(`📋 Grupos a procesar: ${grupos.length}`);

    // ── 1. Cargar eventos existentes para check de duplicados ─────────────────
    const { data: existentes, error: chkErr } = await client
        .from('eventos_cuadrante')
        .select('id, tipo, empleado_id, empleado_destino_id, fecha_inicio, fecha_fin, observaciones, estado')
        .in('tipo', ['BAJA', 'PERMISO'])
        .neq('estado', 'anulado');

    if (chkErr) {
        console.error('❌ Error verificando duplicados:', chkErr.message);
        console.groupEnd();
        return { ok: false, error: chkErr };
    }

    console.log(`🔍 Eventos BAJA/PERMISO activos existentes: ${(existentes || []).length}`);

    // ── 2. Clasificar: a insertar vs omitidos ─────────────────────────────────
    const toInsert = [];
    const skipped  = [];
    const auditDetalle = [];

    for (const g of grupos) {
        const normTitular = (g.titular || '').toLowerCase().trim();
        const normSust    = (g.sustituto || '').toLowerCase().trim();

        const isDuplicate = (existentes || []).some(e => {
            const eTitular = (e.empleado_id || '').toLowerCase().trim();
            const eSust    = (e.empleado_destino_id || '').toLowerCase().trim();
            const eFi = String(e.fecha_inicio || '').slice(0, 10);
            const eFf = String(e.fecha_fin    || e.fecha_inicio || '').slice(0, 10);
            const tipoOk  = e.tipo === g.tipo;
            const titOk   = eTitular === normTitular ||
                            eTitular.includes(normTitular) ||
                            normTitular.includes(eTitular);
            const sustOk  = (!normSust && !eSust) ||
                            eSust === normSust ||
                            eSust.includes(normSust) ||
                            normSust.includes(eSust);
            const overlap = g.fi <= eFf && g.ff >= eFi;
            return tipoOk && titOk && sustOk && overlap;
        });

        if (isDuplicate) {
            console.log(`  ⏭ [${g.grupo}] Omitido (duplicado): ${g.tipo} ${g.titular} ${g.fi}–${g.ff}`);
            skipped.push(g);
            auditDetalle.push({ grupo: g.grupo, accion: 'omitido_duplicado', titular: g.titular, fi: g.fi, ff: g.ff });
            continue;
        }

        const obs = [
            g.observacion || '',
            `Migrado desde legacy bajas/permisos [grupo ${g.grupo}]`
        ].filter(Boolean).join(' | ');

        const payload = {
            tipo:              g.tipo,
            estado:            'activo',
            empleado_id:       g.titular,
            empleado_destino_id: g.sustituto || null,
            hotel_origen:      g.hotel,
            fecha_inicio:      g.fi,
            fecha_fin:         g.ff,
            turno_nuevo:       null,
            turno_original:    null,
            observaciones:     obs,
            payload: {
                origen:           'legacy_bajas_permisos',
                fuente:           'tabla_usuario_legacy',
                grupo_migracion:  g.grupo,
                sustituto_nombre: g.sustituto || null,
                registros_origen: g.registros_origen,
                migrado_en:       new Date().toISOString()
            },
            updated_at:   new Date().toISOString(),
            updated_by:   'MIGRACION_LEGACY_BP_v2'
        };

        console.log(`  📦 [${g.grupo}] A insertar: ${g.tipo} ${g.titular} ${g.fi}–${g.ff} (sust: ${g.sustituto || 'ninguno'})`);
        toInsert.push({ grupo: g.grupo, payload });
    }

    if (toInsert.length === 0) {
        console.log('✅ Sin nuevos registros (todos ya existían o fueron omitidos).');
        console.groupEnd();
        return { ok: true, inserted: 0, skipped: skipped.length, grupos_procesados: grupos.length };
    }

    // ── 3. Insertar ───────────────────────────────────────────────────────────
    const { data: insertResult, error: insertError } = await client
        .from('eventos_cuadrante')
        .insert(toInsert.map(x => x.payload))
        .select('id, tipo, empleado_id, empleado_destino_id, fecha_inicio, fecha_fin, estado, observaciones');

    if (insertError) {
        console.error('❌ Error insertando:', insertError.message);
        console.groupEnd();
        return { ok: false, error: insertError };
    }

    // Enriquecer auditDetalle con IDs reales
    insertResult.forEach((r, idx) => {
        const g = toInsert[idx];
        auditDetalle.push({
            grupo:   g?.grupo,
            accion:  'migrado_legacy_bajas_permisos',
            id:      r.id,
            tipo:    r.tipo,
            titular: r.empleado_id,
            sust:    r.empleado_destino_id,
            fi:      r.fecha_inicio,
            ff:      r.fecha_fin,
            estado:  r.estado
        });
    });

    console.log(`✅ Insertados correctamente:`);
    console.table(insertResult.map(r => ({
        id: r.id?.slice(0, 8) + '…',
        tipo: r.tipo,
        titular: r.empleado_id,
        sust: r.empleado_destino_id || '—',
        fi: r.fecha_inicio,
        ff: r.fecha_fin,
        estado: r.estado
    })));

    // ── 4. Registrar en publicaciones_log (auditoría de la migración) ─────────
    try {
        await client.from('publicaciones_log').insert({
            usuario:               'MIGRACION_LEGACY_BP_v2',
            cambios_totales:       insertResult.length,
            empleados_afectados:   new Set(insertResult.map(r => r.empleado_id)).size,
            resumen_json:          {
                etiqueta,
                grupos_procesados: grupos.length,
                insertados:        insertResult.length,
                omitidos:          skipped.length,
                timestamp:         new Date().toISOString()
            },
            cambios_detalle_json:  auditDetalle,
            estado:                'ok',
            revertida:             false
        });
        console.log('📋 Auditoría registrada en publicaciones_log');
    } catch (auditErr) {
        console.warn('⚠️ Auditoría no guardada (no crítico):', auditErr?.message || auditErr);
    }

    console.log(`\n🎉 MIGRACIÓN COMPLETA [${etiqueta}]`);
    console.log(`  Registros raw procesados: ${grupos.reduce((s, g) => s + g.registros_origen.length, 0)}`);
    console.log(`  Grupos generados:         ${grupos.length}`);
    console.log(`  Insertados:               ${insertResult.length}`);
    console.log(`  Omitidos (duplicados):    ${skipped.length}`);
    console.log(`  Legacy: NO MODIFICADO`);
    console.log(`\n➡️  Recarga admin.html y navega a Vista Previa o bajas.html para ver los registros`);

    console.groupEnd();
    return {
        ok:                true,
        inserted:          insertResult.length,
        skipped:           skipped.length,
        grupos_procesados: grupos.length,
        registros_raw:     grupos.reduce((s, g) => s + g.registros_origen.length, 0),
        insertedIds:       insertResult.map(r => r.id),
        auditDetalle
    };
}

// ─── FUNCIÓN DE PRUEBA: solo grupo J (Diana) ──────────────────────────────────
window.migrateBajasPermisosPrueba = async function () {
    const prueba = GRUPOS_LEGACY.filter(g => g.grupo === 'J');
    console.log('🧪 MODO PRUEBA: solo grupo J (Diana 04–08/mar/26)');
    return await _ejecutarMigracion(prueba, 'PRUEBA DIANA J');
};

// ─── FUNCIÓN COMPLETA: todos los grupos (REQUIERE AUTORIZACIÓN) ───────────────
window.migrateBajasPermisosLegacy = async function () {
    console.warn('⚠️ MIGRACIÓN COMPLETA — 11 grupos, 18 registros raw');
    console.warn('⚠️ Asegúrate de tener autorización para todos los registros');
    return await _ejecutarMigracion(GRUPOS_LEGACY, 'COMPLETA 11 GRUPOS');
};

// ─── FUNCIÓN ANULAR SEGURA (sin DELETE, solo UPDATE estado) ─────────────────
window.anularEventoSeguro = async function (eventoId, motivo) {
    const client = window.supabase;
    if (!client || !eventoId) { console.error('Parámetros inválidos'); return; }
    const { data, error } = await client
        .from('eventos_cuadrante')
        .update({
            estado:       'anulado',
            updated_at:   new Date().toISOString(),
            updated_by:   'ADMIN_MANUAL',
            observaciones: motivo ? `[ANULADO: ${motivo}]` : '[ANULADO]'
        })
        .eq('id', eventoId)
        .select('id, tipo, empleado_id, estado');
    if (error) { console.error('❌ Error anulando:', error.message); return; }
    console.log('✅ Evento anulado (NO borrado):', data);
    return data;
};

console.log('📦 migrate_bajas_permisos_legacy.js v2.0 cargado.');
console.log('  window.migrateBajasPermisosPrueba()  ← test: solo grupo J (Diana)');
console.log('  window.migrateBajasPermisosLegacy()  ← completa: 11 grupos (previa autorización)');
console.log('  window.anularEventoSeguro(id, motivo) ← anula sin borrar');
