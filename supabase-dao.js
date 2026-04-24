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
        if (typeof d === 'string' && d.includes('T')) return d.split('T')[0];
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
    async fetchRango(inicio, fin) {
        const client = window.supabase;
        const i = this.normalizeDate(inicio);
        const f = this.normalizeDate(fin);
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

            const data = await this.fetchAll(() => client
                .from('turnos')
                .select('*')
                .gte('fecha', i)
                .lte('fecha', f)
                .order('fecha', { ascending: true })
                .order('empleado_id', { ascending: true }));

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

    async fetchEventos(inicio = null, fin = null) {
        const client = window.supabase;
        const i = this.normalizeDate(inicio);
        const f = this.normalizeDate(fin);

        try {
            const data = await this.fetchAll(() => {
                let q = client
                    .from('eventos_cuadrante')
                    .select('*')
                    .neq('estado', 'anulado');

                if (i && f) {
                    q = q.lte('fecha_inicio', f).or(`fecha_fin.is.null,fecha_fin.gte.${i}`);
                } else if (i) {
                    q = q.or(`fecha_fin.is.null,fecha_fin.gte.${i}`);
                } else if (f) {
                    q = q.lte('fecha_inicio', f);
                }

                return q.order('fecha_inicio', { ascending: true });
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
            if (window.localforage) await window.localforage.clear();
            this.updateUISyncStatus('ok');
            return data;
        } catch (err) {
            console.error("[ADMIN ERROR] DAO upsertEvento", {
                message: err.message,
                stack: err.stack,
                evento: evento
            });
            this.updateUISyncStatus('error');
            throw err;
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
            // Si pasamos a rechazada desde aprobada, intentamos anular eventos vinculados
            if (estado === 'rechazada' || estado === 'pendiente') {
                await this.anularEventosPeticion(id);
            }

            const { error } = await client
                .from('peticiones_cambio')
                .update({ estado, updated_at: new Date().toISOString() })
                .eq('id', id);
            if (error) throw error;
            this.updateUISyncStatus('ok');
        } catch (err) {
            console.error("DAO Error (actualizarEstadoPeticion):", err);
            this.updateUISyncStatus('error');
            throw err;
        }
    },

    async anularEventosPeticion(peticionId) {
        const client = window.supabase;
        try {
            // Buscar eventos en eventos_cuadrante que tengan este peticion_id en su payload
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

    async procesarAprobacionPeticion(peticion) {
        try {
            // Asegurar que no hay eventos antiguos activos de esta petición
            await this.anularEventosPeticion(peticion.id);

            const fechas = Array.isArray(peticion.fechas) ? peticion.fechas : [];
            for (const f of fechas) {
                await this.upsertEvento({
                    tipo: peticion.companero ? 'INTERCAMBIO_TURNO' : 'CAMBIO_TURNO',
                    empleado_id: peticion.solicitante,
                    empleado_destino_id: peticion.companero || null,
                    fecha_inicio: f.fecha,
                    fecha_fin: f.fecha,
                    turno_nuevo: f.destino,
                    observaciones: `Aprobado desde Solicitudes: ${peticion.observaciones || ''}`,
                    payload: { peticion_id: peticion.id, original_data: f }
                });
            }
            await this.actualizarEstadoPeticion(peticion.id, 'aprobada');
        } catch (err) {
            console.error("DAO Error (procesarAprobacionPeticion):", err);
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

    async anularEvento(id) {
        const client = window.supabase;
        try {
            const { error } = await client
                .from('eventos_cuadrante')
                .update({ estado: 'anulado', updated_at: new Date().toISOString() })
                .eq('id', id);
            if (error) throw error;
            if (window.localforage) await window.localforage.clear();
            this.updateUISyncStatus('ok');
        } catch (err) {
            console.error("DAO Error (anularEvento):", err);
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



    async fetchVacaciones(inicio = null, fin = null) {
        // La tabla legacy `vacaciones` no existe en todos los despliegues.
        // La fuente activa son los turnos/eventos calculados con tipo VAC.
        return this.fetchTipo('VAC', inicio, fin);
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
            
            // Whitelist de columnas seguras (estandarizadas para FASE DE ESTABILIZACIÓN)
            const EMPLEADO_COLUMNS = [
                'id',
                'nombre',
                'hotel_id',
                'puesto',
                'tipo',
                'estado',
                'activo',
                'fecha_baja',
                'telefono',
                'email',
                'notas',
                'orden'
            ];

            const payload = {};
            EMPLEADO_COLUMNS.forEach(col => {
                if (empData[col] !== undefined) {
                    payload[col] = empData[col];
                }
            });

            // Si el estado no es Baja, nos aseguramos de que fecha_baja sea null
            if (payload.estado !== 'Baja') {
                payload.fecha_baja = null;
            }

            payload.updated_at = new Date().toISOString();

            if (window.DEBUG_MODE === true) {
                console.log('[UPSERT EMPLEADO PAYLOAD]', payload);
            }

            const { error } = await client.from('empleados').upsert(payload);

            if (error) {
                console.error("DAO Error (upsertEmpleado detail):", error);
                // Si el error es 400 o similar, es probable que falten columnas
                if (error.status === 400 || error.code === 'PGRST100' || error.code === '42703') {
                    throw new Error(`Error al guardar ficha: Supabase rechaza el payload. Es probable que falten columnas nuevas (ej. puesto, tipo, notas) o el esquema no se haya refrescado.`);
                }
                throw error;
            }
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
            const { data, error } = await client
                .from('publicaciones_log')
                .insert([{
                    ...logData,
                    usuario: logData.usuario || session?.user?.email || 'WEB_ADMIN'
                }])
                .select()
                .single();
            if (error) throw error;
            return data;
        } catch (err) {
            console.error("[ADMIN ERROR] DAO insertLog", {
                message: err.message,
                stack: err.stack,
                logData: logData
            });
            throw err;
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
    }
};

window.dao = window.TurnosDB;
