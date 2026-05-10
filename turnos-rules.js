(function () {
    const normalizeText = (value) => String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();

    const isCtType = (type) => String(type || '').toUpperCase().includes('CT');
    const isAbsenceType = (type) => {
        const t = String(type || '').toUpperCase();
        return t.startsWith('VAC') || t.startsWith('BAJA') || t.startsWith('PERM');
    };

    const isEmptyShift = (cell) => {
        if (cell === null || cell === undefined) return true;
        const val = typeof cell === 'object' ? (cell.code || cell.turno || cell.turnoFinal || cell.label || '') : cell;
        const norm = String(val).trim().toUpperCase();
        return !norm || norm === '-' || norm === '—' || norm === 'SIN_TURNO' || norm === 'NO_TURNO';
    };

    const shiftKey = (turno, type = 'NORMAL') => {
        const upperType = String(type || 'NORMAL').toUpperCase();
        const text = normalizeText(turno);

        // REGLA MAESTRA V12.7: Priorización de clasificación
        // 1. Turnos de trabajo (M, T, N): prioridad absoluta para permitir 📌 en sustituciones
        if (text.startsWith('m') || text.includes('manana')) return 'm';
        if (text.startsWith('t') || text.includes('tarde')) return 't';
        if (text.startsWith('n') || text.includes('noche')) return 'n';

        // 2. Ausencias (VAC, BAJA, PERM): prioridad sobre descansos y otros estados
        if (upperType.startsWith('VAC')) return 'v';
        if (upperType.startsWith('BAJA') || upperType.startsWith('IT') || upperType === 'BM') return 'b';
        if (upperType.startsWith('PERM')) return 'p';
        
        // 3. Descanso (D): solo si no hay una ausencia superior
        if (text.startsWith('d') || text.includes('descanso')) return 'd';

        // 4. Otros estados y fallbacks
        if (isCtType(upperType)) return 'ct';
        if (!text) return '';
        if (text.startsWith('v') || text.includes('vac')) return 'v';
        if (text.startsWith('b') || text.includes('baja')) return 'b';
        if (text.startsWith('p') || text.includes('perm')) return 'p';
        return '';
    };

    const definitions = {
        m: {
            label: 'Mañana',
            icon: '\u{2600}\u{FE0F}',
            publicClass: 'v-mañana',
            mobileClass: 'm',
            adminStyle: 'background:#ebfbee; color:#2f9e44; border:1px solid #d3f9d8;'
        },
        t: {
            label: 'Tarde',
            icon: '\u{1F305}',
            publicClass: 'v-tarde',
            mobileClass: 't',
            adminStyle: 'background:#fff9db; color:#f08c00; border:1px solid #ffec99;'
        },
        n: {
            label: 'Noche',
            icon: '\u{1F319}',
            publicClass: 'v-noche',
            mobileClass: 'n',
            adminStyle: 'background:#edf2ff; color:#364fc7; border:1px solid #dbe4ff;'
        },
        d: {
            label: 'Descanso',
            icon: '',
            publicClass: 'v-descanso',
            mobileClass: 'd',
            adminStyle: 'background:#fee2e2; color:#991b1b; border:1px solid #fecaca;'
        },
        v: {
            label: 'Vacaciones',
            icon: '\u{1F3D6}\u{FE0F}',
            publicClass: 'v-vac',
            mobileClass: 'v',
            adminStyle: 'background:#e3f2fd; color:#0277bd; border:1px solid #b3e5fc;'
        },
        b: {
            label: 'Baja 🩺',
            icon: '',
            publicClass: 'v-baja',
            mobileClass: 'b',
            adminStyle: 'background:#f3e8ff; color:#581c87; border:1px solid #d8b4fe;'
        },
        p: {
            label: 'Permiso 🗓️',
            icon: '',
            publicClass: 'v-perm',
            mobileClass: 'p',
            adminStyle: 'background:#f3e8ff; color:#581c87; border:1px solid #d8b4fe;'
        },
        ct: {
            label: 'Cambio',
            icon: '\u{1F504}',
            publicClass: 'v-cambio',
            mobileClass: 'ct',
            adminStyle: 'background:#fff9db; color:#f08c00; border:1px solid #ffec99;'
        },
        empty: {
            label: '',
            icon: '',
            publicClass: 'v-empty',
            mobileClass: 'empty',
            adminStyle: ''
        }
    };

    const describeCell = (cell = {}) => {
        const fs = cell._finalState;
        
        // Determinar clave de definición
        let key = 'empty';
        if (fs) {
            key = shiftKey(fs.turnoFinal, fs.isAbsence ? fs.estadoFinal : 'NORMAL');
        } else {
            key = shiftKey(cell.turno, cell.tipo || 'NORMAL');
        }

        // Regla estricta: si es vacío y no hay ausencia aplicable
        const isVac = isAbsenceType(fs ? fs.estadoFinal : cell.tipo) || (fs && fs.isAbsence) || cell.incidencia;
        if (isEmptyShift(cell) && !isVac) {
            return {
                key: 'empty',
                label: '—',
                icon: '',
                icons: [],
                publicClass: 'v-empty',
                mobileClass: 'empty',
                adminStyle: '',
                title: '',
                isAbsence: false,
                cls: 'empty',
                _finalState: fs
            };
        }

        const def = definitions[key] || definitions.empty;
        
        // Estado base
        let label       = def.label || (fs ? fs.turnoFinal : cell.turno) || '';
        let publicClass = def.publicClass;
        let mobileClass = def.mobileClass;
        let adminStyle  = def.adminStyle;
        let icon        = def.icon;
        let title       = '';

        // Prioridad de Lógica Visual si hay FinalState
        if (fs) {
            // 1. Label: si está trabajando, mostramos el turno. Si es ausencia, el estado.
            if (fs.isAbsence) {
                label = def.label; // "Vacaciones", "Baja", etc.
            } else {
                // Mantenemos el label de la definición (Mañana, Tarde, etc.) si es un turno estándar
                label = def.label || fs.turnoFinal || label;
            }

            const showPin = shouldShowPin(fs);

            if (showPin) {
                icon = '\u{1F4CC}';
            } else if (fs.isModified || fs.icon === '\u{1F504}' || (fs.icons && fs.icons.includes('\u{1F504}'))) {
                icon = '\u{1F504}';
            } else if (fs.icon && fs.icon !== '\u{1F4CC}') {
                icon = fs.icon;
            } else {
                icon = def.icon; // fallback a icono de definición (ej: 🌙 para Noche)
            }

            // 3. Tooltip (Title) enriquecido
            switch (fs.sourceReason) {
                case 'EVENTO_VAC':
                case 'EVENTO_BAJA':
                case 'EVENTO_PERM':
                    title = fs.coveredByEmployeeId ? `Ausente. Cubierto por: ${fs.coveredByEmployeeId}` : `Ausencia: ${fs.estadoFinal}`;
                    break;
                case 'EVENTO_SUSTITUCION':
                    title = `Sustituyendo a: ${fs.coversEmployeeId}`;
                    break;
                case 'EVENTO_INTERCAMBIO':
                    title = `Intercambio de turno con: ${fs.coveredByEmployeeId || fs.coversEmployeeId}`;
                    break;
                case 'EVENTO_CAMBIO_HOTEL':
                    title = `Cambio de hotel (Destino: ${fs.hotelFinal})`;
                    break;
                case 'EVENTO_REFUERZO':
                    title = `Refuerzo: ${fs.turnoFinal}`;
                    break;
                case 'EVENTO_ANULACION':
                    title = `Evento anulado. Se aplica base.`;
                    break;
                case 'OVERRIDE_MANUAL':
                case 'INTERCAMBIO_MANUAL':
                    title = `Cambio manual en cuadrante`;
                    break;
                case 'BASE_PLANNING':
                    title = `Planificación base Excel`;
                    break;
                default:
                    title = fs.sourceReason || '';
            }
        } else {
            // Lógica fallback legacy (sin motor)
            const type = String(cell.tipo || 'NORMAL').toUpperCase();
            const isCt = key === 'ct' || isCtType(type);
            const isAbsence = isAbsenceType(type);
            
            if (isCt) {
                icon = '🔄';
                title = cell.sustituto ? `Cambio con: ${cell.sustituto}` : 'Cambio de turno';
            } else if (isAbsence && cell.sustituto) {
                title = `Sustituido por: ${cell.sustituto}`;
            } else if (cell.coveringFor) {
                title = `Cubriendo a: ${cell.coveringFor}`;
            }
        }

        // Regla Definitiva V12.5.32: Sincronizar icons array con el icon calculado
        let finalIcons = (fs?.icons && fs.icons.includes('\u{1F504}')) ? ['\u{1F504}'] : [];
        if (icon) finalIcons.push(icon);
        finalIcons = [...new Set(finalIcons)];

        return {
            key,
            label,
            icon,
            icons: finalIcons,
            publicClass,
            mobileClass,
        adminStyle,
            title,
            isAbsence: fs ? fs.isAbsence : isAbsenceType(cell.tipo),
            cls: key === 'empty' ? 'normal' : key,
            _finalState: fs 
        };
    };

    const shouldShowPin = (cell) => {
        if (!cell) return false;
        
        // 1. Determinar el tipo de ausencia que se está cubriendo
        const rawAbs = (
            cell.absenceType || cell.tipoAusencia || cell.incidencia || cell.incidenciaCubierta ||
            (cell.origen && cell.origen.startsWith('SUSTITUCION_') ? cell.origen.replace('SUSTITUCION_', '') : null) ||
            cell.sourceType || cell.reason || cell.source || cell.sourceReason || ''
        );
        const upAbs = String(rawAbs).toUpperCase();
        
        // Regla estricta: solo BAJA, PERMISO, IT (evitando falsos positivos con la palabra 'SUSTITUCION')
        const isMedPerm = (
            upAbs === 'BAJA' || upAbs === 'PERMISO' || upAbs === 'IT' || upAbs === 'PERM' ||
            upAbs.endsWith('_BAJA') || upAbs.endsWith('_PERMISO') || upAbs.endsWith('_PERM') || upAbs.endsWith('_IT') ||
            upAbs.includes('EVENTO_BAJA') || upAbs.includes('EVENTO_PERM')
        );

        // Exclusiones explícitas (prioridad absoluta)
        if (upAbs.includes('VAC') || upAbs.includes('FORMACION')) return false;

        // 2. Determinar si el turno es de trabajo (M, T, N)
        const rawShift = cell.code || cell.turno || cell.turnoFinal || cell.label || '';
        const sKey = shiftKey(rawShift, cell.type || cell.estadoFinal || 'NORMAL');
        const isWorkedShift = ['m', 't', 'n'].includes(sKey);

        // 3. Confirmar que es una cobertura
        const isCoverage = !!(
            cell.isCoverageMarker === true || 
            cell.icon === '\u{1F4CC}' || 
            (Array.isArray(cell.icons) && (cell.icons.includes('\u{1F4CC}') || cell.icons.includes('📌'))) ||
            cell.sustituyeA || 
            cell.titular_cubierto || 
            (cell.origen && cell.origen.includes('SUSTITUCION'))
        );

        return isMedPerm && isWorkedShift && isCoverage;
    };

    const getPublicCellDisplay = (cell, options = {}) => {
        const compact = !!options.compact;
        const code = String(cell?.code || '').trim().toUpperCase();
        const type = String(cell?.type || '').trim().toUpperCase();
        const rawLabel = String(cell?.label || '').trim();

        // PRIORIDAD DE VALOR: code > type (si no es normal) > label
        let label = '';
        if (code && code !== '—') {
            label = code;
        } else if (type && type !== 'NORMAL') {
            label = type;
        } else {
            label = rawLabel || '—';
        }

        // Normalización a nombres completos para visualización (si no es compacto)
        if (!compact && label !== '—') {
            // Usa el clasificador canónico para evitar variantes de formato
            // como "MAÑANA", "Manana", etc.
            const normKey = shiftKey(label, type || 'NORMAL');
            if (definitions[normKey]?.label) {
                label = definitions[normKey].label;
            } else {
                const fullMap = {
                    'M': 'Mañana', 'MANANA': 'Mañana', 'MAÑANA': 'Mañana',
                    'T': 'Tarde', 'TARDE': 'Tarde',
                    'N': 'Noche', 'NOCHE': 'Noche',
                    'D': 'Descanso', 'DESCANSO': 'Descanso',
                    'VAC': 'Vacaciones', 'VACACIONES': 'Vacaciones',
                    'BAJA': 'Baja', 'IT': 'Baja', 'BM': 'Baja',
                    'PERM': 'Permiso', 'PERMISO': 'Permiso',
                    'FORM': 'Formación', 'FORMACION': 'Formación'
                };
                const up = label.toUpperCase();
                if (fullMap[up]) label = fullMap[up];
            }
        }

        const icons = new Set();
        const explicitIcons = Array.isArray(cell?.icons) ? cell.icons : [];
        explicitIcons.forEach(i => {
            if (['🌙','🏖️','🗓️','🤒','🎓','🔄','📌'].includes(i)) icons.add(i);
        });

        // Iconos por regla estructural (Snapshot V12)
        const isNoche = /noche/i.test(label) || code === 'N' || type === 'NOCHE';
        const isVac   = /vacaciones/i.test(label) || code === 'VAC' || type === 'VAC';
        const isBaja  = /baja|it|bm/i.test(label) || code === 'BAJA' || type === 'BAJA' || type === 'IT';
        const isPerm  = /permiso/i.test(label) || code === 'PERM' || type === 'PERM' || type === 'PERMISO';
        const isForm  = /formaci/i.test(label) || code === 'FORM' || type === 'FORM' || type === 'FORMACION';
        const isChanged = !!cell?.changed || !!cell?.intercambio || (cell?.origen && (cell.origen.includes('CAMBIO') || cell.origen.includes('INTERCAMBIO')));

        if (isNoche) icons.add('\u{1F319}');
        if (isVac)   icons.add('\u{1F3D6}\u{FE0F}');
        // Baja y Permiso ya llevan el emoji en el label (Baja 🩺, Permiso 🗓️), no añadir más aquí
        if (isForm)  icons.add('\u{1F313}');
        if (isChanged && !isVac && !isBaja && !isPerm && !isForm) icons.add('\u{1F504}');
        
        // REGLA MAESTRA 📌: Solo si shouldShowPin es true
        if (shouldShowPin(cell)) {
            icons.add('\u{1F4CC}');
        } else {
            // Saneamiento de seguridad: si se coló un 📌 por error, lo quitamos
            icons.delete('\u{1F4CC}');
            icons.delete('📌');
        }

        // Compactación para móvil
        if (compact) {
            const compactMap = {
                'Mañana': 'M', 'Tarde': 'T', 'Noche': 'N', 'Descanso': 'D',
                'Vacaciones': 'VAC', 'Baja': 'BAJA', 'Permiso': 'PERM', 'Formación': 'FORM'
            };
            label = compactMap[label] || label;
        }

        return {
            label,
            icons: Array.from(icons),
            text: label === '—' ? '—' : `${label}${icons.size ? ' ' + Array.from(icons).join(' ') : ''}`
        };
    };

    const groupConsecutiveEvents = (events) => {
        if (!events || events.length === 0) return [];
        
        // Tipos que queremos agrupar
        const groupableTypes = ['VAC', 'BAJA', 'PERMISO', 'PERM'];
        
        // Separar los que agrupamos de los que no
        const toGroup = events.filter(e => groupableTypes.some(t => String(e.tipo || '').toUpperCase().startsWith(t)));
        const others = events.filter(e => !groupableTypes.some(t => String(e.tipo || '').toUpperCase().startsWith(t)));
        
        // Agrupar por empleado para procesar por separado
        const byEmp = {};
        toGroup.forEach(e => {
            const rawId = e.empleado_id || e.empleado_uuid || 'unknown';
            const key = window.normalizeId ? window.normalizeId(rawId) : rawId.toLowerCase().trim();
            if (!byEmp[key]) byEmp[key] = [];
            byEmp[key].push(e);
        });
        
        const finalGroups = [];
        
        Object.values(byEmp).forEach(empEvents => {
            // Ordenar por fecha de inicio
            empEvents.sort((a, b) => a.fecha_inicio.localeCompare(b.fecha_inicio));
            
            let currentGroup = null;
            
            empEvents.forEach(e => {
                if (!currentGroup) {
                    currentGroup = { 
                        ...e, 
                        fecha_fin: e.fecha_fin || e.fecha_inicio, 
                        ids: [e.id],
                        isGroup: false 
                    };
                } else {
                    const lastEnd = new Date((currentGroup.fecha_fin || currentGroup.fecha_inicio) + 'T12:00:00');
                    const nextStart = new Date(e.fecha_inicio + 'T12:00:00');
                    const diffDays = Math.round((nextStart - lastEnd) / (1000 * 60 * 60 * 24));
                    
                    // Criterios de agrupación: consecutivo, mismo tipo, mismo hotel, mismo sustituto, mismo estado
                    const sameType = (currentGroup.tipo || '').split(' ')[0] === (e.tipo || '').split(' ')[0];
                    const sameHotel = currentGroup.hotel_origen === e.hotel_origen;
                    const sameSust = (currentGroup.empleado_destino_id || currentGroup.sustituto_id) === (e.empleado_destino_id || e.sustituto_id);
                    const sameState = (currentGroup.estado || 'activo') === (e.estado || 'activo');
                    
                    if (diffDays === 1 && sameType && sameHotel && sameSust && sameState) {
                        currentGroup.fecha_fin = e.fecha_fin || e.fecha_inicio;
                        currentGroup.ids.push(e.id);
                        currentGroup.isGroup = true;
                    } else {
                        finalGroups.push(currentGroup);
                        currentGroup = { 
                            ...e, 
                            fecha_fin: e.fecha_fin || e.fecha_inicio, 
                            ids: [e.id],
                            isGroup: false 
                        };
                    }
                }
            });
            if (currentGroup) finalGroups.push(currentGroup);
        });
        
        return [...finalGroups, ...others];
    };

    const sortEmployees = (employees) => {
        const withIndex = employees.map((e, idx) => ({ ...e, _originalIndex: e._originalIndex !== undefined ? e._originalIndex : idx }));
        return withIndex.sort((a, b) => {
            const isAbsA = a.rowType === 'ausencia_informativa' || a.isAbsence;
            const isAbsB = b.rowType === 'ausencia_informativa' || b.isAbsence;
            if (isAbsA !== isAbsB) return isAbsA ? 1 : -1;

            const orderA = a.orden !== undefined && a.orden !== null ? Number(a.orden) : (a.puestoOrden !== undefined && a.puestoOrden !== null ? Number(a.puestoOrden) : 9999);
            const orderB = b.orden !== undefined && b.orden !== null ? Number(b.orden) : (b.puestoOrden !== undefined && b.puestoOrden !== null ? Number(b.puestoOrden) : 9999);

            if (orderA !== orderB) return orderA - orderB;

            // Tiebreaker 1: fijo > ocasional/apoyo (structural employees first)
            const tipoRank = (e) => {
                const t = String(e.tipoPersonal || e.tipo_personal || e.tipo || 'fijo').toLowerCase();
                if (t === 'fijo') return 0;
                if (t === 'apoyo') return 1;
                return 2; // ocasional, placeholder, etc.
            };
            const rankDiff = tipoRank(a) - tipoRank(b);
            if (rankDiff !== 0) return rankDiff;

            // Tiebreaker 2: stable _originalIndex
            return a._originalIndex - b._originalIndex;
        });
    };

    const normalizeHotelName = (name) => {
        const raw = String(name || '').trim().toLowerCase();
        if (raw === 'cumbria' || raw === 'cumbria spahotel' || raw === 'cumbria spa&hotel') return 'Cumbria Spa&Hotel';
        if (raw === 'guadiana' || raw === 'sercotel' || raw === 'sercotel guadiana') return 'Sercotel Guadiana';
        return name; // fallback
    };

    const getCanonicalHotels = () => {
        return [
            { value: "ALL", label: "Todos los hoteles" },
            { value: "Cumbria Spa&Hotel", label: "Cumbria Spa&Hotel" },
            { value: "Sercotel Guadiana", label: "Sercotel Guadiana" }
        ];
    };

    const buildHotelOptions = (rawHotels) => {
        const canonicals = new Set();
        (rawHotels || []).forEach(h => {
            const norm = normalizeHotelName(h);
            if (norm === 'Cumbria Spa&Hotel' || norm === 'Sercotel Guadiana') {
                canonicals.add(norm);
            }
        });
        
        const options = [{ value: "ALL", label: "Todos los hoteles" }];
        if (canonicals.has('Cumbria Spa&Hotel')) options.push({ value: "Cumbria Spa&Hotel", label: "Cumbria Spa&Hotel" });
        if (canonicals.has('Sercotel Guadiana')) options.push({ value: "Sercotel Guadiana", label: "Sercotel Guadiana" });
        
        return options;
    };

    window.TurnosRules = {
        normalizeText,
        shiftKey,
        isCtType,
        isAbsenceType,
        isEmptyShift,
        describeCell,
        shouldShowPin,
        sortEmployees,
        normalizeHotelName,
        getCanonicalHotels,
        buildHotelOptions,
        getPublicCellDisplay,
        groupConsecutiveEvents,
        definitions
    };
    window.groupConsecutiveEvents = groupConsecutiveEvents; // Alias para compatibilidad modular
})();

