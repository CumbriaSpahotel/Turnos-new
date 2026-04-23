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
        if (isCtType(upperType)) return 'ct';
        if (upperType.startsWith('VAC')) return 'v';
        if (upperType.startsWith('BAJA')) return 'b';
        if (upperType.startsWith('PERM')) return 'p';

        const text = normalizeText(turno);
        if (!text) return '';
        if (text.startsWith('m') || text.includes('manana')) return 'm';
        if (text.startsWith('t') || text.includes('tarde')) return 't';
        if (text.startsWith('n') || text.includes('noche')) return 'n';
        if (text.startsWith('d') || text.includes('descanso')) return 'd';
        if (text.startsWith('v') || text.includes('vac')) return 'v';
        if (text.startsWith('b') || text.includes('baja')) return 'b';
        if (text.startsWith('p') || text.includes('perm')) return 'p';
        return '';
    };

    const definitions = {
        m: {
            label: 'Mañana',
            icon: '☀️',
            publicClass: 'v-mañana',
            mobileClass: 'm',
            adminStyle: 'background:#ebfbee; color:#2f9e44; border:1px solid #d3f9d8;'
        },
        t: {
            label: 'Tarde',
            icon: '🌅',
            publicClass: 'v-tarde',
            mobileClass: 't',
            adminStyle: 'background:#fff9db; color:#f08c00; border:1px solid #ffec99;'
        },
        n: {
            label: 'Noche',
            icon: '🌙',
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
            icon: '🏖️',
            publicClass: 'v-vac',
            mobileClass: 'v',
            adminStyle: 'background:#e3f2fd; color:#0277bd; border:1px solid #b3e5fc;'
        },
        b: {
            label: 'Baja',
            icon: '🏥',
            publicClass: 'v-baja',
            mobileClass: 'b',
            adminStyle: 'background:#fff5f5; color:#c92a2a; border:1px dashed #ffa8a8;'
        },
        p: {
            label: 'Permiso',
            icon: '📋',
            publicClass: 'v-perm',
            mobileClass: 'p',
            adminStyle: 'background:#f3f0ff; color:#7048e8; border:1px solid #d0bfff;'
        },
        ct: {
            label: 'Descanso',
            icon: '🔄',
            publicClass: 'v-descanso',
            mobileClass: 'd',
            adminStyle: 'background:#fff5f5; color:#fa5252; border:1px solid #ffc9c9;'
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
                label = fs.turnoFinal || label;
            }

            // 2. Icono: si hay modificación (intercambio, sustitución, refuerzo), ponemos 🔄
            if (fs.isModified) {
                icon = '🔄';
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
            publicClass,
            mobileClass,
            adminStyle,
            title,
            _finalState: fs // pasamos el original por si la UI lo necesita
        };
    };

    window.TurnosRules = {
        normalizeText,
        shiftKey,
        isCtType,
        isAbsenceType,
        describeCell,
        definitions
    };
})();
