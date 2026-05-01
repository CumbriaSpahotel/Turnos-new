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

    const shiftKey = (turno, type = 'NORMAL') => {
        const upperType = String(type || 'NORMAL').toUpperCase();
        const text = normalizeText(turno);

        // Si hay un turno estándar (M, T, N, D), priorizamos su definición visual
        if (text.startsWith('m') || text.includes('manana')) return 'm';
        if (text.startsWith('t') || text.includes('tarde')) return 't';
        if (text.startsWith('n') || text.includes('noche')) return 'n';
        if (text.startsWith('d') || text.includes('descanso')) return 'd';

        // Si no es un turno estándar pero es de tipo Cambio, devolvemos 'ct'
        if (isCtType(upperType)) return 'ct';
        if (upperType.startsWith('VAC')) return 'v';
        if (upperType.startsWith('BAJA')) return 'b';
        if (upperType.startsWith('PERM')) return 'p';

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
            adminStyle: 'background:#fff5f5; color:#fa5252; border:1px solid #ffc9c9;'
        },
        v: {
            label: 'Vacaciones',
            icon: '\u{1F3D6}\u{FE0F}',
            publicClass: 'v-vac',
            mobileClass: 'v',
            adminStyle: 'background:#e3f2fd; color:#0277bd; border:1px solid #b3e5fc;'
        },
        b: {
            label: 'Baja',
            icon: '\u{1F3E5}',
            publicClass: 'v-baja',
            mobileClass: 'b',
            adminStyle: 'background:#fff5f5; color:#c92a2a; border:1px dashed #ffa8a8;'
        },
        p: {
            label: 'Permiso',
            icon: '\u{1F4CB}',
            publicClass: 'v-perm',
            mobileClass: 'p',
            adminStyle: 'background:#f3f0ff; color:#7048e8; border:1px solid #d0bfff;'
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

            // 2. Icono: Prioridad absoluta al marcador de cobertura 📌, luego cambios 🔄
            if (fs.icon === '\u{1F4CC}' || (fs.icons && fs.icons.includes('\u{1F4CC}')) || fs.isCoverageMarker) {
                icon = '\u{1F4CC}';
            } else if (fs.isModified) {
                icon = '\u{1F504}';
            } else if (fs.icon) {
                icon = fs.icon;
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

        return {
            key,
            label,
            icon,
            icons: (fs?.icons && fs.icons.includes('📌')) ? fs.icons : [icon].filter(Boolean),
            publicClass,
            mobileClass,
            adminStyle,
            title,
            isAbsence: fs ? fs.isAbsence : isAbsenceType(cell.tipo),
            cls: key === 'empty' ? 'normal' : key,
            _finalState: fs 
        };
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
            const fullMap = {
                'M': 'Mañana', 'MANANA': 'Mañana',
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
        if (isBaja)  icons.add('\u{1F3E5}');
        if (isPerm)  icons.add('\u{1F4CB}');
        if (isForm)  icons.add('\u{1F313}');
        if (isChanged && !isVac && !isBaja && !isPerm && !isForm) icons.add('\u{1F504}');
        if (cell?.isCoverageMarker || cell?.icon === '\u{1F4CC}') {
            icons.delete('\u{1F504}'); 
            icons.add('\u{1F4CC}');
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

    window.TurnosRules = {
        normalizeText,
        shiftKey,
        isCtType,
        isAbsenceType,
        describeCell,
        getPublicCellDisplay,
        definitions
    };
})();
