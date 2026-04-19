window.TurnosDB = {
    _currentSub: null,

    updateUISyncStatus(state) {
        const dot = document.getElementById('syncDot');
        const text = document.getElementById('syncText');
        if (!dot || !text) return;

        if (state === 'ok') {
            dot.style.background = '#10e898'; // Success green
            text.textContent = 'Sincronizado (Nube)';
            text.style.color = 'var(--text-muted)';
        } else if (state === 'error') {
            dot.style.background = '#ff5f57'; // Danger red
            text.textContent = 'Error de conexión';
        } else {
            dot.style.background = '#ffb23f'; // Warning yellow
            text.textContent = 'Conectando...';
        }
    },

    // 1. Obtener de caché local primero, luego de la red con Invalidación Mínima de 5 minutos
    async fetchRango(inicio, fin) {
        const cacheKey = "turnos_$inicio_$fin";
        const metaKey = "meta_$cacheKey";
        
        let cache = await localforage.getItem(cacheKey);
        let meta = await localforage.getItem(metaKey);
        
        const CACHE_MINUTES = 5;
        const now = new Date().getTime();
        const needsRefetch = !meta || !meta.last_sync || (now - meta.last_sync > CACHE_MINUTES * 60 * 1000);

        // Fetch en background para sincronizar si expiró o no existe
        if (needsRefetch || !cache) {
            try {
                const { data, error } = await supabase
                    .from('turnos')
                    .select('*')
                    .gte('fecha', inicio)
                    .lte('fecha', fin);
                
                if (error) throw error;
                
                this.updateUISyncStatus('ok');
                
                // Actualizar caché e invalidación
                await localforage.setItem(cacheKey, data);
                await localforage.setItem(metaKey, { last_sync: now });
                
                // Subscribirse usando el filtro de rango exacto
                this.initRealtime(inicio, fin);
                
                return data || [];
            } catch(e) {
                console.error('Error fetching Supabase', e);
                this.updateUISyncStatus('error');
                return cache || [];
            }
        } else {
             // Aún inicializamos realtime si servimos de cache
             this.initRealtime(inicio, fin);
        }
        return cache || [];
    },

    // 2. Operaciones Transaccionales
    async upsertTurno(empleado_id, fecha, turno, tipo, hotel_id) {
        const { data: { session } } = await supabase.auth.getSession();
        const userEmail = session?.user?.email || 'ANONYMOUS';

        const payload = { 
            empleado_id, 
            fecha, 
            turno, 
            tipo, 
            hotel_id, 
            updated_by: userEmail 
        };

        const { error } = await supabase
            .from('turnos')
            .upsert(payload, { onConflict: 'empleado_id, fecha' });
            
        if (error) throw error;
    },

    async deleteTurno(empleado_id, fecha) {
        const { error } = await supabase
            .from('turnos')
            .delete()
            .eq('empleado_id', empleado_id)
            .eq('fecha', fecha);
            
        if (error) throw error;
    },

    // 4. Migración por Lote (Batch)
    async migrateBatch(dataArray) {
        const { data: { session } } = await supabase.auth.getSession();
        const userEmail = session?.user?.email || 'MIGRATION_TOOL';

        const enriched = dataArray.map(row => ({ ...row, updated_by: userEmail }));

        const { data, error } = await supabase
            .from('turnos')
            .upsert(enriched, { onConflict: 'empleado_id, fecha' });
            
        if (error) throw error;
        return data;
    },

    async getHotels() {
        if (!window.supabase) return ['Cumbria Spa&Hotel', 'Sercotel Guadiana'];
        const { data, error } = await window.supabase
            .from('turnos')
            .select('hotel_id');
        
        if (error || !data) return ['Cumbria Spa&Hotel', 'Sercotel Guadiana'];
        return Array.from(new Set(data.map(h => h.hotel_id))).filter(h => !!h).sort();
    },

    // 5. Suscripción Tiempo Real Limitado y Control Concurrencia
    initRealtime(inicio, fin) {
        if (this._currentSub) {
            supabase.removeChannel(this._currentSub);
        }

        this._currentSub = supabase
            .channel('turnos') // Canal simplificado solicitado
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'turnos',
                filter: `fecha=gte.${inicio}&fecha=lte.${fin}`
            }, (payload) => {
                if (window.aplicarCambioLocal) {
                    window.aplicarCambioLocal(payload);
                }
            })
            .subscribe();
    },

    async fetchTipo(tipo, inicio, fin) {
        let q = this.client.from('turnos').select('*').eq('tipo', tipo);
        if (inicio) q = q.gte('fecha', inicio);
        if (fin) q = q.lte('fecha', fin);
        
        const { data, error } = await q.order('fecha', { ascending: false });
        if (error) throw error;
        return data;
    },

    async bulkUpsert(flatData) {
        // Supabase maneja bien lotes de hasta ~1000-2000.
        // Si es más grande, podríamos fragmentarlo, pero para cuadrantes normales esto basta.
        const { error } = await this.client
            .from('turnos')
            .upsert(flatData, { onConflict: 'empleado_id,fecha' });
        if (error) throw error;
    },

    async clearAll() {
        const { error } = await this.client
            .from('turnos')
            .delete()
            .neq('empleado_id', 'FORCE_DELETE_ALL'); // Truco para borrar todo sin filtro restrictivo
        if (error) throw error;
    }
};
