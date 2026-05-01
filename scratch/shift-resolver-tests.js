        const resC2 = window.resolveEmployeeDay({ empleadoId: 'macarena', fecha: '2026-04-25', turnoBase: 'M', eventos: [evInter], baseIndex });
        const testC = resC1.turno === 'M' && resC2.turno === 'T' && resC1.intercambio && resC2.intercambio;
        results.push({ name: 'Dani <-> Macarena', ok: testC, got: { resC1, resC2 } });

        results.forEach(r => {
            console.log(`${r.ok ? '✅' : '❌'} ${r.name}`, r.ok ? '' : r.got);
        });
        
        console.groupEnd();
        return results;
    };

    window.ShiftResolver = {
        resolveEmployeeDay: window.resolveEmployeeDay,
        buildIndices: window.buildIndices,
        clearCache: () => _cache.clear(),
        runTests: window.runTurnosRegressionTests
    };

    window.resolverTurnoFinal = window.resolveEmployeeDay; // Alias para compatibilidad inmediata

    console.log("[ShiftResolver] Carga finalizada v5.0.");

    // ── HELPERS DE PRESENTACION: texto limpio e iconos decorativos ──────────────

    /**
     * cleanTurnoLabel(value)
     * Devuelve el texto canonico limpio del turno/incidencia.
     * Elimina emojis, bytes corruptos y normaliza codigos a nombres completos.
     * El valor devuelto es SOLO texto — nunca incluye iconos.
     *
     * @param {string} value - Codigo o nombre crudo (ej. 'M', 'VAC', 'Vacaciones', 'Baja 🤒')
     * @returns {string} Texto limpio ('Manana', 'Vacaciones', 'Baja', etc.)
     */
    window.cleanTurnoLabel = (value) => {
        if (value === null || value === undefined || value === '') return '—';
        // 1. Limpiar bytes corruptos y emojis
        let s = String(value)
            .replace(/[^\x00-\x7F\u00C0-\u024F\u00e0-\u00ff\u00f1\u00d1]/g, '') // latin + spanish chars
            .trim();
        // 2. Normalizar a mayusculas sin acentos para comparar
        const up = s.toUpperCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, '');
        // 3. Mapa de codigos → etiqueta canonica
        const MAP = {
            'M': 'Mañana', 'MANANA': 'Mañana', 'MANANA': 'Mañana',
            'T': 'Tarde',  'TARDE': 'Tarde',
            'N': 'Noche',  'NOCHE': 'Noche',
            'D': 'Descanso', 'DESCANSO': 'Descanso',
            'VAC': 'Vacaciones', 'VACACION': 'Vacaciones', 'VACACIONES': 'Vacaciones',
            'BAJA': 'Baja', 'BAJAMEDICA': 'Baja', 'BM': 'Baja',
            'PERM': 'Permiso', 'PERMISO': 'Permiso', 'PERMISOS': 'Permiso',
            'FORM': 'Formación', 'FORMACION': 'Formación', 'FORMACION': 'Formación',
            '-': '—', '': '—'
        };
        if (MAP[up] !== undefined) return MAP[up];
        // 4. Coincidencia parcial para etiquetas compuestas ('VACACIONES_EXTRA', etc.)
        if (up.startsWith('VAC')) return 'Vacaciones';
        if (up.startsWith('BAJ')) return 'Baja';
        if (up.startsWith('PER')) return 'Permiso';
        if (up.startsWith('FOR')) return 'Formación';
        // 5. Devolver texto limpio si no hay mapeo
        return s || '—';
    };

    /**
     * getTurnoIcon(turno, flags)
     * Devuelve el icono decorativo (emoji) para un turno/incidencia.
     * El icono es solo decoracion visual — nunca se guarda en Supabase ni se usa en logica.
     *
     * @param {string} turno - Tipo de turno o incidencia
     * @param {object} [flags] - { cambio, intercambio }
     * @returns {string} Emoji o '' si no hay icono para ese turno
     */
    window.getTurnoIcon = (turno, flags = {}) => {
        if (!turno) return '';
        const up = String(turno).toUpperCase()
            .replace(/[^\x00-\x7F]/g, '')
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, '');
        if (up.startsWith('VAC'))                return '\uD83C\uDFD6\uFE0F'; // 🏖️
        if (up === 'BAJA' || up.startsWith('BAJ')) return '\uD83E\uDD12';       // 🤒
        if (up.startsWith('PER'))                return '\uD83D\uDDD3\uFE0F'; // 🗓️
        if (up.startsWith('FOR'))                return '\uD83C\uDF93';         // 🎓
        if (up === 'N' || up === 'NOCHE')        return '\uD83C\uDF19';
        // El icono de intercambio SOLO para CT real, no para sustitución por ausencia
        if (flags.intercambio) return '\uD83D\uDD03'; // 🔃
        return '';
    };

    /**
     * window.debugResolveEmpleadoDia({ empleado, hotel, fecha })
     * Función de diagnóstico estructural para validar la resolución de un turno.
     */
    window.debugResolveEmpleadoDia = ({ empleado, hotel, fecha }) => {
        const baseIndex = window._lastBaseIndex;
        const eventos = window._lastEventos || [];
        
        const res = window.resolveEmployeeDay({
            empleadoId: empleado,
            hotel,
            fecha,
            eventos,
            baseIndex
        });

        console.group(`%c[DEBUG RESOLVE] ${empleado} @ ${fecha}`, "color: #8b5cf6; font-weight: bold;");
        console.log("Empleado Visible:", res.empleadoNombre);
        console.log("Empleado Real (ID):", res.empleadoId);
        console.log("Hotel:", hotel);
        console.table((eventos || [])
            .filter(ev => window.eventoAplicaEnFecha(ev, fecha))
            .map(ev => ({
                tipo: window.normalizeTipo(ev.tipo),
                hotelEvento: window.getEventoHotel(ev) || '(sin hotel)',
                titular: ev.empleado_id || ev.titular_id || ev.titular || '',
                sustituto: ev.empleado_destino_id || ev.sustituto_id || ev.sustituto || '',
                matchHotel: window.eventoPerteneceAHotel(ev, hotel),
                matchEmpleado: window.eventoPerteneceAEmpleado(ev, empleado, { hotel })
            })));
        console.log("Posición/Titular Cubierto:", res.sustituyeA || 'Ninguno (Titular)');
        console.log("Evento Ausencia:", res.incidencia || 'No');
        console.log("Evento CT:", res.intercambio ? 'Sí' : 'No');
        console.log("Turno Base Titular:", res.sustituyeA ? window.getTurnoBaseDeEmpleado(res.sustituyeA, fecha, baseIndex) : res.turnoBase);
        console.log("Turno Base Sustituto:", res.turnoBase);
        console.log("Origen Final:", res.origen);
        console.log("Turno Final:", res.turno);
        console.groupEnd();
        
        return res;
    };
    
    // Alias solicitado por el usuario
    window.getTurnoEmoji = window.getTurnoIcon;

    /**
     * renderTurnoContent(turno, flags)
     * Renderiza el contenido de una celda de turno con label e icono separados.
     * El texto es el dato limpio. El emoji es decoracion visual separada.
     */
    window.renderTurnoContent = (turno, flags = {}) => {
        const label = window.cleanTurnoLabel(turno);
        const icons = [];
        const turnoIcon = window.getTurnoIcon(turno, {});
        if (turnoIcon) icons.push(turnoIcon);
        if (flags.intercambio) icons.push('\uD83D\uDD03');
        
        // El label nunca debe contener iconos.
        // Los iconos van en spans separados con aria-hidden.
        let html = `<span class="turno-label">${label}</span>`;
        [...new Set(icons)].forEach(icon => {
            html += ` <span class="turno-icon" aria-hidden="true">${icon}</span>`;
        });
        return html;
    };

})();
