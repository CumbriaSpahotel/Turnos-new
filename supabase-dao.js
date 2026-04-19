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

    // --- UTILIDADES ---
    normalizeDate(d) {
        if (!d) return null;
        if (d instanceof Date) return d.toISOString().split('T')[0];
        if (typeof d === 'string' && d.includes('T')) return d.split('T')[0];
        return d; // Asumiendo ya YYYY-MM-DD o formato compatible
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
        const dot = document.getElementById('syncDot');
        const text = document.getElementById('syncText');
        if (!dot || !text) return;
        const colors = { ok: '#10e898', error: '#ff5f57', warn: '#ffb23f' };
        dot.style.background = colors[state] || colors.warn;
        text.textContent = state === 'ok' ? 'Sincronizado' : (state === 'error' ? 'Error Nube' : 'Conectando...');
        window.realtimeActivo = (state === 'ok');
    },

    // --- LECTURA ---
    async fetchRango(inicio, fin) {
        const client = window.supabase;
        const i = this.normalizeDate(inicio);
        const f = this.normalizeDate(fin);
        const cacheKey = `turnos_${i}_${f}`;

        try {
            const now = Date.now();
            const cache = await localforage.getItem(cacheKey);

            // TEMP DEBUG (OBLIGATORIO V8.2)
            if (false && cache && (now - cache.timestamp < this._syncTTL)) {
                console.log("DAO: Cache Hit", cacheKey);
                this.initRealtime();
                return cache.raw;
            }

            const { data, error } = await client
                .from('turnos')
                .select('*')
                .gte('fecha', i)
                .lte('fecha', f);
            
            if (error) throw error;

            await localforage.setItem(cacheKey, { timestamp: now, raw: data });
            this.updateUISyncStatus('ok');
            this.initRealtime();
            return data || [];

        } catch (err) {
            console.error("DAO Error (fetchRango):", err);
            this.updateUISyncStatus('error');
            const fallback = await localforage.getItem(cacheKey);
            return fallback ? fallback.raw : [];
        }
    },

    async fetchTipo(tipo, inicio = null, fin = null) {
        const client = window.supabase;
        try {
            // Usamos ilike para que 'VAC' encuentre 'VAC 🏖️' etc.
            let q = client.from('turnos').select('*').ilike('tipo', `${tipo}%`);
            if (inicio) q = q.gte('fecha', this.normalizeDate(inicio));
            if (fin) q = q.lte('fecha', this.normalizeDate(fin));
            
            const { data, error } = await q.order('fecha', { ascending: false });
            if (error) throw error;
            return data || [];
        } catch (err) {
            console.error("DAO Error (fetchTipo):", err);
            return [];
        }
    },

    // --- ESCRITURA ---
    async upsertTurno(empleado_id, fecha, turno, tipo, hotel_id, sustituto = null) {
        const client = window.supabase;
        try {
            if (!empleado_id || !fecha) throw new Error("ID de empleado y Fecha son obligatorios");

            const { data: { session } } = await client.auth.getSession();
            const userEmail = session?.user?.email || 'WEB_ADMIN';

            const payload = {
                empleado_id,
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
                fecha: this.normalizeDate(row.fecha),
                updated_by: userEmail,
                updated_at: new Date().toISOString()
            }));

            const { error } = await client
                .from('turnos')
                .upsert(processed, { onConflict: 'empleado_id,fecha' });

            if (error) throw error;
            
            // Limpieza proactiva de caché tras carga masiva
            await localforage.clear();
            this.updateUISyncStatus('ok');
        } catch (err) {
            console.error("DAO Error (bulkUpsert):", err);
            this.updateUISyncStatus('error');
            throw err;
        }
    },

    async migrateBatch(flatData) {
        return this.bulkUpsert(flatData);
    },

    async deleteTurno(empleado_id, fecha) {
        const client = window.supabase;
        try {
            const { error } = await client
                .from('turnos')
                .delete()
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
            await localforage.clear();
        } catch (err) {
            console.error("DAO Error (clearAll):", err);
            throw err;
        }
    },

    async getHotels() {
        const client = window.supabase;
        try {
            const { data, error } = await client
                .from('turnos')
                .select('hotel_id')
                .not('hotel_id', 'is', null);
            
            if (error) throw error;
            if (!data || data.length === 0) return ['Cumbria Spa&Hotel', 'Sercotel Guadiana'];
            const unique = Array.from(new Set(data.map(h => h.hotel_id))).sort();
            return unique.length > 0 ? unique : ['Cumbria Spa&Hotel', 'Sercotel Guadiana'];
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
            
            // Intentar guardado completo
            const { error } = await client.from('empleados').upsert({
                ...empData,
                updated_at: new Date().toISOString()
            });

            if (error) {
                // Si el error es por columna inexistente (400), intentamos guardado básico
                if (error.status === 400 || error.code === 'PGRST100') {
                    console.warn("Schema mismatch detectado en upsertEmpleado. Reintentando guardado básico...");
                    const safeData = {
                        id: empData.id,
                        nombre: empData.nombre,
                        hotel_id: empData.hotel_id,
                        updated_at: new Date().toISOString()
                    };
                    const { error: err2 } = await client.from('empleados').upsert(safeData);
                    if (err2) throw err2;
                } else {
                    throw error;
                }
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
                    if (!window.realtimeActivo && this._channel) {
                        console.warn("DAO Watchdog: Re-inicializando canal...");
                        await client.removeChannel(this._channel);
                        this._channel = null;
                        this.initRealtime();
                    }
                }, 30000);
            }
        } catch (err) {
            console.error("DAO Error (Realtime):", err);
            this._channel = null;
        }
    }
};
