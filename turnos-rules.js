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
            label: 'CT',
            icon: '🔄',
            publicClass: 'v-empty',
            mobileClass: 'empty',
            adminStyle: 'background:#ffffff; color:#0f172a; border:1px solid #dbe4ff;'
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
        const type = String(cell.tipo || 'NORMAL').toUpperCase();
        const key = shiftKey(cell.turno, type);
        const def = definitions[key] || definitions.empty;
        const isCt = key === 'ct' || isCtType(type);
        const isAbsence = isAbsenceType(type);
        let label = def.label || cell.turno || '';
        let publicClass = def.publicClass;
        let mobileClass = def.mobileClass;
        let adminStyle = def.adminStyle;
        let title = '';

        if (isCt && cell.turno && String(cell.turno).toUpperCase() !== 'CT') {
            const turnKey = shiftKey(cell.turno, 'NORMAL');
            const turnDef = definitions[turnKey];
            label = turnDef?.label || cell.turno;
            publicClass = turnDef?.publicClass || publicClass;
            mobileClass = turnDef?.mobileClass || mobileClass;
            adminStyle = turnDef?.adminStyle || adminStyle;
        }

        if (isCt) {
            title = cell.sustituto ? `Cambio de turno con: ${cell.sustituto}` : 'Cambio de turno';
        } else if (isAbsence && cell.sustituto) {
            title = `Sustituido por: ${cell.sustituto}`;
        } else if (cell.vacationCoverFor) {
            title = `Cubre vacaciones de: ${cell.vacationCoverFor}`;
        } else if (cell.coveringFor) {
            title = `Cubriendo a: ${cell.coveringFor}`;
        } else if (cell.isSub && cell.subFor) {
            title = `Cubriendo a: ${cell.subFor}`;
        }

        return {
            key,
            isCt,
            isAbsence,
            label,
            icon: isCt ? definitions.ct.icon : def.icon,
            publicClass,
            mobileClass,
            adminStyle,
            title
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
