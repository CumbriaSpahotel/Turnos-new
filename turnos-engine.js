(function () {
    // =========================================================
    // TURNOSWEB ENGINE v3.0
    // =========================================================
    // PIPELINE:
    //   [Base Excel] + [Eventos/Overrides] → ShiftResolver → FinalState
    //   → adaptFinalStateToCell() → cell (compatibilidad UI)
    //
    // El engine ya NO toma decisiones sobre:
    //   - quién hereda el turno de quién
    //   - qué significa CT o ''
    //   - prioridad entre eventos
    // Toda esa lógica vive en ShiftResolver.
    //
    // El engine SÍ sigue responsable de:
    //   - orden de filas (sourceRows del Excel)
    //   - separar ausentes al final (trailingAbsents)
    //   - construir la cuadrícula semanal (mergeDayRosters)
    //   - convertir FinalState al formato cell legacy (adaptador temporal)
    // =========================================================

    // ── SEMÁNTICA LEGACY DOCUMENTADA ──────────────────────────────────────
    // (Este bloque es la única fuente de verdad sobre el legacy. No copiar.)
    //
    //  ''  (vacío) → El empleado no tiene turno planificado ese día.
    //               Se interpreta como DESCANSO en ShiftResolver.
    //               NO significa "sin dato" ni "error de carga".
    //               RESERVADO: Se mantendrá como convención temporal hasta
    //               que el cuadrante base se migre a usar 'D' explícito.
    //
    //  'CT' (string) → Significa "Cambio de Turno" marcado desde UI legacy.
    //               Si la fila tiene evento_id → tratado como INTERCAMBIO_TURNO
    //               Si la fila NO tiene evento_id → override manual legacy.
    //               El campo `turno` real (ej. 'T') siempre prevalece sobre 'CT'.
    //               El resolver normaliza este valor; el engine no lo debe interpretar.
    // ─────────────────────────────────────────────────────────────────────

    // ── ADAPTADOR TEMPORAL ────────────────────────────────────────────────
    // Convierte un FinalState (salida de ShiftResolver) al objeto `cell`
    // que esperan actualmente las vistas (index.html, admin.js, mobile.app.js).
    // Responsabilidad: SÓLO adaptación de estructura. Cero lógica operativa.
    // Será eliminado en Fase 4 cuando las vistas lean FinalState directamente.
    const adaptFinalStateToCell = (finalState) => {
        if (!finalState) return null;

        // Determinar el valor de `turno` y `tipo` que esperan las vistas legacy
        let turno, tipo;

        if (finalState.isAbsence) {
            turno = ''; // El ausente no muestra turno visible principal
            tipo  = finalState.estadoFinal; // 'VACACIONES', 'BAJA', 'PERM'…
        } else if (finalState.isModified) {
            // Viene de un cambio/intercambio/sustitución/refuerzo
            turno = finalState.turnoFinal || '';
            tipo  = 'CT'; // Las vistas legacy usan CT para disparar el icono 🔄
        } else {
            turno = finalState.turnoFinal || '';
            tipo  = 'NORMAL';
        }

        return {
            // Campos que todas las vistas leen:
            empleado_id:        finalState.employeeId,
            fecha:              finalState.date,
            turno,
            tipo,
            hotel_id:           finalState.hotelFinal,

            // Campos de relación (tooltip, ficha)
            sustituto:          finalState.coveredByEmployeeId || finalState.coversEmployeeId || null,
            coveringFor:        finalState.coversEmployeeId    || null,
            coveredBy:          finalState.coveredByEmployeeId || null,

            // Metadatos para diagnóstico
            evento_id:          finalState.appliedEventId || null,
            evento_tipo:        finalState.sourceReason   || null,
            _finalState:        finalState // Referencia al objeto completo (para vistas futuras)
        };
    };

    const normalizeString = (value) => String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();

    const normalizeHotelKey = (value) => normalizeString(value);

    const employeeTypeKey = (value) => normalizeString(value || 'fijo').replace(/\s+/g, '_');

    const profileMap = (employees = []) => {
        const map = new Map();
        employees.forEach(profile => {
            [profile?.id, profile?.nombre].forEach(value => {
                const key = normalizeString(value);
                if (key && !map.has(key)) map.set(key, profile);
            });
        });
        return map;
    };

    const profileFor = (profilesByNorm, norm) => profilesByNorm.get(norm) || null;

    const employeeComputesForStats = (profile) => {
        const key = employeeTypeKey(profile?.tipo_personal || profile?.contrato);
        return key !== 'ocasional' && key !== 'eventual' && key !== 'apoyo' && key !== 'apollo';
    };

    // =========================================================
    // buildDayRoster v3.0 — Delega en ShiftResolver
    // =========================================================
    // El engine ya NO hace:
    //   ✗ substitutionMap / substituteUsedAt
    //   ✗ buildSupabaseIndex (overrides vs absences)
    //   ✗ herencia de turnos del compañero (excelShift)
    //   ✗ resolución de CT vacíos mediante candidates
    //
    // El engine SÍ hace:
    //   ✓ Construir baseRows para cada sourceRow (para ShiftResolver)
    //   ✓ Extraer manualOverrides del día de rows (tabla turnos)
    //   ✓ Iterar sourceRows en orden Excel (sourceOrder)
    //   ✓ Separar ausentes al final (trailingAbsents)
    //   ✓ Adaptar FinalState → cell legacy (adaptFinalStateToCell)
    // =========================================================
    const buildDayRoster = ({
        rows = [],          // Datos de Supabase (tabla turnos + eventos ya combinados por DAO, temporalmente)
        events = [],        // Eventos crudos de eventos_cuadrante (para pasar al resolver)
        employees = [],
        date,
        hotel,
        sourceRows = [],
        sourceIndex = 0
    } = {}) => {
        if (!window.ShiftResolver || !window.ShiftResolver.resolveDay) {
            console.error('[Engine v3.0] Error: ShiftResolver o su metodo resolveDay no estan disponibles.', {
                resolver: window.ShiftResolver,
                engineVersion: '3.0.4.1'
            });
            return [];
        }

        const profilesByNorm = profileMap(employees);
        const canonicalize   = (name) => {
            const n = normalizeString(name);
            const profile = profilesByNorm.get(n);
            return profile ? normalizeString(profile.id || profile.nombre || name) : n;
        };

        // ── 1. Construir baseRows para el resolver ─────────────────────────
        // Combinamos sourceRows (Excel) con perfiles (Employees) del hotel
        const baseRows = [];
        const baseNorms = new Set();

        // A. Prioridad: Orden del Excel
        sourceRows.forEach(sRow => {
            const norm = canonicalize(sRow.empleadoId);
            baseRows.push({
                empleadoId: sRow.empleadoId,
                hotel:      hotel,
                turno:      sRow.values[sourceIndex] || ''
            });
            baseNorms.add(norm);
        });

        // B. Fallback: Empleados que pertenecen a este hotel pero no están en el Excel
        employees.forEach(emp => {
            const norm = canonicalize(emp.id || emp.nombre);
            if (!baseNorms.has(norm)) {
                const empHotel = normalizeHotelKey(emp.hotel_id || emp.hotel);
                if (empHotel === normalizeHotelKey(hotel)) {
                    baseRows.push({
                        empleadoId: emp.id || emp.nombre,
                        hotel:      hotel,
                        turno:      '' // Descanso por defecto
                    });
                    baseNorms.add(norm);
                }
            }
        });

        // ── 2. Manual overrides del día (tabla turnos, sin eventos calculados) ─
        // NOTA TEMPORAL: mientras el DAO siga usando aplicarEventosCuadrante,
        // `rows` ya trae los eventos mezclados. Los separamos heurísticamente:
        //   - Si tiene evento_id → ya es resultado de un evento → lo excluimos
        //     de manualOverrides (el resolver lo leerá via `events`).
        //   - Si NO tiene evento_id → override manual o legacy CT → pasa como manualOverride.
        const manualOverrides = rows
            .filter(r => {
                if (r?.fecha !== date) return false;
                if (r?.evento_id) return false; // Excluir resultados de eventos
                
                // Si estamos en un hotel específico, solo traer overrides que:
                // 1. Sean del hotel actual
                // 2. O sean de un empleado que pertenece a este hotel originalmente
                if (hotel) {
                    const rHotel = normalizeHotelKey(r.hotel_id);
                    const hKey   = normalizeHotelKey(hotel);
                    if (rHotel === hKey) return true;

                    const profile = profileFor(profilesByNorm, r.empleado_id);
                    const pHotel  = profile ? normalizeHotelKey(profile.hotel_id || profile.hotel) : null;
                    return pHotel === hKey;
                }
                return true;
            })
            .map(r => ({ ...r }));

        // ── 3. Invocar ShiftResolver ───────────────────────────────────────
        const stateMap = window.ShiftResolver.resolveDay({
            date,
            employees,
            baseRows,
            events: events.filter(e => {
                // Filtrar eventos activos que cubren esta fecha
                if ((e.estado || 'activo') === 'anulado') return false;
                const from = e.fecha_inicio;
                const to   = e.fecha_fin || e.fecha_inicio;
                return from <= date && date <= to;
            }),
            manualOverrides
        });

        // ── 4. Debug ────────────────────────────────────────────────────────
        const debugDates = ['2026-04-20', '2026-04-25', '2026-04-26'];
        if (typeof window !== 'undefined' && (window._debugTurnos || debugDates.includes(date))) {
            console.group(`[Engine v3.0] date=${date} hotel=${hotel}`);
            console.log('sourceRows:', sourceRows.map(r => r.empleadoId));
            console.log('stateMap:', Object.fromEntries([...stateMap.entries()].map(
                ([k, v]) => [k, `${v.turnoFinal}|${v.estadoFinal}|mod:${v.isModified}|abs:${v.isAbsence}`]
            )));
            console.groupEnd();
        }

        // ── 5. Iterar sourceRows en orden Excel y construir entries ─────────
        const trailingAbsents = [];
        const mainEntries     = [];
        const renderedNorms   = new Set();

        sourceRows.forEach(sRow => {
            const norm    = canonicalize(sRow.empleadoId);
            if (renderedNorms.has(norm)) return;

            const profile = profileFor(profilesByNorm, normalizeString(sRow.empleadoId))
                         || profileFor(profilesByNorm, norm);

            const finalState = stateMap.get(norm);

            // Si el resolver no conoce a este empleado (no tenía base ni evento)
            // construimos un estado vacío desde el Excel
            const state = finalState || {
                employeeId:        sRow.empleadoId,
                date,
                hotelFinal:        hotel,
                turnoFinal:        sRow.values[sourceIndex] || null,
                estadoFinal:       'TRABAJANDO',
                isModified:        false,
                isAbsence:         false,
                coversEmployeeId:  null,
                coveredByEmployeeId: null,
                sourceReason:      'BASE_FALLBACK',
                appliedEventId:    null
            };

            const cell    = adaptFinalStateToCell(state);
            const isAbsent = state.isAbsence;

            const entry = {
                norm,
                id:          sRow.empleadoId,
                name:        sRow.displayName || sRow.empleadoId,
                displayAs:   sRow.displayName || sRow.empleadoId,
                profile,
                sourceOrder: sRow.rowIndex,
                isAbsent,
                cell,
                showStats:   employeeComputesForStats(profile),
                // Relaciones explícitas (para ficha y tooltip)
                substituting: state.coversEmployeeId   || null,
                substitutedBy: state.coveredByEmployeeId || null,
                // Referencia al estado final para vistas futuras
                _finalState: state
            };

            if (isAbsent) {
                trailingAbsents.push(entry);
            } else {
                mainEntries.push(entry);
            }
            renderedNorms.add(norm);

            // Si este empleado está siendo cubierto, el sustituto puede no aparecer
            // en sourceRows (es de otro hotel / es puntual). Asegurar que aparece.
            if (state.coveredByEmployeeId) {
                const subNorm = canonicalize(state.coveredByEmployeeId);
                if (!renderedNorms.has(subNorm) && stateMap.has(subNorm)) {
                    // Se renderizará al iterar su propio sourceRow (si existe),
                    // o en el bloque de sustitutos externos a continuación.
                }
            }
        });

        // Si el resolver creó un FinalState para alguien que no está en sourceRows
        // (ej: sustituto de otro hotel, o alguien en Supabase pero no en Excel), 
        // lo añadimos si su hotelFinal coincide.
        stateMap.forEach((state, norm) => {
            if (renderedNorms.has(norm)) return;

            // Solo añadir si el hotel final es este, o si está cubriendo a alguien de aquí
            const hKey = normalizeHotelKey(hotel);
            const stateHKey = normalizeHotelKey(state.hotelFinal);
            
            const isRelevant = (stateHKey === hKey) || (state.coversEmployeeId && stateHKey === hKey);
            if (!isRelevant) return;

            const profile   = profileFor(profilesByNorm, norm);
            const cell      = adaptFinalStateToCell(state);
            mainEntries.push({
                norm,
                id:           state.employeeId,
                name:         state.employeeId,
                displayAs:    state.employeeId,
                profile,
                sourceOrder:  9999,
                isAbsent:     false,
                cell,
                showStats:    employeeComputesForStats(profile),
                substituting: state.coversEmployeeId || null,
                substitutedBy: null,
                _finalState:  state
            });
            renderedNorms.add(norm);
        });

        // ── 7. Ordenar y devolver ──────────────────────────────────────────
        mainEntries.sort((a, b) => a.sourceOrder - b.sourceOrder);
        return [...mainEntries, ...trailingAbsents];
    };


    // =========================================================
    // mergeDayRosters — sin cambios respecto a v2
    // =========================================================
    const mergeDayRosters = ({ dayRosters = [], dates = [], hotel } = {}) => {
        if (!dayRosters.length) return { entries: [], dates };

        const allNorms   = [];
        const seenNorms  = new Set();
        dayRosters.forEach(dr => {
            dr.forEach(entry => {
                if (!seenNorms.has(entry.norm)) {
                    seenNorms.add(entry.norm);
                    allNorms.push(entry.norm);
                }
            });
        });

        const entriesByNorm = new Map();
        dayRosters[0].forEach(e => entriesByNorm.set(e.norm, { ...e, cells: [] }));

        dayRosters.forEach(dr => {
            dr.forEach(e => {
                if (!entriesByNorm.has(e.norm)) {
                    entriesByNorm.set(e.norm, { ...e, cells: [] });
                }
            });
        });

        dayRosters.forEach(dr => {
            const drByNorm = new Map(dr.map(e => [e.norm, e]));
            entriesByNorm.forEach((entry, norm) => {
                const dayEntry = drByNorm.get(norm);
                entry.cells.push(dayEntry ? dayEntry.cell : {
                    empleado_id: entry.id,
                    fecha:       null,
                    turno:       '',
                    tipo:        'NORMAL'
                });
            });
        });

        const entries = Array.from(entriesByNorm.values());
        return { entries, dates, dayRosters };
    };

    // =========================================================
    // buildRosterGrid — sin cambios en firma
    // =========================================================
    const buildRosterGrid = ({
        rows = [],
        events = [],
        employees = [],
        dates = [],
        hotel,
        sourceRows = []
    } = {}) => {
        const dayRosters = dates.map((date, idx) => buildDayRoster({
            rows,
            events,
            employees,
            date,
            hotel,
            sourceRows,
            sourceIndex: idx
        }));
        return mergeDayRosters({ dayRosters, dates, hotel });
    };

    // =========================================================
    // buildSupabaseIndex — CONSERVADO para compatibilidad temporal
    // (admin.js y otras vistas lo usan directamente)
    // Se marcará como @deprecated en Fase 3 (limpieza DAO)
    // =========================================================
    const buildSupabaseIndex = (rows = [], date, canonicalize = normalizeString) => {
        const overrides = new Map();
        const absences  = new Map();

        rows.filter(r => r?.fecha === date).forEach(r => {
            const norm = canonicalize(r.empleado_id);
            if (!norm) return;
            const isAbs = window.TurnosRules?.isAbsenceType(r.tipo);
            if (isAbs) absences.set(norm, r);
            else       overrides.set(norm, r);
        });

        return { overrides, absences };
    };

    window.TurnosEngine = {
        buildDayRoster,
        buildRosterGrid,
        mergeDayRosters,
        // Compatibilidad temporal
        buildSupabaseIndex,
        // Utilidades públicas
        normalizeString,
        normalizeHotelKey,
        employeeTypeKey,
        employeeComputesForStats,
        // Adaptador expuesto para que vistas puedan acceder al objeto cell
        adaptFinalStateToCell
    };
})();
