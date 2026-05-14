/* supabase-dao.js 
   MOTOR DE DATOS TURNOSWEB V8.1
   REGLAS DE ORO:
   - window.supabase como único cliente.
   - upsert con onConflict: 'empleado_id,fecha'.
   - Campos obligatorios: sustituto, hotel_id, updated_by.
   - Caché local con TTL de 5 minutos.
   - Normalización de fechas YYYY-MM-DD.
   - Manejo de errores en TODAS las operaciones.
*/

window.TurnosDB = {
    _channel: null,
    _syncTTL: 5 * 60 * 1000, 
    client: window.supabase || null, // Se asigna automáticamente si ya existe

    // --- UTILIDADES ---
    normalizeDate(d) {
        if (!d) return null;
        if (d instanceof Date) return d.toISOString().split('T')[0];
        if (typeof d === 'string') {
            if (d.includes('T')) return d.split('T')[0];
            // Soporte para DD/MM/YYYY
            if (d.includes('/')) {
                const parts = d.split('/');
                if (parts.length === 3) {
                    const day = parts[0].padStart(2, '0');
                    const month = parts[1].padStart(2, '0');
                    const year = parts[2].length === 2 ? '20' + parts[2] : parts[2];
                    return `${year}-${month}-${day}`;
                }
            }
        }
        return d;
    },

    normalizeString(str) {
        if (!str) return '';
        return String(str)
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .trim();
    },

    cleanName(str) {
        if (!str) return '';
        // Mantiene tildes pero quita espacios extra y caracteres invisibles
        return String(str).replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
    },

    fmtDateLegacy(date, headerMode = false) {
        if (!date) return '—';
        try {
            const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
            const dt = new Date(date + 'T12:00:00'); 
            const d = dt.getDate();
            const m = months[dt.getMonth()];
            const y = dt.getFullYear();
            
            const monthLabel = headerMode ? (m.charAt(0).toUpperCase() + m.slice(1)) : m;
            const yearLabel = headerMode ? y : String(y).slice(-2);
            
            return `${String(d).padStart(2,'0')}/${monthLabel}/${yearLabel}`;
        } catch(e) { return date; }
    },

    updateUISyncStatus(state) {
        const dot  = document.getElementById('syncDot');
        const text = document.getElementById('syncText');
        const help = document.getElementById('syncHelp');
        if (!dot || !text) return;
        const colors = { ok: '#10e898', error: '#ff5f57', warn: '#ffb23f' };
        dot.style.background = colors[state] || colors.warn;
        text.textContent = state === 'ok' ? 'Sincronizado' : (state === 'error' ? 'Error Nube' : 'Conectando...');
        if (help) help.style.display = (state === 'ok') ? 'none' : 'inline';
        window.realtimeActivo = (state === 'ok');
    },

    async fetchAll(makeQuery, pageSize = 1000) {
        const allRows = [];
        let from = 0;

        while (true) {
            const { data, error } = await makeQuery().range(from, from + pageSize - 1);
            if (error) throw error;

            const rows = data || [];
            allRows.push(...rows);

            if (rows.length < pageSize) break;
            from += pageSize;
        }

        return allRows;
    },

    // --- LECTURA ---
    async fetchTurnosBase(inicio, fin, hotel = 'all') {
        return this.fetchRango(inicio, fin, hotel);
    },

    async fetchRango(inicio, fin, hotel = 'all') {
        const client = window.supabase;
        const i = this.normalizeDate(inicio);
        const f = this.normalizeDate(fin);

        // [PROTECCIÓN V8.2] Validar rango antes de llamar a Supabase
        if (!i || !f || i === 'null' || f === 'null') {
            const errorMsg = `[fetchRango] Rango inválido detectado: inicio=${i}, fin=${f}`;
            console.error("[DAO ERROR]", errorMsg);
            throw new Error(errorMsg);
        }
        
        if (f < i) {
            const errorMsg = `[fetchRango] Fecha fin (${f}) anterior a inicio (${i})`;
            console.warn("[DAO WARN]", errorMsg);
            throw new Error(errorMsg);
        }

        const cacheKey = `turnos_${i}_${f}`;

        try {
            const now = Date.now();
            const cache = window.localforage ? await window.localforage.getItem(cacheKey) : null;

            // TEMP DEBUG (OBLIGATORIO V8.2)
            if (false && cache && (now - cache.timestamp < this._syncTTL)) {
                console.log("DAO: Cache Hit", cacheKey);
                this.initRealtime();
                return cache.raw;
            }

            const data = await this.fetchAll(() => {
                let q = client
                    .from('turnos')
                    .select('*')
                    .gte('fecha', i)
                    .lte('fecha', f);
                
                if (hotel && hotel !== 'all') {
                    q = q.eq('hotel_id', hotel);
                }

                return q.order('fecha', { ascending: true })
                    .order('empleado_id', { ascending: true });
            });

            if (window.localforage) await window.localforage.setItem(cacheKey, { timestamp: now, raw: data });
            this.updateUISyncStatus('ok');
            this.initRealtime();
            return data || [];

        } catch (err) {
            console.error("[ADMIN ERROR] DAO fetchRango", {
                message: err.message,
                stack: err.stack,
                range: { inicio: i, fin: f }
            });
            this.updateUISyncStatus('error');
            const fallback = window.localforage ? await window.localforage.getItem(cacheKey) : null;
            return fallback ? fallback.raw : [];
        }
    },

    async fetchTipo(tipo, inicio = null, fin = null) {
        const client = window.supabase;
        try {
            // Usamos ilike para que 'VAC' encuentre 'VAC 🏖️' etc.
            const data = await this.fetchAll(() => {
                let q = client.from('turnos').select('*').ilike('tipo', `${tipo}%`);
                if (inicio) q = q.gte('fecha', this.normalizeDate(inicio));
                if (fin) q = q.lte('fecha', this.normalizeDate(fin));
                return q.order('fecha', { ascending: false });
            });
            return data || [];
        } catch (err) {
            console.error("DAO Error (fetchTipo):", err);
            return [];
        }
    },

    async fetchEventos(inicio = null, fin = null, includeAnulados = false) {
        const client = window.supabase;
        const i = this.normalizeDate(inicio);
        const f = this.normalizeDate(fin);

        // [PROTECCIÓN V8.2] Si se pasan fechas, deben ser válidas
        if (inicio !== null && !i) throw new Error(`[fetchEventos] Inicio inválido: ${inicio}`);
        if (fin !== null && !f) throw new Error(`[fetchEventos] Fin inválido: ${fin}`);
        if (i && f && f < i) throw new Error(`[fetchEventos] Rango invertido: ${i} a ${f}`);

        try {
            const data = await this.fetchAll(() => {
                let q = client
                    .from('eventos_cuadrante')
                    .select('*');
                
                if (!includeAnulados) {
                    q = q.or('estado.is.null,estado.neq.anulado');
                }

                if (i && f) {
                    q = q.lte('fecha_inicio', f).or(`fecha_fin.is.null,fecha_fin.gte.${i}`);
                } else if (i) {
                    q = q.or(`fecha_fin.is.null,fecha_fin.gte.${i}`);
                } else if (f) {
                    q = q.lte('fecha_inicio', f);
                }

                return q.order('fecha_inicio', { ascending: true });
            });
            (data || []).forEach(ev => {
                const fecha = this.normalizeDate(ev.fecha_inicio || ev.fecha);
                const hotel = String(ev.hotel || ev.hotel_id || ev.hotel_origen || ev.hotel_destino || ev.payload?.hotel || ev.payload?.hotel_id || '').trim();
                const origen = String(ev.empleado_id || ev.empleado_nombre || ev.solicitante || ev.origen || ev.payload?.empleado_id || ev.payload?.solicitante || ev.payload?.origen || '').trim();
                const destino = String(ev.empleado_destino_id || ev.empleado_destino_nombre || ev.destino || ev.companero || ev['compañero'] || ev.participante_destino || ev.payload?.empleado_destino_id || ev.payload?.empleado_destino_nombre || ev.payload?.destino || ev.payload?.companero || ev.payload?.['compañero'] || '').trim();
                const tipo = String(ev.tipo || '').toUpperCase();
                const estado = String(ev.estado || 'activo').toLowerCase();
                if (fecha === '2026-10-21' && hotel === 'Sercotel Guadiana' && origen.toLowerCase() === 'dani' && estado !== 'anulado' && (tipo.includes('INTERCAMBIO') || tipo.includes('CAMBIO'))) {
                    console.log('[SONNET_EVENTO_RAW_OCTUBRE]', {
                        id: ev.id,
                        fecha,
                        hotel,
                        tipo: ev.tipo,
                        estado: ev.estado,
                        empleado_id: ev.empleado_id,
                        empleado_destino_id: ev.empleado_destino_id,
                        solicitante: ev.solicitante,
                        companero: ev.companero,
                        'compañero': ev['compañero'],
                        destino: ev.destino,
                        payload: ev.payload,
                        turno_original: ev.turno_original,
                        turno_nuevo: ev.turno_nuevo,
                        turno_solicitado: ev.turno_solicitado,
                        observacion: ev.observacion
                    });
                }
            });
            return data || [];
        } catch (err) {
            console.warn("DAO Aviso (fetchEventos):", err);
            return [];
        }
    },

    async upsertEvento(evento) {
        const client = window.supabase;
        try {
            if (!evento?.tipo || !evento?.fecha_inicio) {
                throw new Error("Tipo y fecha de inicio son obligatorios");
            }

            const { data: { session } } = await client.auth.getSession();
            const payload = {
                ...evento,
                fecha_inicio: this.normalizeDate(evento.fecha_inicio),
                fecha_fin: evento.fecha_fin ? this.normalizeDate(evento.fecha_fin) : null,
                estado: evento.estado || 'activo',
                payload: evento.payload || {},
                updated_by: session?.user?.email || 'WEB_ADMIN',
                updated_at: new Date().toISOString()
            };

            const { data, error } = await client
                .from('eventos_cuadrante')
                .upsert(payload)
                .select()
                .single();

            if (error) throw error;
            console.log("[ADMIN] DAO upsertEvento EXITOSO:", data);
            if (window.localforage) await window.localforage.clear();
            this.updateUISyncStatus('ok');
            return data;
        } catch (err) {
            console.error("[ADMIN ERROR] DAO upsertEvento FALLIDO", {
                message: err.message,
                evento: evento
            });
            this.updateUISyncStatus('error');
            throw err;
        }
    },

    async anularEventosPeticion(peticionId) {
        // Marcamos como anulados los eventos vinculados a esta petición
        const client = window.supabase;
        const { error } = await client
            .from('eventos_cuadrante')
            .update({ estado: 'anulado', updated_at: new Date().toISOString() })
            .eq('peticion_id', peticionId);
        if (error) console.warn("DAO: Error anulando eventos de peticion (no crítico):", error);
    },

    async anularEvento(id) {
        const client = window.supabase;
        try {
            if (!id) throw new Error("ID requerido");
            const { error } = await client
                .from('eventos_cuadrante')
                .update({ estado: 'anulado', updated_at: new Date().toISOString() })
                .eq('id', id);

            if (error) throw error;
            if (window.localforage) await window.localforage.clear();
            this.updateUISyncStatus('ok');
            return true;
        } catch (err) {
            console.error("DAO Error (anularEvento):", err);
            this.updateUISyncStatus('error');
            throw err;
        }
    },

    async fetchBajasPermisos(hotel = null, empleado = null) {
        try {
            const data = await this.fetchEventos();
            let res = (data || []).filter(ev => ev.tipo !== 'VAC');
            if (hotel && hotel !== 'all') {
                res = res.filter(ev => ev.hotel_origen === hotel);
            }
            if (empleado && empleado !== 'all') {
                res = res.filter(ev => ev.empleado_id === empleado);
            }
            return res.sort((a,b) => (b.fecha_inicio || '').localeCompare(a.fecha_inicio || ''));
        } catch (err) {
            console.error("DAO Error (fetchBajasPermisos):", err);
            return [];
        }
    },

    async fetchPeticiones() {
        const client = window.supabase;
        try {
            const { data, error } = await client
                .from('peticiones_cambio')
                .select('*')
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data || [];
        } catch (err) {
            console.error("DAO Error (fetchPeticiones):", err);
            return [];
        }
    },

    async actualizarEstadoPeticion(id, estado) {
        const client = window.supabase;
        try {
            if (!id) throw new Error("ID de peticion requerido");

            if (estado === 'aprobada') {
                const { data: peticion, error: fetchError } = await client
                    .from('peticiones_cambio')
                    .select('*')
                    .eq('id', id)
                    .single();
                if (fetchError) throw fetchError;
                await this.procesarAprobacionPeticion(peticion, { skipStateUpdate: true });
            } else if (['rechazada', 'rechazado', 'pendiente', 'anulada', 'anulado'].includes(estado)) {
                await this.anularEventosPeticion(id);
            }

            const { error } = await client
                .from('peticiones_cambio')
                .update({ estado })
                .eq('id', id);
            if (error) throw error;
            if (window.localforage) await window.localforage.clear();
            this.updateUISyncStatus('ok');
        } catch (err) {
            console.error("DAO Error (actualizarEstadoPeticion):", err);
            this.updateUISyncStatus('error');
            throw err;
        }
    },

    async savePeticionCambio(payload) {
        const client = window.supabase;
        try {
            const { error } = await client
                .from('peticiones_cambio')
                .insert([payload]);
            if (error) throw error;
            this.updateUISyncStatus('ok');
        } catch (err) {
            console.error("DAO Error (savePeticionCambio):", err);
            this.updateUISyncStatus('error');
            throw err;
        }
    },

    async anularEventosPeticion(peticionId) {
        const client = window.supabase;
        try {
            // Buscar eventos en eventos_cuadrante que tengan esta solicitud vinculada.
            const { error } = await client
                .from('eventos_cuadrante')
                .update({ estado: 'anulado', updated_at: new Date().toISOString() })
                .filter('payload->>peticion_id', 'eq', peticionId);
            
            if (error) console.warn("DAO Aviso (anularEventosPeticion):", error.message);
            if (window.localforage) await window.localforage.clear();
        } catch (e) {
            console.error("Error anulando eventos vinculados:", e);
        }
    },

    async procesarAprobacionPeticion(peticion, options = {}) {
        const client = window.supabase;
        try {
            if (!peticion?.id) throw new Error("Peticion invalida");
            await this.anularEventosPeticion(peticion.id);

            const fechas = Array.isArray(peticion.fechas) ? peticion.fechas : [];
            for (const f of fechas) {
                const fecha = this.normalizeDate(f.fecha);
                if (!fecha) continue;
                await this.upsertEvento({
                    tipo: peticion.companero ? 'INTERCAMBIO_TURNO' : 'CAMBIO_TURNO',
                    empleado_id: peticion.solicitante,
                    empleado_destino_id: peticion.companero || null,
                    hotel_origen: peticion.hotel || null,
                    hotel_destino: peticion.hotel_destino || peticion.hotel || null,
                    fecha_inicio: fecha,
                    fecha_fin: fecha,
                    turno_original: f.origen || null,
                    turno_nuevo: f.destino || null,
                    observaciones: `Aprobado desde Solicitudes: ${peticion.observaciones || ''}`.trim(),
                    payload: {
                        peticion_id: peticion.id,
                        original_data: f,
                        origen: f.origen || null,
                        destino: f.destino || null,
                        fuente: 'peticion_cambio'
                    }
                });
            }

            if (!options.skipStateUpdate) {
                const { error } = await client
                    .from('peticiones_cambio')
                    .update({ estado: 'aprobada' })
                    .eq('id', peticion.id);
                if (error) throw error;
                if (window.localforage) await window.localforage.clear();
                this.updateUISyncStatus('ok');
            }
        } catch (err) {
            console.error("DAO Error (procesarAprobacionPeticion):", err);
            this.updateUISyncStatus('error');
            throw err;
        }
    },

    async fetchMensajes(receptor = 'ADMIN') {
        const client = window.supabase;
        try {
            const { data, error } = await client
                .from('mensajes')
                .select('*')
                .eq('receptor', receptor)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data || [];
        } catch (err) {
            console.error("DAO Error (fetchMensajes):", err);
            return [];
        }
    },

    async marcarMensajeLeido(id) {
        const client = window.supabase;
        try {
            const { error } = await client
                .from('mensajes')
                .update({ leido: true })
                .eq('id', id);
            if (error) throw error;
        } catch (err) {
            console.error("DAO Error (marcarMensajeLeido):", err);
            throw err;
        }
    },

    async eliminarMensaje(id) {
        const client = window.supabase;
        try {
            const { error } = await client
                .from('mensajes')
                .delete()
                .eq('id', id);
            if (error) throw error;
        } catch (err) {
            console.error("DAO Error (eliminarMensaje):", err);
            throw err;
        }
    },

    async saveMensaje(payload) {
        const client = window.supabase;
        try {
            const { error } = await client
                .from('mensajes')
                .insert([payload]);
            if (error) throw error;
            this.updateUISyncStatus('ok');
        } catch (err) {
            console.error("DAO Error (saveMensaje):", err);
            this.updateUISyncStatus('error');
            throw err;
        }
    },



    // ──────────────────────────────────────────────────────────────────────
    // fetchRangoCalculado — FASE 3 — NUEVA FIRMA
    // Devuelve { rows, eventos } con los datos separados y crudos.
    // La resolución operativa la hace ShiftResolver (shift-resolver.js)
    // a través de TurnosEngine.buildRosterGrid().
    // ──────────────────────────────────────────────────────────────────────
    async fetchRangoCalculado(inicio, fin) {
        const rows    = await this.fetchRango(inicio, fin);
        const eventos = await this.fetchEventos(inicio, fin);
        return { rows, eventos };
    },

    async fetchTurnosBase(start, end, hotel = null) {
        const client = window.supabase;
        try {
            let q = client
                .from('turnos')
                .select('*')
                .gte('fecha', this.normalizeDate(start))
                .lte('fecha', this.normalizeDate(end))
                .order('hotel_id', { ascending: true })
                .order('empleado_id', { ascending: true })
                .order('fecha', { ascending: true });

            if (hotel && hotel !== 'Ver Todos' && hotel !== 'Todos los Hoteles' && hotel !== 'all') {
                q = q.eq('hotel_id', hotel);
            }

            const data = await this.fetchAll(() => q);
            return data || [];
        } catch (err) {
            console.error("DAO Error (fetchTurnosBase):", err);
            return [];
        }
    },


    async fetchVacaciones(inicio = null, fin = null) {
        // La tabla legacy `vacaciones` no existe en todos los despliegues.
        // La fuente activa son los turnos/eventos calculados con tipo VAC.
        return this.fetchTipo('VAC', inicio, fin);
    },

    // ──────────────────────────────────────────────────────────────────────
    // fetchBajasPermisos — Fuente segura y completa para el módulo de Bajas
    // REGLA: nunca filtra registros históricos por defecto.
    // REGLA: los registros anulados se muestran si el usuario los pide.
    // ──────────────────────────────────────────────────────────────────────
    async fetchBajasPermisos({ hotel = null, empleado = null, estadoFiltro = 'activos', fechaInicio = null, fechaFin = null } = {}) {
        const client = window.supabase;
        const TIPOS_BAJA = ['BAJA', 'PERM', 'PERMISO']; // unificado: acepta ambas variantes
        const ESTADO_ANULADO = /^(anulad|rechazad|cancelad)/i;

        try {
            // Rango base: 3 años atrás hasta 2 años adelante para historial completo
            const hoy = new Date().toISOString().split('T')[0];
            const baseStart = fechaInicio || (() => {
                const d = new Date(); d.setFullYear(d.getFullYear() - 3); return d.toISOString().split('T')[0];
            })();
            const baseEnd = fechaFin || (() => {
                const d = new Date(); d.setFullYear(d.getFullYear() + 2); return d.toISOString().split('T')[0];
            })();

            // Fetch amplio — el filtrado de estado se hace en cliente para no perder histórico
            let q = client
                .from('eventos_cuadrante')
                .select('*')
                .or('estado.is.null,estado.neq.anulado') // base: traer todo excepto anulados explícitos
                .in('tipo', TIPOS_BAJA)
                .lte('fecha_inicio', baseEnd);

            // Si el usuario pide anulados o todos, traer también los anulados
            if (estadoFiltro === 'anulados' || estadoFiltro === 'all') {
                // Re-query sin filtro de estado para incluir anulados
                q = client
                    .from('eventos_cuadrante')
                    .select('*')
                    .in('tipo', TIPOS_BAJA)
                    .lte('fecha_inicio', baseEnd);
            }

            if (fechaInicio) q = q.gte('fecha_inicio', fechaInicio);

            const { data, error } = await q.order('fecha_inicio', { ascending: false });
            if (error) throw error;

            let resultado = data || [];

            // Filtros en cliente (no destructivos)
            if (estadoFiltro === 'activos') {
                resultado = resultado.filter(ev => {
                    if (ESTADO_ANULADO.test(ev.estado || '')) return false;
                    const fin = this.normalizeDate(ev.fecha_fin || ev.fecha_inicio);
                    return fin >= hoy;
                });
            } else if (estadoFiltro === 'finalizados') {
                resultado = resultado.filter(ev => {
                    if (ESTADO_ANULADO.test(ev.estado || '')) return false;
                    const fin = this.normalizeDate(ev.fecha_fin || ev.fecha_inicio);
                    return fin < hoy;
                });
            } else if (estadoFiltro === 'anulados') {
                resultado = resultado.filter(ev => ESTADO_ANULADO.test(ev.estado || ''));
            }
            // estadoFiltro === 'all': devuelve todo sin filtrar estado

            // Filtros opcionales de hotel y empleado
            if (hotel) resultado = resultado.filter(ev =>
                (ev.hotel_origen || ev.payload?.hotel_id) === hotel
            );
            if (empleado) {
                const normEmp = this.normalizeString(empleado);
                resultado = resultado.filter(ev =>
                    this.normalizeString(ev.empleado_id) === normEmp
                );
            }

            return resultado;
        } catch (err) {
            console.error('DAO Error (fetchBajasPermisos):', err);
            return [];
        }
    },

    // ──────────────────────────────────────────────────────────────────────
    // anularBajaPermiso — NEVER DELETE. Solo UPDATE estado='anulado'.
    // ──────────────────────────────────────────────────────────────────────
    async anularBajaPermiso(id, motivo = '') {
        if (!id) throw new Error('ID requerido para anular baja/permiso');
        // BLOQUEO: si alguien intenta llamar a delete sobre bajas/permisos,
        // esta función es el punto de entrada correcto.
        const client = window.supabase;
        const payload = {
            estado: 'anulado',
            updated_at: new Date().toISOString()
        };
        if (motivo) payload.observaciones = `[ANULADO] ${motivo}`;

        const { error } = await client
            .from('eventos_cuadrante')
            .update(payload)
            .eq('id', id);

        if (error) {
            console.error('DAO Error (anularBajaPermiso):', error);
            throw error;
        }
        if (window.localforage) await window.localforage.clear();
        this.updateUISyncStatus('ok');
    },

    // --- ESCRITURA ---
    async upsertTurno(empleado_id, fecha, turno, tipo, hotel_id, sustituto = null, updatedByOverride = null) {
        const client = window.supabase;
        try {
            if (!empleado_id || !fecha) throw new Error("ID de empleado y Fecha son obligatorios");

            const { data: { session } } = await client.auth.getSession();
            const userEmail = updatedByOverride || session?.user?.email || 'WEB_ADMIN';

            const payload = {
                empleado_id: this.cleanName(empleado_id),
                fecha: this.normalizeDate(fecha),
                turno,
                tipo: tipo || 'NORMAL',
                hotel_id,
                sustituto,
                updated_by: userEmail,
                updated_at: new Date().toISOString()
            };

            const { error } = await client
                .from('turnos')
                .upsert(payload, { onConflict: 'empleado_id,fecha' });

            if (error) throw error;
            this.updateUISyncStatus('ok');
        } catch (err) {
            console.error("DAO Error (upsertTurno):", err);
            this.updateUISyncStatus('error');
            throw err;
        }
    },

    async bulkUpsert(flatData) {
        const client = window.supabase;
        try {
            if (!flatData || !flatData.length) return;

            const { data: { session } } = await client.auth.getSession();
            const userEmail = session?.user?.email || 'EXCEL_IMPORT';

            const processed = flatData.map(row => ({
                ...row,
                empleado_id: this.cleanName(row.empleado_id),
                fecha: this.normalizeDate(row.fecha),
                updated_by: userEmail,
                updated_at: new Date().toISOString()
            }));

            const { error } = await client
                .from('turnos')
                .upsert(processed, { onConflict: 'empleado_id,fecha' });

            if (error) throw error;
            
            // Limpieza proactiva de caché tras carga masiva, si esta vista cargó localforage.
            if (window.localforage) await window.localforage.clear();
            this.updateUISyncStatus('ok');
        } catch (err) {
            console.error("DAO Error (bulkUpsert):", err);
            this.updateUISyncStatus('error');
            throw err;
        }
    },

    async upsertVacacionesPeriodo({ empleado_id, hotel_id, fecha_inicio, fecha_fin, sustituto = null }) {
        const inicio = this.normalizeDate(fecha_inicio);
        const fin = this.normalizeDate(fecha_fin);
        if (!empleado_id || !hotel_id || !inicio || !fin) {
            throw new Error("Empleado, hotel, fecha de inicio y fecha de fin son obligatorios");
        }
        if (fin < inicio) {
            throw new Error("La fecha de fin no puede ser anterior a la fecha de inicio");
        }

        const rows = [];
        const current = new Date(inicio + 'T12:00:00');
        const limit = new Date(fin + 'T12:00:00');
        while (current <= limit) {
            rows.push({
                empleado_id,
                fecha: current.toISOString().split('T')[0],
                turno: '',
                tipo: 'VAC 🏖️',
                hotel_id,
                sustituto: sustituto || null
            });
            current.setDate(current.getDate() + 1);
        }

        await this.bulkUpsert(rows);
        if (window.localforage) await window.localforage.clear();
        return rows;
    },

    async deleteVacacionesPeriodo({ empleado_id, fecha_inicio, fecha_fin }) {
        const client = window.supabase;
        const inicio = this.normalizeDate(fecha_inicio);
        const fin = this.normalizeDate(fecha_fin);
        if (!empleado_id || !inicio || !fin) {
            throw new Error("Empleado, fecha de inicio y fecha de fin son obligatorios");
        }

        // REGLA DE ORO: No borramos físicamente. Marcamos como tipo NORMAL para "anular" la ausencia
        // manteniendo el registro de que el empleado estaba previsto ese día.
        const { error } = await client
            .from('turnos')
            .update({ 
                tipo: 'NORMAL', 
                sustituto: null, 
                updated_by: 'ANULACION_HISTORICA',
                updated_at: new Date().toISOString() 
            })
            .eq('empleado_id', empleado_id)
            .ilike('tipo', 'VAC%')
            .gte('fecha', inicio)
            .lte('fecha', fin);

        if (error) {
            this.updateUISyncStatus('error');
            throw error;
        }
        if (window.localforage) await window.localforage.clear();
        this.updateUISyncStatus('ok');
    },

    async migrateBatch(flatData) {
        return this.bulkUpsert(flatData);
    },

    async deleteTurno(empleado_id, fecha) {
        const client = window.supabase;
        try {
            // REGLA DE ORO: En lugar de borrar, lo dejamos como un hueco normal o anulado
            const { error } = await client
                .from('turnos')
                .update({ 
                    tipo: 'ANULADO', 
                    updated_by: 'BORRADO_LOGICO', 
                    updated_at: new Date().toISOString() 
                })
                .eq('empleado_id', empleado_id)
                .eq('fecha', this.normalizeDate(fecha));
            if (error) throw error;
        } catch (err) {
            console.error("DAO Error (deleteTurno):", err);
            throw err;
        }
    },

    async clearAll() {
        const client = window.supabase;
        try {
            const { error } = await client
                .from('turnos')
                .delete()
                .neq('empleado_id', 'SYSTEM_RESERVED_KEY'); 
            if (error) throw error;
            if (window.localforage) await window.localforage.clear();
        } catch (err) {
            console.error("DAO Error (clearAll):", err);
            throw err;
        }
    },

    async getHotels() {
        const client = window.supabase;
        try {
            // Unificamos hoteles de la base de datos + lista base fija para evitar que desaparezcan
            const baseHotels = ['Cumbria Spa&Hotel', 'Sercotel Guadiana'];
            
            const { data, error } = await client
                .from('turnos')
                .select('hotel_id')
                .not('hotel_id', 'is', null);
            
            if (error) throw error;
            
            const dbHotels = (data || []).map(h => h.hotel_id);
            const unique = Array.from(new Set([...baseHotels, ...dbHotels])).sort();
            return unique;
        } catch (err) {
            console.error("DAO Error (getHotels):", err);
            return ['Cumbria Spa&Hotel', 'Sercotel Guadiana'];
        }
    },

    // --- GESTIÓN DE EMPLEADOS (FICHAS) ---
    async getEmpleados() {
        const client = window.supabase;
        try {
            // Intentar con orden, si falla (400) es que la columna no existe aún
            const { data, error } = await client.from('empleados').select('*').order('orden', { ascending: true });
            
            if (error) {
                if (error.code === 'PGRST100' || error.status === 400 || error.code === '42703') {
                    console.warn("Columna 'orden' no encontrada (42703), usando orden alfabético.");
                    const { data: fallback, error: err2 } = await client.from('empleados').select('*').order('nombre');
                    if (err2) throw err2;
                    return fallback || [];
                }
                throw error;
            }
            return data || [];
        } catch (err) {
            console.error("DAO Error (getEmpleados):", err);
            return [];
        }
    },

    async upsertEmpleado(empData) {
        const client = window.supabase;
        try {
            if (!empData.id) throw new Error("ID de empleado obligatorio");

            const normalizedData = { ...empData };
            if (normalizedData.hotel_id === undefined && normalizedData.hotel !== undefined) {
                normalizedData.hotel_id = normalizedData.hotel;
            }
            if (normalizedData.tipo_personal === undefined && normalizedData.tipo !== undefined) {
                normalizedData.tipo_personal = normalizedData.tipo;
            }
            if (normalizedData.estado_empresa === undefined && normalizedData.estado !== undefined) {
                normalizedData.estado_empresa = normalizedData.estado;
            }
            if (normalizedData.observaciones === undefined && normalizedData.notas !== undefined) {
                normalizedData.observaciones = normalizedData.notas;
            }

            const EMPLEADO_COLUMNS = [
                'id',
                'nombre',
                'hotel_id',
                'puesto',
                'tipo_personal',
                'estado_empresa',
                'activo',
                'fecha_baja',
                'telefono',
                'email',
                'observaciones',
                'orden',
                'id_interno',
                'ajuste_vacaciones_dias',
                'vacaciones_anuales',
                'categoria',
                'contrato',
                'rol',
                'rol_operativo',
                'motivo_baja',
                'hoteles_asignados',
                'antiguedad',
                'vacaciones_regularizadas_pagadas'
            ];

            const payload = {};
            EMPLEADO_COLUMNS.forEach(col => {
                if (normalizedData[col] !== undefined) {
                    payload[col] = normalizedData[col];
                }
            });

            const currentStatus = window.employeeNorm ? window.employeeNorm(payload.estado_empresa || '') : String(payload.estado_empresa || '').toLowerCase();
            const isTerminated = currentStatus.includes('empresa') || currentStatus.includes('definitiva') || currentStatus === 'baja';
            if (!isTerminated && !payload.fecha_baja) {
                payload.fecha_baja = null;
            }

            payload.updated_at = new Date().toISOString();

            if (window.DEBUG_MODE === true) {
                console.log('[UPSERT EMPLEADO PAYLOAD]', payload);
            }

            const retryablePayload = { ...payload };
            for (let attempt = 0; attempt < 6; attempt++) {
                const { error } = await client.from('empleados').upsert(retryablePayload);
                if (!error) return;

                console.error("DAO Error (upsertEmpleado detail):", error);

                const errorStr = String(error?.details || error?.message || error?.hint || '');
                const missingColumn = errorStr.match(/column ["']([^"']+)["']/i)?.[1] || 
                                     errorStr.match(/Could not find column ["']([^"']+)["']/i)?.[1] ||
                                     errorStr.match(/'([^']+)' column/i)?.[1];

                if (
                    missingColumn &&
                    missingColumn !== 'id' &&
                    Object.prototype.hasOwnProperty.call(retryablePayload, missingColumn)
                ) {
                    console.warn(`[upsertEmpleado] Columna no disponible en Supabase, reintentando sin '${missingColumn}'.`);
                    delete retryablePayload[missingColumn];
                    continue;
                }

                if (error.status === 400 || error.code === 'PGRST100' || error.code === '42703') {
                    throw new Error("Error al guardar ficha: Supabase rechaza el payload. Revisa el esquema de 'empleados' o refresca la cache del API.");
                }
                throw error;
            }

            throw new Error("Error al guardar ficha: no fue posible adaptar el payload al esquema de empleados.");
        } catch (err) {
            console.error("DAO Error (upsertEmpleado):", err);
            throw err;
        }
    },

    // --- REALTIME ---
    async initRealtime() {
        if (this._channel) return;
        const client = window.supabase;

        try {
            this._channel = client
                .channel('turnos_global_sync')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'turnos' }, (payload) => {
                    if (window.aplicarCambioLocal) window.aplicarCambioLocal(payload);
                });

            this._channel.subscribe((status) => {
                this.updateUISyncStatus(status === 'SUBSCRIBED' ? 'ok' : 'warn');
            });

            // Watchdog cada 30 segundos
            if (!window._watchdogTimer) {
                window._watchdogTimer = setInterval(async () => {
                    if (window.DEBUG_MODE === true) {
                        console.warn("DAO Watchdog: Re-inicializando canal...");
                    }
                    await client.removeChannel(this._channel);
                    this._channel = null;
                    this.initRealtime();
                }, 30000);
            }
        } catch (err) {
            console.error("DAO Error (Realtime):", err);
            this._channel = null;
        }
    },

    // --- AUDITORÍA Y PUBLICACIONES ---
    async insertLog(logData) {
        const client = window.supabase;
        try {
            const { data: { session } } = await client.auth.getSession();
            
            // Adaptar logData al esquema real de publicaciones_log
            // Columnas reales: resumen (json), cambios_json (json), cambios_totales (int), usuario (text)
            const payload = {
                resumen: logData.resumen_json || logData.resumen || {},
                cambios_json: logData.cambios_json || {},
                cambios_totales: logData.cambios_totales || 0,
                usuario: logData.usuario || session?.user?.email || 'WEB_ADMIN'
            };

            const { data, error } = await client
                .from('publicaciones_log')
                .insert([payload])
                .select()
                .single();
            if (error) throw error;
            return data;
        } catch (err) {
            console.error("[ADMIN ERROR] DAO insertLog", {
                message: err.message,
                code: err.code,
                logData: logData
            });
            return null; // No bloqueamos si falla el log
        }
    },

    async fetchLogs(limit = 20) {
        const client = window.supabase;
        try {
            const { data, error } = await client
                .from('publicaciones_log')
                .select('*')
                .order('fecha', { ascending: false })
                .limit(limit);
            if (error) throw error;
            return data || [];
        } catch (err) {
            console.error("[ADMIN ERROR] DAO fetchLogs", {
                message: err.message,
                stack: err.stack,
                context: 'fetchLogs'
            });
            return [];
        }
    },

    async updateLog(id, updateData) {
        const client = window.supabase;
        try {
            const { error } = await client
                .from('publicaciones_log')
                .update(updateData)
                .eq('id', id);
            if (error) throw error;
        } catch (err) {
            console.error("[ADMIN ERROR] DAO updateLog", {
                message: err.message,
                stack: err.stack,
                id,
                updateData
            });
            throw err;
        }
    },

    async getLog(id) {
        const client = window.supabase;
        try {
            const { data, error } = await client
                .from('publicaciones_log')
                .select('*')
                .eq('id', id)
                .single();
            if (error) throw error;
            return data;
        } catch (err) {
            console.error("DAO Error (getLog):", err);
            throw err;
        }
    },

    // --- ARQUITECTURA DE SNAPSHOTS (PUBLICACIÓN FINAL - v12.0) ---
    
    async publishCuadranteSnapshot(params) {
        const { semanaInicio: rawStart, semanaFin: rawEnd, hotel, snapshot, resumen, usuario } = params;
        const semanaInicio = this.normalizeDate(rawStart);
        const semanaFin = this.normalizeDate(rawEnd);
        const client = window.supabase;
        try {
            // 1. Obtener versión histórica más alta y ID activo actual para rollback
            const [verResult, activeResult] = await Promise.all([
                client.from('publicaciones_cuadrante')
                    .select('version')
                    .eq('semana_inicio', semanaInicio)
                    .eq('hotel', hotel)
                    .order('version', { ascending: false })
                    .limit(1),
                client.from('publicaciones_cuadrante')
                    .select('id')
                    .eq('semana_inicio', semanaInicio)
                    .eq('hotel', hotel)
                    .eq('estado', 'activo')
                    .order('version', { ascending: false })
                    .limit(1)
            ]);
            
            const lastId = (activeResult.data && activeResult.data[0]) ? activeResult.data[0].id : null;
            const nextVersion = (verResult.data && verResult.data[0]) ? verResult.data[0].version + 1 : 1;

            console.log("[DAO_PUBLISH] payload", {
                hotel,
                semana_inicio: semanaInicio,
                semana_fin: semanaFin,
                version: nextVersion,
                rows: snapshot?.rows?.length
            });

            // --- FASE A: INSERT PRINCIPAL (CRÍTICA) ---
            const { data: newSnap, error: snapErr } = await client
                .from('publicaciones_cuadrante')
                .insert([{
                    semana_inicio: semanaInicio,
                    semana_fin: semanaFin,
                    hotel: hotel,
                    snapshot_json: {
                        ...snapshot,
                        metadata: {
                            ...(snapshot.metadata || {}),
                            rollback_target: lastId,
                            published_at: new Date().toISOString()
                        }
                    },
                    resumen: resumen,
                    publicado_por: usuario || 'ADMIN',
                    version: nextVersion,
                    estado: 'activo',
                    fecha_publicacion: new Date().toISOString()
                }])
                .select()
                .single();
            
            if (snapErr) {
                console.error("[DAO_PUBLISH] Critical INSERT failure:", snapErr);
                throw snapErr; // El fallo en el INSERT es crítico
            }

            console.log("[DAO_PUBLISH] Insert success:", newSnap.id);

            // --- FASE B: CLEANUP VÍA RPC SECURITY DEFINER ---
            // La función RPC bypass el RLS del rol anon con SECURITY DEFINER.
            // No se usa PATCH directo que generaba 403.
            let needsManualCleanup = false;
            let warning = null;

            const { data: cleanupRows, error: rpcErr } = await client
                .rpc('cleanup_publicacion_activa', {
                    p_hotel: hotel,
                    p_semana_inicio: semanaInicio
                });

            if (rpcErr) {
                needsManualCleanup = true;
                warning = rpcErr.message || 'RPC cleanup falló. Limpieza manual pendiente.';
                console.warn('[DAO_PUBLISH] Cleanup RPC falló. Limpieza manual pendiente.', rpcErr);

                window.reportOperationalDiagnostic?.({
                    source: 'supabase-dao',
                    severity: 'warning',
                    type: 'SUPABASE_REPLACE_PREVIOUS_RLS',
                    title: 'Snapshots duplicados (RLS)',
                    desc: `Publicación OK, pero ${hotel} (${semanaInicio}) requiere limpieza manual de versiones anteriores.`,
                    section: 'changes',
                    key: `rls-cleanup|${hotel}|${semanaInicio}`
                });
            } else {
                const replaced = (cleanupRows || []).length;
                console.log('[DAO_PUBLISH] Cleanup RPC completado', { hotel, semanaInicio, replaced });
            }

            // 4. Log de auditoría (No bloqueante)
            try {
                await this.insertLog({
                    cambios_totales: resumen?.emps || 0,
                    resumen: {
                        accion: 'publicar_snapshot_cuadrante',
                        semana_inicio: semanaInicio,
                        semana_fin: semanaFin,
                        hotel: hotel,
                        version: nextVersion,
                        rollback_target: lastId,
                        warning: warning
                    },
                    usuario: usuario || 'ADMIN'
                });
            } catch (logErr) {
                console.warn("DAO: Error al registrar log de auditoría:", logErr.message);
            }

            return {
                success: true,
                warning: warning,
                needsManualCleanup: needsManualCleanup,
                publication: newSnap
            };

        } catch (err) {
            console.error("DAO Error (publishCuadranteSnapshot):", err);
            throw err;
        }
    },


    isValidPublicSnapshot(snapshot) {
        if (!snapshot) return false;
        const data = snapshot.snapshot_json || snapshot.data || snapshot;
        const emps = data.empleados || data.rows || [];
        if (!Array.isArray(emps) || emps.length === 0) return false;

        // 1. VALIDACIÓN ESTRUCTURAL (Orden y Metadatos)
        const orders = emps.map(e => Number(e.puestoOrden || e.orden || 9999));
        const all999 = orders.every(o => o === 9999);
        if (all999) return false;

        // Regla relajada: al menos la MAYORÍA (>50%) de las filas base deben tener puestoOrden < 9999.
        // Esto permite snapshots donde algunos empleados tienen orden=999 (sin asignar)
        // pero el resto está bien ordenado.
        const baseRows = emps.filter(e => e.rowType !== 'extra' && e.rowType !== 'refuerzo');
        if (baseRows.length > 0) {
            const validOrderCount = baseRows.filter(e => Number(e.puestoOrden || e.orden || 9999) < 9000).length;
            if (validOrderCount === 0) return false; // todos tienen orden inválido → rechazar
        }

        if (emps.some(e => (e.nombreVisible || e.nombre || "").includes("_DUP"))) return false;

        const hName = (snapshot.hotel || data.hotel || "").toUpperCase();
        if (hName.includes("TEST")) return false;
        // 1b. COHERENCIA DE FECHAS: las claves de dias deben coincidir con semana_inicio
        // Rechaza snapshots publicados con datos de otra semana (bug V141: semana=06-08 pero dias=05-18)
        const semanaRef = snapshot.semana_inicio || data.semana_inicio || null;
        if (semanaRef) {
            const allDiaKeys = new Set();
            emps.forEach(e => Object.keys(e.dias || e.cells || {}).forEach(k => allDiaKeys.add(k)));
            if (allDiaKeys.size > 0) {
                const refDate = new Date(semanaRef + 'T12:00:00');
                const weekKeys = new Set();
                for (let i = 0; i < 7; i++) {
                    const d = new Date(refDate);
                    d.setDate(d.getDate() + i);
                    weekKeys.add(d.toISOString().split('T')[0]);
                }
                const hasOverlap = [...allDiaKeys].some(k => weekKeys.has(k));
                if (!hasOverlap) return false; // datos de semana equivocada -> rechazar
            }
        }


        // 2. VALIDACIÓN SEMÁNTICA (Integridad de Incidencias)
        // Regla: Si una celda tiene un tipo de incidencia, el código no puede estar vacío o ser un guion
        for (const emp of emps) {
            const cells = emp.dias || emp.cells || {};
            let hasAnyIncidenceInRow = false;
            
            for (const fecha in cells) {
                const c = cells[fecha];
                const type = (c.type || "").toUpperCase();
                const code = (c.code || "").toUpperCase().trim();
                
                if (["VAC", "BAJA", "IT", "PERM", "PERMISO", "FORM"].includes(type)) {
                    hasAnyIncidenceInRow = true;
                    // B4 FIX: No aceptamos celdas de incidencia con código vacío o genérico "—"
                    if (!code || code === "—" || code === "" || code === "-") return false;
                    
                    // Consistencia básica
                    if (type === "VAC" && !code.includes("VAC")) return false;
                    if (["BAJA", "IT"].includes(type) && (!code.includes("BAJA") && !code.includes("IT"))) return false;
                }
            }

            // Regla: Una fila base (titular) no puede estar vacía toda la semana.
            // V12.6 FIX: En lugar de rechazar el snapshot ENTERO cuando un empleado base tiene
            // codes vacíos (bug de serialización, ej. Sandra), solo advertimos y continuamos.
            // También leemos label/turno como fallback por si code quedó vacío pero hay datos.
            const isBase = !emp.rowType || (emp.rowType !== 'extra' && emp.rowType !== 'refuerzo');
            if (isBase) {
                const codes = Object.values(cells).map(c =>
                    String(c.code || c.label || c.turno || '').trim()
                );
                const allEmpty = codes.every(code => code === '' || code === '—' || code === '-');
                if (allEmpty) {
                    console.warn('[SNAPSHOT_VALIDATION] Empleado base con todas las celdas vacías (ignorado sin rechazar snapshot):',
                        emp.nombreVisible || emp.nombre || emp.empleado_id || 'Unknown');
                    continue; // No return false — no rechazar todo el snapshot
                }
            }

            // Regla específica para filas informativas de ausencia
            if (emp.rowType === 'ausencia_informativa' && !hasAnyIncidenceInRow) return false;
        }

        return true;
    },

    async loadPublishedSchedule(params, maybeSemanaFin, maybeHotel) {
        const { semanaInicio: rawStart, semanaFin: rawEnd, hotel } = (typeof params === 'object' && params !== null)
            ? params
            : { semanaInicio: params, semanaFin: maybeSemanaFin, hotel: maybeHotel };
        
        const semanaInicio = this.normalizeDate(rawStart);
        const semanaFin = this.normalizeDate(rawEnd);
        const client = window.supabase;
        try {
            // Buscamos todas las versiones activas para poder elegir la mejor válida
            let query = client
                .from('publicaciones_cuadrante')
                .select('*')
                .eq('estado', 'activo');
            
            if (semanaInicio) query = query.gte('semana_fin', semanaInicio);
            if (semanaFin) query = query.lte('semana_inicio', semanaFin);
            if (hotel) query = query.eq('hotel', hotel);

            const { data, error } = await query;
            if (error) throw error;
            if (!data || data.length === 0) {
                return { ok: false, reason: "NO_PUBLICATION", message: "No hay cuadrante publicado para esta semana." };
            }

            // DEDUPLICACIÓN CON FILTRADO DE VALIDEZ
            const deduped = [];
            const seenKeys = new Set();
            
            // Ordenamos: semana (asc), hotel (asc), versión (desc)
            const sortedData = [...data].sort((a, b) => {
                if (a.semana_inicio !== b.semana_inicio) return a.semana_inicio.localeCompare(b.semana_inicio);
                if (a.hotel !== b.hotel) return a.hotel.localeCompare(b.hotel);
                if (b.version !== a.version) return b.version - a.version;
                return new Date(b.created_at || 0) - new Date(a.created_at || 0);
            });

            for (const item of sortedData) {
                // Clave única: hotel + semana_inicio
                const key = `${item.hotel}::${item.semana_inicio}`;
                if (seenKeys.has(key)) continue;

                // Limpiar artefactos _DUP antes de validar (no rechazar snapshots validos por duplicados residuales)
                const cleanItem = { ...item };
                const snapRaw = cleanItem.snapshot_json || {};
                const rawEmps = snapRaw.empleados || snapRaw.rows || [];
                if (rawEmps.some(e => (e.nombreVisible || e.nombre || '').includes('_DUP'))) {
                    const cleanedEmps = rawEmps.filter(e => !String(e.nombreVisible || e.nombre || '').includes('_DUP'));
                    cleanItem.snapshot_json = { ...snapRaw, empleados: cleanedEmps, rows: cleanedEmps };
                }

                if (this.isValidPublicSnapshot(cleanItem)) {
                    // Normalización crítica para compatibilidad con index.html (espera 'empleados')
                    const snapData = cleanItem.snapshot_json || {};
                    const normalizedSnapshot = { ...snapData };
                    if (!normalizedSnapshot.empleados && normalizedSnapshot.rows) {
                        normalizedSnapshot.empleados = normalizedSnapshot.rows;
                    }

                    deduped.push({
                        hotel: item.hotel,
                        semanaInicio: item.semana_inicio,
                        semanaFin: item.semana_fin,
                        version: item.version,
                        data: normalizedSnapshot
                    });
                    seenKeys.add(key);
                } else {
                    console.warn(`[SNAPSHOT] Skipped version ${item.version} for ${item.hotel} (${item.semana_inicio}): invalid structural data (puestoOrden error or corruption).`);
                }
            }

            if (deduped.length === 0) {
                return { ok: false, reason: "NO_VALID_SNAPSHOT", message: "No hay versiones válidas publicadas." };
            }

            return {
                ok: true,
                source: "published_snapshot",
                snapshots: deduped
            };
        } catch (err) {
            console.error("DAO Error (loadPublishedSchedule):", err);
            return { ok: false, reason: "ERROR", message: err.message };
        }
    }
    ,

    async getPublishedCoverage(hotel = 'all') {
        const client = window.supabase;
        try {
            let q = client
                .from('publicaciones_cuadrante')
                .select('hotel, semana_fin, estado, created_at')
                .eq('estado', 'activo');

            if (hotel && hotel !== 'all') q = q.eq('hotel', hotel);

            const { data, error } = await q.order('semana_fin', { ascending: false }).limit(200);
            if (error) throw error;

            const rows = data || [];
            if (rows.length === 0) return { ok: true, lastDate: null, hotel };

            const lastDate = rows
                .map(r => this.normalizeDate(r.semana_fin))
                .filter(Boolean)
                .sort((a, b) => b.localeCompare(a))[0] || null;

            return { ok: true, lastDate, hotel };
        } catch (err) {
            console.error("DAO Error (getPublishedCoverage):", err);
            return { ok: false, lastDate: null, hotel, error: err.message };
        }
    }
};

window.dao = window.TurnosDB;
