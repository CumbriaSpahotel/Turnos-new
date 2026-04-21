// ==========================================
// 1. NÃšCLEO Y CONFIGURACIÃ“N GLOBAL
// ==========================================
window.parsedData = null;
window.$ = (s) => document.querySelector(s);
window.$$ = (s) => document.querySelectorAll(s);

// --- SISTEMA DE LOGS ---
window.addLog = (msg, type = 'info') => {
    const bodies = [$('#logBody'), $('#homeLogBody')];
    const time = new Date().toLocaleTimeString();
    
    bodies.forEach(body => {
        if (!body) return;
        const line = document.createElement('div');
        line.className = `log-line log-${type}`;
        line.style.borderLeft = `3px solid ${type === 'ok' ? '#10e898' : (type === 'warn' ? '#ff9800' : (type === 'error' ? '#ff5f57' : 'var(--accent)'))}`;
        line.style.padding = '5px 10px';
        line.style.fontSize = '0.75rem';
        line.style.marginBottom = '2px';
        line.textContent = `> ${msg} [${time}]`;
        
        if (body.id === 'homeLogBody') {
            body.prepend(line);
        } else {
            body.appendChild(line);
            body.scrollTop = body.scrollHeight;
        }
    });
};

// --- NAVEGACIÃ“N ---
window.switchSection = (id) => {
    window.addLog(`Cambiando a secciÃ³n: ${id}`);
    const sections = $$('.section');
    const navItems = $$('.nav-item');
    
    sections.forEach(s => s.classList.remove('active'));
    navItems.forEach(n => n.classList.remove('active'));

    const targetSec = $(`#section-${id}`);
    if (targetSec) targetSec.classList.add('active');

    const targetNav = $(`#nav-${id}`);
    if (targetNav) targetNav.classList.add('active');

    // Carga bajo demanda si es necesario
    if (id === 'preview') window.renderPreview();
    if (id === 'excel') window.renderExcelView();
};

window.toggleTheme = () => {
    document.body.classList.toggle('light-mode');
    const isLight = document.body.classList.contains('light-mode');
    localStorage.setItem('turnosweb_theme', isLight ? 'light' : 'dark');
    window.addLog(`Cambiando modo de color`);
};


window.fmtDate = (d) => {
    if (!d || d.length < 10) return d || 'â€”';
    const parts = d.split('-');
    return `${parseInt(parts[2])}/${parseInt(parts[1])}/${parts[0]}`;
};

window.fmtDateLegacy = (date) => {
    if (!date) return 'â€”';
    const d = new Date(date);
    if (isNaN(d.getTime())) return date;
    const day = String(d.getDate()).padStart(2, '0');
    const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
    const month = months[d.getMonth()];
    const year = String(d.getFullYear()).slice(-2);
    return `${day}/${month}/${year}`;
};

// ==========================================
// 0. SUPABASE SYNC LOGIC
// ==========================================
window.syncToSupabase = async (flatData) => {
    if (!window.TurnosDB) return;
    try {
        window.addLog(`ðŸš€ INICIANDO MIGRACIÃ“N A SUPABASE...`, 'ok');
        let processed = 0;
        const total = flatData.length;

        // MigraciÃ³n por lotes (opcional, upsert ya es eficiente)
        // Por ahora lo hacemos directo para simplicidad
        await window.TurnosDB.bulkUpsert(flatData);
        
        window.addLog(`âœ¨ MIGRACIÃ“N EXITOSA: ${total} registros sincronizados âœ…`, 'ok');
        window.updateDashboardStats();
    } catch (e) {
        console.error("Error migrando a Supabase:", e);
        window.addLog(`âš ï¸ ERROR EN MIGRACIÃ“N: ${e.message}`, 'error');
    }
};

window.clearAllData = async () => {
    if (!confirm("âš ï¸ Â¿ESTÃS SEGURO? Esto borrarÃ¡ TODO el cuadrante de Supabase de forma permanente.")) return;
    try {
        await window.TurnosDB.clearAll();
        window.addLog("Base de datos vaciada", "warn");
        location.reload();
    } catch(e) {
        alert("Error al borrar: " + e.message);
    }
};

window.updateDashboardStats = () => {
    const data = window.parsedData;
    if (!data) return;

    // Fecha actual
    const today = new Date().toISOString().split('T')[0];
    const headerDate = document.getElementById('current-date-header');
    if (headerDate) headerDate.textContent = new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    // Empleados activos hoy
    let active = 0;
    (data.schedule || []).forEach(g => {
        g.turnos.forEach(t => {
            if (t.fecha === today && t.turno && !String(t.turno).toLowerCase().includes('descanso')) active++;
        });
    });
    const elActive = document.getElementById('stat-active-emp');
    if (elActive) elActive.textContent = active;

    // Permutas
    const elSwaps = document.getElementById('stat-pending-swaps');
    if (elSwaps) elSwaps.textContent = (data.swaps || []).length;

    // Vacaciones (prÃ³ximos 30 dÃ­as)
    const next30 = new Date(); next30.setDate(next30.getDate() + 30);
    const next30Str = next30.toISOString().split('T')[0];
    const vacEmps = new Set();
    (data.schedule || []).forEach(g => {
        g.turnos.forEach(t => {
            const raw = typeof t.turno === 'string' ? t.turno : (t.turno.TipoInterpretado || t.turno.TurnoOriginal || '');
            if (t.fecha >= today && t.fecha <= next30Str && window.classify(raw) === 'v') vacEmps.add(t.empleado);
        });
    });
    const elVac = document.getElementById('stat-next-vac');
    if (elVac) elVac.textContent = vacEmps.size;

    // Dashboard stats updated successfully
};

window.isoDate = (date) => {
    if (!date) return '';
    let d;
    if (typeof date === 'number') {
        // Excel base date is 1899-12-30. 
        // Note: 25569 is the number of days between 1899-12-30 and 1970-01-01
        d = new Date((date - 25569) * 86400 * 1000);
    } else if (typeof date === 'string' && date.includes('-')) {
        // Force local midnight to avoid timezone shifting
        d = new Date(date + 'T00:00:00');
    } else {
        d = new Date(date);
    }
    if (isNaN(d.getTime())) return date;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

window.addDays = (iso, n) => {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(y, m - 1, d + n);
    return window.isoDate(dt);
};

window.getMonday = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
};

window.classify = (raw) => {
    if (!raw) return '';
    const s = String(raw).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    // DetecciÃ³n mejorada de vacaciones (incluyendo emojis y prefijos)
    if (s.startsWith('v') || s.includes('vac') || s.includes('ðŸ–ï¸')) return 'v';
    if (s.startsWith('b') || s.includes('baja') || s.includes('permis') || s === 'p' || s.includes('ðŸ¥') || s.includes('ðŸ“')) return 'b';
    if (s === 'd' || s.startsWith('desc') || s.includes('ðŸ—“ï¸')) return 'd';
    if (s.startsWith('m')) return 'm';
    if (s.startsWith('t')) return 't';
    if (s.startsWith('n')) return 'n';
    return '';
};

// --- HELPERS DE MAPEADO (ESTRICTOS V8.2) ---
function extraerTurno(txt) {
    const t = String(txt || '').toLowerCase();
    if (t.includes('mañana') || t.includes('maÃ±ana')) return 'M';
    if (t.includes('tarde')) return 'T';
    if (t.includes('noche')) return 'N';
    if (t.includes('descanso')) return 'D';
    return '';
}

function detectarTipo(txt) {
    const t = String(txt || '').toLowerCase();
    if (t.includes('vac')) return 'VAC';
    if (t.includes('baja')) return 'BAJA';
    if (t.includes('perm')) return 'PERM';
    // Solo CT si es expresamente un cambio/permuta entre dos personas
    if (t.includes('c/t') || t.includes('cambio')) return 'CT';
    return 'NORMAL';
}

window.getShiftClass = (key) => ({ 'm': 'mañana', 't': 'tarde', 'n': 'noche', 'v': 'vacaciones', 'd': 'descanso', 'b': 'baja' }[key] || 'x');

window.saveData = () => {
    if (!window.parsedData) return;
    try {
        localStorage.setItem('turnosweb_admin_data', JSON.stringify(window.parsedData));
        if ($('#status-text')) $('#status-text').textContent = 'Guardado Nube + Local';
    } catch(e) {
        if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
            window.addLog('âš ï¸ LIMITE LOCAL: Datos demasiado grandes para el navegador. Usando solo NUBE.', 'warn');
            localStorage.removeItem('turnosweb_admin_data');
            if ($('#status-text')) $('#status-text').textContent = 'Solo Nube (Local Lleno)';
        } else if (!window._storageWarningShown) {
            window.addLog('âŒ ERROR: Bloqueo de Almacenamiento detectado.', 'error');
            alert("âš ï¸ ATENCIÃ“N: Tu navegador estÃ¡ bloqueando el almacenamiento de datos. Debes desactivar la 'PrevenciÃ³n de Seguimiento Estricta' o permitir cookies para este sitio.");
            window._storageWarningShown = true;
        }
    }
};

// ==========================================
// 2. MOTOR DE PROCESAMIENTO EXCEL (PARSER)
// ==========================================
window.processWorkbook = async (wb) => {
    window.addLog(`🚀 INICIANDO IMPORTACIÓN v8 (Solo Turnos)...`);
    
    // Normalizar nombre de hotel desde el nombre de la pestaña
    const normalizeHotel = (name) => {
        const n = String(name || '').toUpperCase();
        if (n.includes('GUADIANA')) return 'Sercotel Guadiana';
        if (n.includes('CUMBRIA'))  return 'Cumbria Spa&Hotel';
        return name;
    };

    // Días de la semana en orden lunes→domingo
    const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

    const toInsert = [];
    const seen    = new Set();
    window.hotelOrders = {};

    // ── Procesar CADA pestaña como cuadrante de hotel ──────────────────────
    for (const sheetName of wb.SheetNames) {
        const sheet   = wb.Sheets[sheetName];
        const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        if (rawRows.length === 0) continue;

        // Detectar si la pestaña tiene columna de empleado/nombre
        const firstRow = rawRows[0];
        const hasEmpCol = Object.keys(firstRow).some(k =>
            k.trim().toLowerCase().includes('empleado') ||
            k.trim().toLowerCase().includes('nombre')
        );
        if (!hasEmpCol) {
            window.addLog(`⚠️ Pestaña "${sheetName}" ignorada (sin columna Empleado/Nombre).`, 'warn');
            continue;
        }

        const hotelID = normalizeHotel(sheetName);
        window.addLog(`📋 Procesando hoja "${sheetName}" → ${hotelID}...`);
        if (!window.hotelOrders[hotelID]) window.hotelOrders[hotelID] = [];

        rawRows.forEach(rawRow => {
            // Limpiar espacios en claves
            const row = {};
            for (let k in rawRow) row[String(k).trim()] = rawRow[k];

            // Buscar columna de semana
            const semanaCol = Object.keys(row).find(k => k.toLowerCase().includes('semana'));
            const rawSemana = row[semanaCol];
            if (!rawSemana) return;

            // Calcular fecha del lunes de esa semana
            const weekDate = typeof rawSemana === 'number'
                ? new Date((rawSemana - 25569) * 86400 * 1000)
                : new Date(rawSemana);
            const lunes = window.isoDate(window.getMonday(weekDate));

            // Columna de empleado
            const empCol = Object.keys(row).find(k =>
                k.toLowerCase().includes('empleado') ||
                k.toLowerCase().includes('nombre')
            );
            const emp = String(row[empCol] || '').trim();
            if (!lunes || !emp) return;

            // Registrar orden de empleado en este hotel
            if (!window.hotelOrders[hotelID].includes(emp)) {
                window.hotelOrders[hotelID].push(emp);
            }

            // Procesar cada día (Lunes a Domingo)
            DIAS.forEach((dia, i) => {
                // Buscar columna del día (ignorando tildes)
                const norm = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                const diaCol = Object.keys(row).find(k => norm(k).includes(norm(dia)));
                if (!diaCol) return;

                const fechaISO  = window.addDays(lunes, i);
                const rawTurno  = String(row[diaCol] || '').trim();
                const uniqKey   = `${emp}|${fechaISO}`;

                if (seen.has(uniqKey)) return;
                seen.add(uniqKey);

                // Mapear turno → M / T / N / D
                const finalTurno = extraerTurno(rawTurno);
                if (!finalTurno) return; // celda vacía o valor no reconocido → omitir

                toInsert.push({
                    empleado_id: emp,
                    fecha:       fechaISO,
                    turno:       finalTurno,
                    hotel_id:    hotelID,
                    tipo:        'NORMAL',
                    sustituto:   null
                });
            });
        });

        window.addLog(`   ✅ ${hotelID}: ${toInsert.filter(r => r.hotel_id === hotelID).length} turnos listos.`, 'ok');
    }

    // ── Subir a Supabase ────────────────────────────────────────────────────
    if (toInsert.length === 0) {
        window.addLog(`⚠️ No se encontraron turnos válidos para importar.`, 'warn');
        return;
    }

    try {
        // SEGURIDAD V9.1: No sobrescribir Vacaciones/Bajas/CT con turnos de Excel
        window.addLog(`🔍 Verificando protección de ausencias gestionadas en la App...`);
        
        const allDates = toInsert.map(r => r.fecha);
        const minDate = allDates.length ? allDates.reduce((a, b) => a < b ? a : b) : null;
        const maxDate = allDates.length ? allDates.reduce((a, b) => a > b ? a : b) : null;
        
        let safeToInsert = toInsert;
        if (minDate && maxDate) {
            const existing = await window.TurnosDB.fetchRango(minDate, maxDate);
            const specialMap = new Set(
                existing
                    .filter(r => r.tipo !== 'NORMAL' && r.tipo !== '')
                    .map(r => `${r.empleado_id}|${r.fecha}`)
            );
            safeToInsert = toInsert.filter(r => !specialMap.has(`${r.empleado_id}|${r.fecha}`));
            const skipped = toInsert.length - safeToInsert.length;
            if (skipped > 0) {
                window.addLog(`⚖️ OMITIDOS: ${skipped} turnos del Excel coincidían con Vacaciones/Bajas/CT gestionados en la App.`, 'warn');
            }
        }

        if (safeToInsert.length > 0) {
            window.addLog(`☁️ Subiendo ${safeToInsert.length} registros a Supabase...`);
            await window.TurnosDB.bulkUpsert(safeToInsert);
            window.addLog(`🚀 Importación realizada: ${safeToInsert.length} turnos actualizados.`, 'ok');
        } else {
            window.addLog(`⚠️ No hay turnos nuevos para subir (todos estaban protegidos o eran duplicados).`, 'warn');
        }

        // Sincronizar fichas de empleados (orden del Excel)
        const uniqueEmpMap = {};
        toInsert.forEach(t => {
            if (!uniqueEmpMap[t.empleado_id]) uniqueEmpMap[t.empleado_id] = t.hotel_id;
        });

        const empObjects = Object.entries(uniqueEmpMap).map(([name, hotel]) => {
            let ordenFinal = 999;
            Object.values(window.hotelOrders || {}).forEach(list => {
                const idx = list.indexOf(name);
                if (idx !== -1 && idx < ordenFinal) ordenFinal = idx;
            });
            return { id: name, nombre: name, hotel_id: hotel, orden: ordenFinal, activo: true, updated_at: new Date().toISOString() };
        });

        if (empObjects.length > 0) {
            window.addLog(`👤 Sincronizando ${empObjects.length} fichas de empleados...`);
            await window.supabase.from('empleados').upsert(empObjects);
            window.addLog(`✅ Empleados sincronizados.`, 'ok');
        }

        await localforage.clear();
        window.renderPreview();
    } catch (err) {
        console.error('Error en importación v8:', err);
        window.addLog(`❌ FALLO EN IMPORTACIÓN: ${err.message}`, 'error');
        alert('Error crítico durante la importación. Revisa la consola.');
    }
};

// ==========================================
// 3. MOTOR DE VISTAS (PREVIEW)
// ==========================================
window._previewMode = 'weekly';
window.switchPreviewMode = (mode) => {
    window._previewMode = mode;
    const btnW = $('#btnViewWeekly'), btnM = $('#btnViewMonthly');
    const dateC = $('#prevDateContainer'), monthC = $('#prevMonthContainer');
    
    if (btnW) btnW.classList.toggle('active', mode === 'weekly');
    if (btnM) btnM.classList.toggle('active', mode === 'monthly');
    
    if (dateC) dateC.style.display = mode === 'weekly' ? 'block' : 'none';
    if (monthC) monthC.style.display = mode === 'monthly' ? 'block' : 'none';
    
    window.renderPreview();
};

window.renderPreview = async () => {
    const area = $('#previewContent');
    if (!area) return;
    
    // 1. Obtener parÃ¡metros de filtro
    const hotelSel = $('#prevHotel')?.value || 'all';
    const isWeekly = window._previewMode === 'weekly';
    const rawDate = $('#prevWeekDate')?.value || window.isoDate(new Date());
    const rawMonth = $('#prevMonth')?.value || window.isoDate(new Date()).substring(0,7);

    area.innerHTML = `<div style="padding:4rem; text-align:center; opacity:0.5;"><i class="fas fa-spinner fa-spin"></i> Cargando cuadrantes...</div>`;

    try {
        // 2. Determinar Rango de Fechas (Garantizar Lunes)
        let start, end;
        if (isWeekly) {
            const base = new Date(rawDate + 'T12:00:00');
            start = window.getMonday(base);
            end = new Date(start);
            end.setDate(start.getDate() + 6);
        } else {
            const [y, m] = rawMonth.split('-').map(Number);
            start = new Date(y, m - 1, 1);
            end = new Date(y, m, 0);
        }

        const startISO = window.isoDate(start);
        const endISO = window.isoDate(end);

        // 3. Fetch de datos
        const data = await window.TurnosDB.fetchRango(startISO, endISO);
        const hotels = await window.TurnosDB.getHotels();
        const profiles = await window.TurnosDB.getEmpleados();
        const excelSource = await loadExcelSourceRows().catch(() => ({}));
        
        const hotelsToRender = hotelSel === 'all' ? hotels : [hotelSel];
        area.innerHTML = '';

        // 4. Construir Columnas
        const columns = [];
        let curr = new Date(start);
        while (curr <= end) {
            const iso = window.isoDate(curr);
            const dayNames = ['DOMINGO','LUNES','MARTES','MIERCOLES','JUEVES','VIERNES','SABADO'];
            columns.push({
                date: iso,
                dayName: dayNames[curr.getDay()],
                dayDisplay: window.TurnosDB.fmtDateLegacy(iso)
            });
            curr.setDate(curr.getDate() + 1);
        }

        // 5. Renderizar cada Hotel
        for (const hName of hotelsToRender) {
            const hData = data.filter(t => t.hotel_id === hName);
            if (hData.length === 0) continue;

            // ── ORDENAMIENTO DE EMPLEADOS (Regla v8) ─────────────────────────
            // A) Empleados que tienen turno en este hotel (base: Excel order)
            const hProfiles = profiles
                .filter(p => p.hotel_id === hName || profiles.some(x => x.hotel_id === hName && x.id === p.id))
                .sort((a, b) => (a.orden ?? 999) - (b.orden ?? 999) || String(a.id).localeCompare(String(b.id)));

            // Recopilar todos los IDs presentes en los datos (empleados + sustitutos)
            const allIds = new Map();
            hData.forEach(t => {
                if (t.empleado_id) allIds.set(normalizeEmployeeKey(t.empleado_id), String(t.empleado_id).trim());
                if (t.sustituto)   allIds.set(normalizeEmployeeKey(t.sustituto), String(t.sustituto).trim());
            });

            // B) Detectar quién está de VAC/BAJA/PERM en ALGÚN día del periodo
            const isAbsent = new Set();
            hData.forEach(t => {
                const tipo = (t.tipo || '').toUpperCase();
                if (tipo.startsWith('VAC') || tipo.startsWith('BAJA') || tipo.startsWith('PERM')) {
                    isAbsent.add(normalizeEmployeeKey(t.empleado_id));
                }
            });

            // C) Detectar quién sustituye a quién (sustituto → empleado ausente)
            const replacedBy = {};  // { ausente: sustituto }
            const replacing  = {};  // { sustituto: ausente }
            hData.forEach(t => {
                const absentKey = normalizeEmployeeKey(t.empleado_id);
                const subKey = normalizeEmployeeKey(t.sustituto);
                if (subKey && isAbsent.has(absentKey)) {
                    replacedBy[absentKey] = String(t.sustituto).trim();
                    replacing[subKey] = String(t.empleado_id).trim();
                }
            });

            // D) Construir lista ordenada final (SEGÚN EXCEL ORIGINAL)
            const rendered = new Set();
            const empList  = [];  // [{ id, displayAs, isAbsent, substituteFor }]

            // Usar el orden del Excel fuente para este hotel y esta semana
            const sourceRows = excelSource[hName] || [];
            const currentWeekRows = sourceRows.filter(r => r.weekStart === startISO);
            const displayByKey = new Map();
            const excelOrder = [];
            currentWeekRows.forEach(r => {
                const key = normalizeEmployeeKey(r.empleadoId);
                if (!key || displayByKey.has(key)) return;
                displayByKey.set(key, String(r.displayName || r.empleadoId || '').trim());
                excelOrder.push(key);
            });

            // Regla: Substitutos en posición del ausente, Ausentes al final
            excelOrder.forEach(empKey => {
                if (!empKey || rendered.has(empKey)) return;

                if (isAbsent.has(empKey)) {
                    // Si está ausente, buscamos su sustituto en los datos de Supabase
                    const sub = replacedBy[empKey];
                    const subKey = normalizeEmployeeKey(sub);
                    if (subKey && !rendered.has(subKey)) {
                        empList.push({
                            id: allIds.get(subKey) || sub,
                            displayAs: allIds.get(subKey) || sub,
                            isAbsent: false,
                            substituteFor: allIds.get(empKey) || displayByKey.get(empKey) || empKey
                        });
                        rendered.add(subKey);
                    }
                    // El ausente NO se añade aquí, se añade al final
                } else if (replacing[empKey]) {
                    // Es un sustituto asignado manualmente; si ya se procesó con su "ausente", skip.
                    // Si llegamos aquí y no ha sido procesado, es un trabajador normal.
                    const display = allIds.get(empKey) || displayByKey.get(empKey) || empKey;
                    empList.push({ id: display, displayAs: display, isAbsent: false, substituteFor: null });
                    rendered.add(empKey);
                } else {
                    const display = allIds.get(empKey) || displayByKey.get(empKey) || empKey;
                    empList.push({ id: display, displayAs: display, isAbsent: false, substituteFor: null });
                    rendered.add(empKey);
                }
            });

            // Añadir IDs que estén en hData pero NO en el Excel de esta semana (casos raros)
            allIds.forEach((display, empKey) => {
                if (!rendered.has(empKey) && !isAbsent.has(empKey)) {
                    empList.push({ id: display, displayAs: display, isAbsent: false, substituteFor: null });
                    rendered.add(empKey);
                }
            });

            // Finalmente, añadir los ausentes (VAC/BAJA/PERM) al final de la tabla
            isAbsent.forEach(empKey => {
                if (!rendered.has(empKey)) {
                    const display = allIds.get(empKey) || displayByKey.get(empKey) || empKey;
                    empList.push({ id: display, displayAs: display, isAbsent: true, substituteFor: null });
                    rendered.add(empKey);
                }
            });

            if (empList.length === 0) continue;

            // ── RENDER HTML ────────────────────────────────────────────────
            const hotelSection = document.createElement('div');
            hotelSection.innerHTML = `
                <div class="glass-panel" style="margin-bottom:3rem; padding:0; overflow:hidden; border:1px solid #ddd; background:white; border-radius:12px; box-shadow:0 2px 15px rgba(0,0,0,0.03);">
                    <div style="padding:15px 25px; border-bottom:1px solid #eee; display:flex; align-items:center; gap:15px; background:white;">
                        <div style="background:white; padding:4px; border:1px solid #eee; border-radius:8px; display:flex; align-items:center; justify-content:center; width:45px; height:45px; min-width:45px;">
                            <img src="${hName.toLowerCase().includes('guadiana') ? 'guadiana logo.jpg' : 'cumbria logo.jpg'}" style="width:100%; height:100%; object-fit:contain;">
                        </div>
                        <h2 style="margin:0; font-size:1.1rem; color:#444; font-weight:700;">${hName} - <span style="color:#888; font-weight:500;">Semana ${window.TurnosDB.fmtDateLegacy(startISO)}</span></h2>
                    </div>
                    <div style="overflow-x:auto; background:white;">
                        <table class="preview-table" style="width:100%; border-collapse:collapse; margin:0;">
                            <thead>
                                <tr style="background:#f8f9fa;">
                                    <th style="padding:1px 25px; text-align:left; border-bottom:1px solid #eee; width:220px; color:#888; font-size:0.75rem; text-transform:uppercase; letter-spacing:0.02em; position:sticky; left:0; background:#f8f9fa; z-index:4; border-right:1px solid #eee;">Empleado</th>
                                    ${columns.map(c => `
                                        <th style="padding:12px; border-bottom:1px solid #eee; text-align:center; min-width:115px; border-left:1px solid #eee;">
                                            <div style="font-size:0.65rem; color:#999; text-transform:uppercase; font-weight:700; margin-bottom:2px;">${c.dayName}</div>
                                            <div style="font-size:0.75rem; font-weight:600; color:#555;">${c.dayDisplay.toLowerCase()}</div>
                                        </th>
                                    `).join('')}
                                </tr>
                            </thead>
                            <tbody>
                                ${empList.map(entry => {
                                    const { id: emp, displayAs, isAbsent: empIsAbsent, substituteFor } = entry;
                                    const empKey = normalizeEmployeeKey(emp);
                                    
                                    // REGLA: Si es sustituto, coge los turnos del ausente desde el EXCEL en la semana correspondiente
                                    let activeShifts = [];
                                    if (substituteFor) {
                                        const sourceRows = excelSource[hName] || [];
                                        // Buscar la fila del ausente QUE CORRESPONDA A ESTA SEMANA (startISO)
                                        const absenteeRow = sourceRows.find(r => normalizeEmployeeKey(r.empleadoId) === normalizeEmployeeKey(substituteFor) && r.weekStart === startISO);
                                        
                                        columns.forEach((col, idx) => {
                                            const turn = absenteeRow ? absenteeRow.values[idx] : null;
                                            activeShifts.push({ fecha: col.date, turno: turn || '', tipo: 'NORMAL' });
                                        });
                                    } else {
                                        activeShifts = hData.filter(t => normalizeEmployeeKey(t.empleado_id) === empKey);
                                    }

                                    const nights = activeShifts.filter(t => (t.turno||'').toLowerCase().startsWith('n')).length;
                                    const rests  = activeShifts.filter(t => (t.turno||'').toLowerCase().startsWith('d')).length;

                                    const nameStyle = empIsAbsent
                                        ? 'font-weight:600; color:#aaa; font-size:0.85rem; white-space:nowrap; text-decoration:line-through;'
                                        : 'font-weight:600; color:var(--accent); font-size:0.85rem; white-space:nowrap;';
                                    
                                    const labelSuffix = '';

                                    return `
                                        <tr style="border-bottom:1px solid #eee; ${empIsAbsent ? 'opacity:0.45; background:#fafafa;' : ''}">
                                            <td style="padding:12px 25px; vertical-align:middle; background:white; position:sticky; left:0; z-index:2; border-right:1px solid #eee;">
                                                <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
                                                    <div>
                                                        <span style="${nameStyle}">${escapeHtml(displayAs)}</span>
                                                        ${labelSuffix}
                                                    </div>
                                                    <div style="display:flex; gap:6px; background:rgba(0,0,0,0.03); padding:4px 8px; border-radius:10px;">
                                                        <div style="font-size:0.65rem; color:#f0ad4e; font-weight:700;">N ${nights}</div>
                                                        <div style="font-size:0.65rem; color:#5bc0de; font-weight:700;">D ${rests}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            ${columns.map(c => {
                                                const s = activeShifts.find(t => t.fecha === c.date);
                                                if (!s) return `<td style="background:#fdfdfd; border-left:1px solid #eee;"></td>`;

                                                const tipo = (s.tipo || '').toUpperCase();
                                                const turnoLC = (s.turno || '').toLowerCase();
                                                let cls = 'x', label = s.turno || '-';

                                                if (tipo.startsWith('VAC')) { cls = 'vacaciones'; label = 'Vacaciones 🏖️'; }
                                                else if (tipo.startsWith('BAJA')) { cls = 'baja'; label = 'Baja 🏥'; }
                                                else if (tipo.startsWith('PERM')) { cls = 'permiso'; label = 'Permiso'; }
                                                else if (tipo.includes('CT')) { 
                                                    cls = turnoLC.startsWith('m') ? 'mañana' : turnoLC.startsWith('t') ? 'tarde' : turnoLC.startsWith('n') ? 'noche' : 'descanso'; 
                                                    label = (turnoLC.startsWith('m') ? 'Mañana' : turnoLC.startsWith('t') ? 'Tarde' : turnoLC.startsWith('n') ? 'Noche' : 'Descanso') + ' ↕'; 
                                                } else {
                                                    if (turnoLC.startsWith('m')) { cls = 'mañana'; label = 'Mañana'; }
                                                    else if (turnoLC.startsWith('t')) { cls = 'tarde'; label = 'Tarde'; }
                                                    else if (turnoLC.startsWith('n')) { cls = 'noche'; label = 'Noche'; }
                                                    else if (turnoLC.startsWith('d')) { cls = 'descanso'; label = 'Descanso'; }
                                                }

                                                return `
                                                    <td style="padding:10px; text-align:center; border-left:1px solid #eee;">
                                                        <div class="turno-pill-legacy turno-${cls}" style="display:inline-flex; align-items:center; justify-content:center; padding:8px 5px; width:100%; border-radius:15px; font-size:0.8rem; font-weight:600; box-shadow:0 2px 4px rgba(0,0,0,0.05);">
                                                            ${label}
                                                        </div>
                                                    </td>
                                                `;
                                            }).join('')}
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
            area.appendChild(hotelSection);
        }

        if (area.children.length === 0) {
            area.innerHTML = `<div style="padding:4rem; text-align:center; opacity:0.3;">No se han encontrado empleados ni turnos para este periodo.</div>`;
        }
    } catch (err) {
        console.error("Error en Vista Previa:", err);
        area.innerHTML = `<div style="padding:2rem; color:var(--danger); text-align:center;">Error: ${err.message}</div>`;
    }
};

window.renderSemanaEnContenedor = async (container, inicio, fin, hotelData) => {
    const isMonthly = (new Date(fin) - new Date(inicio)) > (8 * 24 * 60 * 60 * 1000);
    
    // Construir columnas
    const columns = [];
    let curr = new Date(inicio);
    const end = new Date(fin);
    while (curr <= end) {
        const iso = window.isoDate(curr);
        const dayName = ['DOMINGO','LUNES','MARTES','MIERCOLES','JUEVES','VIERNES','SABADO'][curr.getDay()];
        columns.push({
            dbFecha: iso,
            title: dayName,
            subtitle: window.fmtDateLegacy(iso),
            isWeekend: curr.getDay() === 0 || curr.getDay() === 6,
            isToday: iso === window.isoDate(new Date())
        });
        curr.setDate(curr.getDate() + 1);
    }
    
    const virtualTable = new window.VirtualTable(container, {
        columns: columns,
        rowHeight: isMonthly ? 30 : 50,
        compact: isMonthly
    });
    
    // --- LÃ“GICA DE FUSIÃ“N DE SUSTITUTOS (V8.2) ---
    // 1. Obtener lista de empleados base + sustitutos mencionados
    const empBase = new Set(hotelData.map(t => t.empleado_id));
    hotelData.forEach(t => { if (t.sustituto) empBase.add(t.sustituto); });
    
    // 2. Ordenar segÃºn el orden persistido (V8.2 Premium)
    // Intentamos obtener el perfil de cada empleado para ver su orden
    const profiles = window._cachedProfiles || [];
    const getOrder = (n) => {
        const p = profiles.find(pr => pr.id === n);
        return p ? (p.orden ?? 999) : 999;
    };

    const empNames = Array.from(empBase).sort((a, b) => {
        const oA = getOrder(a);
        const oB = getOrder(b);
        if (oA !== oB) return oA - oB;
        return a.localeCompare(b);
    });

    // 2. Construir filas
    const rows = empNames.map(name => {
        const cells = columns.map(c => {
            // Buscamos si este empleado tiene un registro directo
            const direct = hotelData.find(s => s.empleado_id === name && s.fecha === c.dbFecha);
            if (direct) {
                return { turno: direct.turno, tipo: direct.tipo, sustituto: direct.sustituto };
            }
            
            // Si no tiene registro directo, Â¿estÃ¡ sustituyendo a alguien?
            const beingSubstituted = hotelData.find(s => s.sustituto === name && s.fecha === c.dbFecha);
            if (beingSubstituted) {
                return { 
                    turno: beingSubstituted.turno, 
                    tipo: 'NORMAL', 
                    isSub: true, 
                    subFor: beingSubstituted.empleado_id 
                };
            }

            return { turno: '', tipo: 'NORMAL' };
        });
        return { empName: name, cells: cells };
    });
    
    virtualTable.setData(rows);
    
    container.addEventListener('cellEdit', (e) => {
        window.abrirEditorRapido(e.detail.empleado, e.detail.fecha, e.detail.cellElement);
    });
};

window.populatePreview = () => {
    // Inicializar Flatpickrs
    if (window.flatpickr) {
        flatpickr("#prevWeekDate", {
            dateFormat: "Y-m-d",
            defaultDate: "today",
            locale: { ...flatpickr.l10ns.es, firstDayOfWeek: 1 },
            onChange: () => window.renderPreview()
        });
        flatpickr("#prevMonth", {
            dateFormat: "Y-m",
            defaultDate: new Date(),
            locale: { ...flatpickr.l10ns.es, firstDayOfWeek: 1 },
            plugins: [new monthSelectPlugin({ shothand: true, dateFormat: "Y-m", altFormat: "F Y" })],
            onChange: () => window.renderPreview()
        });
    }
    
    // Disparar carga base
    setTimeout(() => window.renderPreview(), 500);
};

window.populateHotels = async () => {
    const hotels = await window.TurnosDB.getHotels();
    
    const sel = $('#prevHotel');
    if (sel) {
        sel.innerHTML = `<option value="all">TODOS LOS HOTELES</option>` + 
            hotels.map(h => `<option value="${h}">${h}</option>`).join('');
    }

    const selExcel = $('#excelHotel');
    if (selExcel) {
        selExcel.innerHTML = `<option value="all">Ver Todos los Hoteles</option>` + 
            hotels.map(h => `<option value="${h}">${h}</option>`).join('');
    }

    const selVac = $('#vacHotel');
    if (selVac) {
        selVac.innerHTML = `<option value="all">Todos los Hoteles</option>` + 
            hotels.map(h => `<option value="${h}">${h}</option>`).join('');
    }
};

window.populateVacationFilters = async () => {
    const emps = await window.TurnosDB.getEmpleados();
    const selVacEmp = $('#vacEmp');
    if (selVacEmp) {
        // Deduplicar visualmente por ID limpio
        const uniqueEmps = [];
        const seen = new Set();
        emps.forEach(e => {
            const cleanId = window.TurnosDB.cleanName(e.id);
            if (!seen.has(cleanId)) {
                seen.add(cleanId);
                uniqueEmps.push({ ...e, id: cleanId });
            }
        });

        selVacEmp.innerHTML = `<option value="all">Todos los Empleados</option>` + 
            uniqueEmps.map(e => `<option value="${e.id}">${e.nombre}</option>`).join('');
    }

    if (window.flatpickr) {
        flatpickr("#vacRange", {
            mode: "range",
            dateFormat: "Y-m-d",
            locale: { ...flatpickr.l10ns.es, firstDayOfWeek: 1 },
            onChange: () => window.renderVacationsView()
        });
    }
};

// ==========================================
// 3. ORQUESTADOR DE RENDERIZACIÃ“N PÃšBLICA (VIRTUALIZADO)
// ==========================================
window.currentSemana = { inicio: null, fin: null, data: [] };
window.virtualTable = null;

window.renderSemana = async (inicio, fin) => {
    const area = $('#previewContent');
    if (!area) return;
    
    // Mostramos estado de carga visual si es necesario
    if (!window.virtualTable) {
        area.innerHTML = `<div style="padding:4rem; text-align:center; color:var(--text-dim);">Cargando Cuadrante Seguro...</div>`;
    }

    try {
        // 1. Fetch via DAO
        let data = await window.TurnosDB.fetchRango(inicio, fin);
        
        const selHotel = $('#prevHotel')?.value;
        if (selHotel && selHotel !== 'all' && selHotel !== '') {
            data = data.filter(t => t.hotel_id === selHotel);
        }
        
        window.currentSemana = { inicio, fin, data };

        // 3. Renderizado Multi-Hotel (V8.2 Premium)
        area.innerHTML = '';
        const hotelsFound = [...new Set(data.map(t => t.hotel_id))].sort();

        for (const hName of hotelsFound) {
            const hShifts = data.filter(t => t.hotel_id === hName);
            if (hShifts.length === 0) continue;

            const card = document.createElement('div');
            card.className = 'preview-week week';
            card.style.marginBottom = '2rem';
            card.innerHTML = `
                <div class="preview-week-header week-head">
                    <img src="${hName.includes('Guadiana') ? 'guadiana logo.jpg' : 'cumbria logo.jpg'}" 
                         style="width:38px; height:38px; border-radius:8px; object-fit:cover; border:1px solid rgba(0,0,0,0.1);">
                    <h3 style="color:var(--accent); font-weight:900; margin:0; font-size:1.1rem;">${hName.toUpperCase()}</h3>
                </div>
                <div id="grid-container-${hName.replace(/\s/g,'-')}" style="min-height:300px; padding:12px;"></div>
            `;
            area.appendChild(card);
            
            const gridContainer = card.querySelector(`#grid-container-${hName.replace(/\s/g,'-')}`);
            await window.renderSemanaEnContenedorV2(gridContainer, inicio, fin, hShifts, hName);
        }

    } catch (err) {
        console.error("Fallo renderizando semana:", err);
        area.innerHTML = `<div style="padding:2rem; color:red; text-align:center;">Error de Datos: ${err.message}</div>`;
    }
};

window.renderSemanaEnContenedorV2 = async (container, inicio, fin, hotelData, hotelName) => {
    const isMonthly = (new Date(fin) - new Date(inicio)) > (8 * 24 * 60 * 60 * 1000);
    
    // Construir columnas (Encabezados estilo Premium)
    const columns = [];
    let curr = new Date(inicio);
    const end = new Date(fin);
    while (curr <= end) {
        const iso = window.isoDate(curr);
        const dayNames = ['DOM','LUN','MAR','MIE','JUE','VIE','SAB'];
        columns.push({
            dbFecha: iso,
            title: dayNames[curr.getDay()],
            subtitle: `${curr.getDate()}/${curr.getMonth()+1}`,
            isWeekend: curr.getDay() === 0 || curr.getDay() === 6,
            isToday: iso === window.isoDate(new Date())
        });
        curr.setDate(curr.getDate() + 1);
    }
    
    const virtualTable = new window.VirtualTable(container, {
        columns: columns,
        rowHeight: isMonthly ? 34 : 52,
        compact: isMonthly
    });
    
    // --- LÃ“GICA DE FUSIÃ“N Y ORDENACIÃ“N (ESTILO V8.2 PREMIUM) ---
    const profiles = await window.TurnosDB.getEmpleados();
    
    // Unificar nombres usando normalización para evitar duplicados por tildes
    const empMap = new Map(); // normalized -> originalName
    hotelData.forEach(t => {
        if (t.empleado_id) {
            const norm = window.TurnosDB.normalizeString(t.empleado_id);
            if (!empMap.has(norm)) empMap.set(norm, t.empleado_id);
        }
        if (t.sustituto) {
            const normS = window.TurnosDB.normalizeString(t.sustituto);
            if (!empMap.has(normS)) empMap.set(normS, t.sustituto);
        }
    });
    
    const allUniqueNorm = Array.from(empMap.keys());

    // Contar ausencias para mover al fondo
    const absenceCount = {};
    allUniqueNorm.forEach(normName => {
        absenceCount[normName] = 0;
        columns.forEach(c => {
            const d = hotelData.find(s => window.TurnosDB.normalizeString(s.empleado_id) === normName && s.fecha === c.dbFecha);
            if (d && d.tipo !== 'NORMAL' && !d.tipo.includes('CT')) absenceCount[normName]++;
        });
    });

    const isTotalAbsent = (norm) => absenceCount[norm] >= columns.length;

    const getOrder = (norm) => {
        const name = empMap.get(norm);
        if (norm === '¿?' || name === '¿?') return -1;
        const p = profiles.find(pr => window.TurnosDB.normalizeString(pr.id) === norm || window.TurnosDB.normalizeString(pr.nombre) === norm);
        return p?.orden ?? 999;
    };

    const sortedNormNames = allUniqueNorm.sort((a, b) => {
        // 1. Ausentes totales al final
        const aAb = isTotalAbsent(a), bAb = isTotalAbsent(b);
        if (aAb !== bAb) return aAb ? 1 : -1;
        // 2. Orden de base de datos
        return getOrder(a) - getOrder(b);
    });

    const rows = sortedNormNames.map(normName => {
        const originalName = empMap.get(normName);
        const cells = columns.map(c => {
            const direct = hotelData.find(s => window.TurnosDB.normalizeString(s.empleado_id) === normName && s.fecha === c.dbFecha);
            if (direct) return { turno: direct.turno, tipo: direct.tipo, sustituto: direct.sustituto };
            
            const substituted = hotelData.find(s => window.TurnosDB.normalizeString(s.sustituto) === normName && s.fecha === c.dbFecha);
            if (substituted) return { turno: substituted.turno, tipo: 'NORMAL', isSub: true, subFor: substituted.empleado_id };
            
            return { turno: '', tipo: 'NORMAL' };
        });
        return { empName: originalName, cells: cells, hotel_id: hotelName };
    });
    
    virtualTable.setData(rows);
    container.addEventListener('cellEdit', (e) => {
        window.abrirEditorRapido(e.detail.empleado, e.detail.fecha, e.detail.cellElement);
    });
};

window.aplicarCambioLocal = (payload) => {
    // Callback disparado por el websocket de Supabase (DAO)
    if (!window.virtualTable) return;
    if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
        window.virtualTable.updateRow(payload.new);
    }
};

// ==========================================
// 4. EDITOR MODAL EN VIVO
// ==========================================
window.abrirEditorRapido = (empleadoId, fecha, cellEl) => {
    let modal = document.getElementById('quickEditModal');
    if(modal) modal.remove();
    const isExcelMode = !!cellEl?.classList?.contains('excel-shift-cell') || !!cellEl?.closest?.('.excel-native-view');
    const currentText = (cellEl?.textContent || '').trim();
    const currentShift = (() => {
        const t = currentText.toLowerCase();
        if (t.includes('mañana')) return 'M';
        if (t.includes('tarde')) return 'T';
        if (t.includes('noche')) return 'N';
        if (t.includes('descanso')) return 'D';
        if (['M', 'T', 'N', 'D'].includes(currentText.toUpperCase())) return currentText.toUpperCase();
        return '';
    })();
    
    modal = document.createElement('div');
    modal.id = 'quickEditModal';
    modal.style = `position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background:var(--surface); padding:25px; border-radius:15px; box-shadow:0 10px 50px rgba(0,0,0,0.6); z-index:9999; display:flex; gap:10px; flex-direction:column; border:1px solid var(--border); min-width:300px;`;
    
    if (isExcelMode) {
        modal.innerHTML = `
            <h3 style="margin:0 0 10px 0; text-align:center;">Editar turno</h3>
            <p style="margin:0 0 15px 0; text-align:center; color:var(--text-dim);"><b>${escapeHtml(empleadoId)}</b> &bull; ${escapeHtml(fecha)}</p>
            <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:10px;">
                ${['M','T','N','D'].map(v => `<button class="btn ${currentShift === v ? 'active' : ''}" style="font-weight:900;" onclick="window.guardarTurnoDireccion('${empleadoId.replace(/'/g, "\\'")}','${fecha}','${v}', this)">${v}</button>`).join('')}
            </div>
            <small style="text-align:center; color:var(--text-dim); margin-top:8px;">Solo cambios de turno. Se guarda como cambio de direccion.</small>
            <button class="btn" style="background:transparent; color:var(--text-dim); margin-top:10px;" onclick="document.getElementById('quickEditModal').remove()">Cancelar</button>
        `;
        document.body.appendChild(modal);
        return;
    }

    modal.innerHTML = `
        <h3 style="margin:0 0 10px 0; text-align:center;">Editar turno</h3>
        <p style="margin:0 0 15px 0; text-align:center; color:var(--text-dim);"><b>${empleadoId}</b> &bull; ${fecha}</p>
        
        <input type="text" id="quickTurno" placeholder="Ej: M, T, N" class="search-input" style="text-align:center; margin-bottom:15px; font-size:1.2rem; font-weight:bold;" autocomplete="off" value="${currentShift}">
        
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
            <button class="btn" style="background:rgba(255, 152, 0, 0.2); color:#ff9800;" onclick="window.seleccionarTipo('${empleadoId}','${fecha}','VAC')">VAC</button>
            <button class="btn" style="background:rgba(233, 30, 99, 0.2); color:#e91e63;" onclick="window.seleccionarTipo('${empleadoId}','${fecha}','BAJA')">BAJA</button>
            <button class="btn" style="background:rgba(33, 150, 243, 0.2); color:#2196f3;" onclick="window.seleccionarTipo('${empleadoId}','${fecha}','PERM')">PERM</button>
            <button class="btn" style="background:rgba(156, 39, 176, 0.2); color:#9c27b0;" onclick="window.seleccionarTipo('${empleadoId}','${fecha}','CT')">CT</button>
            <button class="btn active" style="grid-column: span 2; background:var(--accent); color:white;" onclick="window.seleccionarTipo('${empleadoId}','${fecha}','NORMAL')">Guardar normal</button>
        </div>
        <button class="btn" style="background:transparent; color:var(--text-dim); margin-top:10px;" onclick="document.getElementById('quickEditModal').remove()">Cancelar</button>
    `;
    document.body.appendChild(modal);
    window.requestAnimationFrame(() => document.getElementById('quickTurno').focus());
};

window.validarTurno = (fecha, tipo) => {
    const hoy = new Date().toISOString().split('T')[0];
    
    // Regla: No editar pasado (configurable)
    if (fecha < hoy) {
        throw new Error("No se pueden modificar turnos en fechas pasadas.");
    }
    
    const VALID_TYPES = ['NORMAL', 'VAC', 'BAJA', 'PERM', 'CT'];
    if (!VALID_TYPES.includes(tipo)) {
        throw new Error(`Tipo de turno invalido: ${tipo}`);
    }
};

window.guardarTurnoDireccion = async (empleado_id, fecha, turno, btnEl = null) => {
    const valid = ['M', 'T', 'N', 'D'];
    const turnoVal = String(turno || '').toUpperCase();
    if (!valid.includes(turnoVal)) {
        alert('Turno no valido. Usa M, T, N o D.');
        return;
    }

    const modal = document.getElementById('quickEditModal');
    try {
        window.validarTurno(fecha, 'NORMAL');
    } catch (ve) {
        alert('Validacion: ' + ve.message);
        return;
    }

    if (modal) {
        modal.style.opacity = '0.5';
        modal.style.pointerEvents = 'none';
    }

    try {
        const hotelFallback = $('#excelHotel')?.value !== 'all' ? $('#excelHotel')?.value : ($('#prevHotel')?.value || 'DEFAULT');
        await window.TurnosDB.upsertTurno(empleado_id, fecha, turnoVal, 'NORMAL', hotelFallback, null, 'DIRECCION_MODO_EXCEL');
        if (btnEl) {
            const cell = document.querySelector(`.excel-shift-cell[data-empleado-id="${CSS.escape(empleado_id)}"][data-fecha="${CSS.escape(fecha)}"]`);
            if (cell) {
                const model = excelShiftCell({ turno: turnoVal, tipo: 'NORMAL' });
                cell.className = `excel-shift-cell ${model.cls}`;
                cell.innerHTML = `<span>${escapeHtml(model.label)}</span>`;
            }
        }
        window.addLog(`Cambio de direccion guardado: ${empleado_id} ${fecha} ${turnoVal}`, 'ok');
        if (modal) modal.remove();
    } catch (e) {
        console.error('[SYNC ERROR]', e);
        window.addLog(`FALLO: ${e.message}`, 'error');
        alert('Error de red: no se pudo guardar el cambio.');
        if (modal) {
            modal.style.opacity = '1';
            modal.style.pointerEvents = 'auto';
        }
    }
};

window.seleccionarTipo = async (empleado_id, fecha, tipo) => {
    const turnoVal = document.getElementById('quickTurno')?.value || '';
    const modal = document.getElementById('quickEditModal');
    
    // 1. VALIDACIÃ“N DE NEGOCIO PREVIA
    try {
        window.validarTurno(fecha, tipo);
    } catch (ve) {
        alert("Validacion: " + ve.message);
        return;
    }
    
    // 2. GUARDAR ESTADO PREVIO PARA POSIBLE ROLLBACK
    let oldData = null;
    const empRow = window.virtualTable?.data.find(r => r.empName === empleado_id);
    const cellIdx = window.virtualTable?.columns.findIndex(c => c.dbFecha === fecha);
    if (empRow && cellIdx !== -1) {
        oldData = { ...empRow.cells[cellIdx] };
    }

    if (modal) {
        modal.style.opacity = '0.5';
        modal.style.pointerEvents = 'none';
    }
    
    try {
        const hotelFallback = $('#prevHotel')?.value || 'DEFAULT';
        
        // 3. OPTIMISTIC UI + SYNC STATE VISIBLE
        if (window.virtualTable) {
            window.virtualTable.updateRowOptimistic({ empleado_id, fecha, tipo, turno: turnoVal });
        }
        
        // 4. PERSISTENCIA CON TRAZABILIDAD (DAO INCLUYE AUTH EMAIL)
        await window.TurnosDB.upsertTurno(empleado_id, fecha, turnoVal, tipo, hotelFallback);
        
        if(modal) modal.remove();
        window.addLog(`Turno ${tipo} guardado para ${empleado_id}`, 'ok');

    } catch(e) {
        console.error("[SYNC ERROR]", e);
        
        // 5. ROLLBACK AUTOMÃTICO + ESTADO DE ERROR VISUAL
        if (window.virtualTable && oldData) {
            window.virtualTable.rollbackRow(empleado_id, fecha, oldData);
        }

        window.addLog(`FALLO: ${e.message}`, 'error');
        alert("Error de red: No se pudo sincronizar. El cambio ha sido revertido.");
        
        if(modal) {
            modal.style.opacity = '1';
            modal.style.pointerEvents = 'auto';
        }
    }
};

// ==========================================
// 4. GESTIÃ“N DE EMPLEADOS Y PERSONAL
// ==========================================
window.calculateStats = () => {
    const stats = {};
    if (!window.parsedData) return stats;
    
    window.parsedData.schedule.forEach(g => {
        g.turnos.forEach(t => {
            if (!stats[t.empleado]) {
                stats[t.empleado] = { 
                    emp: t.empleado, 
                    hotel: g.hotel, 
                    m: 0, t: 0, n: 0, v: 0, d: 0, b:0, x: 0,
                    history: []
                };
            }
            const raw = typeof t.turno === 'string' ? t.turno : (t.turno.TipoInterpretado || t.turno.TurnoOriginal || '');
            const cls = window.classify(raw);
            if (['m', 't', 'n', 'v', 'd', 'b'].includes(cls)) stats[t.empleado][cls]++;
            else stats[t.empleado].x++;

            stats[t.empleado].history.push({
                fecha: t.fecha,
                turno: raw,
                cls: cls,
                original: typeof t.turno === 'object' ? t.turno.TurnoOriginal : t.turno
            });
        });
    });

    // Ordenar historial por fecha descendente
    Object.values(stats).forEach(s => {
        s.history.sort((a,b) => b.fecha.localeCompare(a.fecha));
    });

    return stats;
};

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[ch]));
}

function initialsFor(name) {
    return String(name || '?')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map(part => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase() || '?';
}

function isVacation(row) {
    return String(row?.tipo || '').toUpperCase().startsWith('VAC');
}

function isAbsence(row) {
    const tipo = String(row?.tipo || '').toUpperCase();
    return tipo.startsWith('VAC') || tipo.startsWith('BAJA') || tipo.startsWith('PERM');
}

function shiftKey(row) {
    if (isVacation(row)) return 'v';
    const tipo = String(row?.tipo || '').toUpperCase();
    if (tipo.startsWith('BAJA') || tipo.startsWith('PERM')) return 'b';
    const turno = String(row?.turno || '').toLowerCase();
    if (turno.startsWith('m')) return 'm';
    if (turno.startsWith('t')) return 't';
    if (turno.startsWith('n')) return 'n';
    if (turno.startsWith('d')) return 'd';
    return 'x';
}

function buildPeriods(rows) {
    const sorted = [...rows].sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
    const periods = [];
    let current = null;

    sorted.forEach(row => {
        if (!current) {
            current = { start: row.fecha, end: row.fecha, days: 1, tipo: row.tipo || '', sustituto: row.sustituto || '' };
            return;
        }
        const prev = new Date(current.end + 'T12:00:00');
        const next = new Date(row.fecha + 'T12:00:00');
        const isNextDay = ((next - prev) / 86400000) === 1;
        if (isNextDay && (row.sustituto || '') === current.sustituto && (row.tipo || '') === current.tipo) {
            current.end = row.fecha;
            current.days += 1;
        } else {
            periods.push(current);
            current = { start: row.fecha, end: row.fecha, days: 1, tipo: row.tipo || '', sustituto: row.sustituto || '' };
        }
    });

    if (current) periods.push(current);
    return periods;
}

function normalizeEmployeeKey(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}

function monthLabelEs(monthKey) {
    const [y, m] = String(monthKey).split('-').map(Number);
    if (!y || !m) return '';
    return new Date(y, m - 1, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
}

function shiftMonthKey(monthKey, offset) {
    const [y, m] = String(monthKey).split('-').map(Number);
    const d = new Date(y, (m || 1) - 1 + offset, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function renderEmployeeMonthCalendar(name, monthKey) {
    const stats = window._employeeCloudStats || {};
    const s = stats[name] || { history: [] };
    const [year, month] = String(monthKey).split('-').map(Number);
    const first = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0).getDate();
    const firstDow = first.getDay() || 7;
    const byDate = new Map((s.history || []).map(h => [h.fecha, h]));
    const cells = [];

    for (let i = 1; i < firstDow; i++) cells.push('<div class="emp-day empty"></div>');
    for (let day = 1; day <= lastDay; day++) {
        const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const h = byDate.get(iso);
        const cls = h?.cls || 'empty';
        const label = h?.turno || '';
        cells.push(`
            <div class="emp-day ${cls}" title="${escapeHtml(window.TurnosDB.fmtDateLegacy(iso))}${label ? ` · ${escapeHtml(label)}` : ''}">
                <strong>${day}</strong>
            </div>
        `);
    }

    const panel = document.querySelector('#empMonthCalendar');
    if (!panel) return;
    panel.dataset.month = monthKey;
    panel.innerHTML = `
        <div class="emp-calendar-nav">
            <button type="button" onclick="window.changeEmpCalendarMonth('${name.replace(/'/g, "\\'")}', -1)">‹</button>
            <strong>${escapeHtml(monthLabelEs(monthKey))}</strong>
            <button type="button" onclick="window.changeEmpCalendarMonth('${name.replace(/'/g, "\\'")}', 1)">›</button>
        </div>
        <div class="emp-calendar-weekdays"><span>L</span><span>M</span><span>X</span><span>J</span><span>V</span><span>S</span><span>D</span></div>
        <div class="emp-mini-calendar">${cells.join('')}</div>
    `;
}

window.changeEmpCalendarMonth = (name, offset) => {
    const panel = document.querySelector('#empMonthCalendar');
    const current = panel?.dataset.month || new Date().toISOString().slice(0, 7);
    renderEmployeeMonthCalendar(name, shiftMonthKey(current, offset));
};

function weekKeyMonday(dateStr) {
    const d = new Date(`${dateStr}T12:00:00`);
    if (Number.isNaN(d.getTime())) return '';
    const day = d.getDay() || 7;
    d.setDate(d.getDate() - day + 1);
    return d.toISOString().split('T')[0];
}

function daysInclusive(start, end) {
    const a = new Date(`${start}T12:00:00`);
    const b = new Date(`${end}T12:00:00`);
    if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
    return Math.max(0, Math.floor((b - a) / 86400000) + 1);
}

function isCompleteWeekInYear(weekStart, year) {
    const start = new Date(`${weekStart}T12:00:00`);
    if (Number.isNaN(start.getTime())) return false;
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const yearStart = new Date(`${year}-01-01T12:00:00`);
    const yearEnd = new Date(`${year}-12-31T12:00:00`);
    return start >= yearStart && end <= yearEnd;
}

function vacationEntitlementForYear(profile, year, coveredDays = null) {
    const yearStart = new Date(`${year}-01-01T12:00:00`);
    const yearEnd = new Date(`${year}-12-31T12:00:00`);
    let activeEnd = yearEnd;

    if (profile?.fecha_baja) {
        const baja = new Date(`${profile.fecha_baja}T12:00:00`);
        if (!Number.isNaN(baja.getTime())) activeEnd = baja;
    }

    if (activeEnd < yearStart) return { entitlement: 0, activeDays: 0, proportional: true };
    const effectiveEnd = activeEnd > yearEnd ? yearEnd : activeEnd;
    let activeDays = coveredDays !== null
        ? Math.max(0, Number(coveredDays) || 0)
        : Math.max(0, Math.floor((effectiveEnd - yearStart) / 86400000) + 1);
    // El Excel puede empezar en el primer lunes del año (ej. 06/01),
    // pero eso no debe penalizar a empleados con cuadrante prácticamente anual.
    if (activeDays >= 360 && !profile?.fecha_baja) activeDays = 365;
    const proportional = activeDays < 365;
    const entitlement = proportional ? Math.round((44 * activeDays) / 365) : 44;
    return { entitlement, activeDays, proportional };
}

async function calculateCloudEmployeeStats(profilesList) {
    const year = new Date().getFullYear();
    const inicio = `${year}-01-01`;
    const fin = `${year}-12-31`;
    const historyStart = `${Math.max(2020, year - 8)}-01-01`;
    const rows = await window.TurnosDB.fetchRango(inicio, fin);
    const historyRows = await window.TurnosDB.fetchRango(historyStart, fin);
    const today = window.isoDate(new Date());
    const stats = {};
    const profileById = new Map(profilesList.map(p => [p.id, p]));
    const profileByNormalizedKey = new Map();
    profilesList.forEach(p => {
        if (p.id) profileByNormalizedKey.set(normalizeEmployeeKey(p.id), p);
        if (p.nombre) profileByNormalizedKey.set(normalizeEmployeeKey(p.nombre), p);
    });
    const restWeeks = {};
    const coverageByEmployeeYear = {};

    const ensure = (id, hotel = 'GENERAL') => {
        if (!stats[id]) {
            stats[id] = { emp: id, hotel, m: 0, t: 0, n: 0, v: 0, d: 0, b: 0, x: 0, total: 0, substitutions: 0, nextVacation: null, nextAbsence: null, history: [], vacationRows: [] };
        }
        return stats[id];
    };

    const registerActivity = (s, empId, key, row, options = {}) => {
        if (s[key] !== undefined) s[key] += 1;
        s.total += 1;
        const wk = weekKeyMonday(row.fecha);
        if (wk) {
            if (!restWeeks[empId]) restWeeks[empId] = {};
            if (!restWeeks[empId][wk]) restWeeks[empId][wk] = { work: 0, rest: 0 };
            if (key === 'm' || key === 't' || key === 'n') restWeeks[empId][wk].work += 1;
            if (key === 'd') restWeeks[empId][wk].rest += 1;
        }
        s.history.push({
            fecha: row.fecha,
            turno: row.turno || row.tipo || '',
            cls: key,
            hotel: row.hotel_id || '',
            sustituto: options.subFor || row.sustituto || ''
        });
    };

    const registerCoverage = (empId, row, y = null) => {
        const yearKey = y || Number(String(row.fecha || '').slice(0, 4));
        if (!yearKey || !row.fecha) return;
        if (!coverageByEmployeeYear[empId]) coverageByEmployeeYear[empId] = {};
        if (!coverageByEmployeeYear[empId][yearKey]) coverageByEmployeeYear[empId][yearKey] = new Set();
        coverageByEmployeeYear[empId][yearKey].add(row.fecha);
    };

    profilesList.forEach(p => ensure(p.id, p.hotel_id || 'GENERAL'));

    rows.forEach(row => {
        if (!row.empleado_id) return;
        const profile = profileById.get(row.empleado_id) || profileByNormalizedKey.get(normalizeEmployeeKey(row.empleado_id));
        const empId = profile?.id || row.empleado_id;
        const computes = employeeComputesForStats(profile);
        const s = ensure(empId, row.hotel_id || 'GENERAL');
        s.hotel = row.hotel_id || s.hotel;
        const key = shiftKey(row);
        if (computes) {
            registerActivity(s, empId, key, row);
            if (isVacation(row)) s.vacationRows.push(row);
            if (isAbsence(row) && row.fecha >= today && (!s.nextAbsence || row.fecha < s.nextAbsence.fecha)) s.nextAbsence = row;
            if (isVacation(row) && row.fecha >= today && (!s.nextVacation || row.fecha < s.nextVacation.fecha)) s.nextVacation = row;
        }

        if (row.sustituto) {
            const subProfile = profileByNormalizedKey.get(normalizeEmployeeKey(row.sustituto));
            const subId = subProfile?.id || row.sustituto;
            const sub = ensure(subId, row.hotel_id || 'GENERAL');
            sub.substitutions += 1;
            if (employeeComputesForStats(subProfile)) {
                const subKey = shiftKey({ ...row, tipo: 'NORMAL' });
                if (subKey === 'm' || subKey === 't' || subKey === 'n' || subKey === 'd') {
                    registerActivity(sub, subId, subKey, row, { subFor: row.empleado_id });
                }
            }
        }
    });

    const vacationByEmployeeYear = {};
    historyRows.forEach(row => {
        if (!row.empleado_id) return;
        const profile = profileById.get(row.empleado_id) || profileByNormalizedKey.get(normalizeEmployeeKey(row.empleado_id));
        const empId = profile?.id || row.empleado_id;
        const y = Number(String(row.fecha || '').slice(0, 4));
        if (!y) return;
        if (employeeComputesForStats(profile)) {
            const key = shiftKey(row);
            if (key === 'm' || key === 't' || key === 'n' || key === 'd') {
                registerCoverage(empId, row, y);
            }
        }
        if (row.sustituto) {
            const subProfile = profileByNormalizedKey.get(normalizeEmployeeKey(row.sustituto));
            const subId = subProfile?.id || row.sustituto;
            if (employeeComputesForStats(subProfile)) {
                const subKey = shiftKey({ ...row, tipo: 'NORMAL' });
                if (subKey === 'm' || subKey === 't' || subKey === 'n' || subKey === 'd') {
                    registerCoverage(subId, row, y);
                }
            }
        }
        if (!isVacation(row)) return;
        if (!employeeComputesForVacationCredit(profile)) return;
        if (!vacationByEmployeeYear[empId]) vacationByEmployeeYear[empId] = {};
        vacationByEmployeeYear[empId][y] = (vacationByEmployeeYear[empId][y] || 0) + 1;
    });

    Object.values(stats).forEach(s => {
        const profile = profileById.get(s.emp);
        const computes = employeeComputesForStats(profile);
        const computesVacationCredit = employeeComputesForVacationCredit(profile);
        s.history.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
        s.vacationPeriods = buildPeriods(s.vacationRows);
        s.computes = computes;
        s.vacationBalance = null;
        s.vacationEntitlement = null;
        s.restBalance = null;
        const coverageForCurrentYear = coverageByEmployeeYear[s.emp]?.[year];
        const coveredDaysCurrentYear = coverageForCurrentYear ? coverageForCurrentYear.size : null;
        if (computes) {
            s.vacationEntitlement = vacationEntitlementForYear(profile, year, coveredDaysCurrentYear);
        }
        if (computesVacationCredit) {
            const usedByYear = vacationByEmployeeYear[s.emp] || {};
            usedByYear[year] = s.v;
            const years = Object.keys(usedByYear).map(Number).filter(Boolean);
            const firstYear = years.length ? Math.min(...years, year) : year;
            let carry = 0;
            for (let y = firstYear; y <= year; y++) {
                const coverage = coverageByEmployeeYear[s.emp]?.[y];
                const coveredDays = coverage ? coverage.size : null;
                const entitlementInfo = vacationEntitlementForYear(profile, y, coveredDays);
                const allowance = entitlementInfo.entitlement + carry;
                const used = usedByYear[y] || 0;
                const adjustment = y === year ? Number(profile?.ajuste_vacaciones_dias || 0) || 0 : 0;
                const balance = allowance - used + adjustment;
                if (y === year) {
                    s.vacationBalance = {
                        year: y,
                        base: entitlementInfo.entitlement,
                        carry,
                        allowance,
                        used,
                        adjustment,
                        paid: !!profile?.vacaciones_regularizadas_pagadas,
                        balance,
                        nextAllowance: 44 + balance,
                        activeDays: entitlementInfo.activeDays,
                        proportional: entitlementInfo.proportional
                    };
                }
                carry = balance;
            }

        }
        if (computes) {
            const weeks = Object.entries(restWeeks[s.emp] || {})
                .filter(([weekStart, w]) => isCompleteWeekInYear(weekStart, year) && w.work >= 5)
                .map(([, w]) => w);
            const expected = weeks.reduce((sum, w) => sum + Math.max(0, 7 - w.work), 0);
            const used = weeks.reduce((sum, w) => sum + w.rest, 0);
            s.restBalance = { weeks: weeks.length, expected, used, balance: used - expected };
        }
    });

    return stats;
}

function employeeTypeLabel(value) {
    const key = String(value || 'fijo').toLowerCase().replace(/\s+/g, '_');
    const labels = {
        fijo: 'Fijo',
        sustituto: 'Sustituto',
        tiempo_partido: 'Tiempo partido',
        apoyo: 'Apoyo',
        apollo: 'Apoyo',
        ocasional: 'Ocasional',
        eventual: 'Ocasional'
    };
    return labels[key] || value || 'Fijo';
}

function employeeTypeKey(value) {
    return String(value || 'fijo').toLowerCase().replace(/\s+/g, '_');
}

function employeeComputesForStats(profile) {
    const key = employeeTypeKey(profile?.tipo_personal || profile?.contrato);
    return key !== 'ocasional' && key !== 'eventual' && key !== 'apoyo' && key !== 'apollo';
}

function employeeComputesForVacationCredit(profile) {
    const key = employeeTypeKey(profile?.tipo_personal || profile?.contrato);
    return employeeComputesForStats(profile) && key !== 'sustituto';
}

function employeeVisibleInMainList(profile) {
    if (!profile) return true;
    if (employeeStatusLabel(profile.estado_empresa, profile.activo) === 'Baja empresa') return false;
    const key = employeeTypeKey(profile.tipo_personal || profile.contrato);
    return key === 'fijo' || key === 'sustituto';
}

function employeeVisibleInOtherList(profile) {
    if (!profile) return false;
    if (employeeStatusLabel(profile.estado_empresa, profile.activo) === 'Baja empresa') return false;
    return !employeeVisibleInMainList(profile);
}

function employeeStatusLabel(value, activeFlag) {
    if (String(value || '').toLowerCase() === 'baja_empresa' || activeFlag === false) return 'Baja empresa';
    return 'Activo';
}

function employeeStatusClass(value, activeFlag) {
    return employeeStatusLabel(value, activeFlag) === 'Baja empresa' ? 'off' : 'on';
}

window.populateEmployees = async () => {
    const area = $('#employeesContent');
    if (!area) return;
    area.innerHTML = `<div style="padding:4rem; text-align:center; opacity:0.5;">Cargando fichas desde Supabase...</div>`;

    const profilesList = await window.TurnosDB.getEmpleados();
    const stats = await calculateCloudEmployeeStats(profilesList);
    window._employeeCloudStats = stats;

    const hotelSet = new Set(Object.values(stats).map(s => s.hotel));
    profilesList.forEach(p => { if (p.hotel_id) hotelSet.add(p.hotel_id); });
    const hotels = Array.from(hotelSet).filter(Boolean).sort();

    if (profilesList.length === 0 && hotels.length === 0) {
        area.innerHTML = '<div style="padding:100px; text-align:center; opacity:0.5;">No hay empleados registrados. Importa un Excel para crearlos automaticamente.</div>';
        return;
    }

    const totalEmployees = profilesList.length || Object.keys(stats).length;
    const pendingVac = Object.values(stats).filter(s => s.nextVacation).length;
    const renderEmployeeRow = (p, hotel) => {
        const s = stats[p.id] || { m:0, t:0, n:0, v:0, d:0, b:0, total:0, substitutions:0, hotel, nextVacation:null, nextAbsence:null };
        const displayName = p.nombre || p.id;
        const initials = initialsFor(displayName);
        const hue = Math.abs(displayName.length * 137.5) % 360;
        const nextText = s.nextVacation ? `Vac. ${window.TurnosDB.fmtDateLegacy(s.nextVacation.fecha)}` : (s.nextAbsence ? `Aus. ${window.TurnosDB.fmtDateLegacy(s.nextAbsence.fecha)}` : 'Sin pendientes');
        const statusClass = s.nextVacation ? 'vac' : (s.nextAbsence ? 'warn' : 'ok');
        const typeText = employeeTypeLabel(p.tipo_personal || p.contrato);
        const companyStatus = employeeStatusLabel(p.estado_empresa, p.activo);
        const companyClass = employeeStatusClass(p.estado_empresa, p.activo);
        const vacBalanceText = s.vacationBalance ? `${s.vacationBalance.balance >= 0 ? '+' : ''}${s.vacationBalance.balance}` : 'No computa';

        return `
        <button class="emp-line-row" type="button" data-emp-name="${escapeHtml(displayName.toLowerCase())}" data-emp-hotel="${escapeHtml(hotel)}" onclick="window.openEmpDrawer('${p.id.replace(/'/g, "\\'")}')">
            <span class="el-person">
                <span class="el-avatar" style="background:hsl(${hue}, 80%, 94%); color:hsl(${hue}, 70%, 30%)">${escapeHtml(initials)}</span>
                <span>
                    <strong class="el-name">${escapeHtml(displayName)}</strong>
                    <small class="el-meta">${escapeHtml(p.puesto || p.categoria || 'Sin puesto definido')} Â· ID ${escapeHtml(p.id)}</small>
                </span>
            </span>
            <span class="el-pill type">${escapeHtml(typeText)}</span>
            <span class="el-pill ${companyClass}">${escapeHtml(companyStatus)}</span>
            <span class="el-pill ${statusClass}">${escapeHtml(nextText)}</span>
            <span class="el-metrics"><b>M</b>${s.m}<b>T</b>${s.t}<b>N</b>${s.n}<b>V</b>${s.v}</span>
            <span class="el-number">${s.substitutions || 0}</span>
            <span class="el-number">${escapeHtml(vacBalanceText)}</span>
        </button>`;
    };

    const hotelSections = hotels.map(hotel => {
        const empsInHotel = profilesList.filter(p => p.hotel_id === hotel && employeeVisibleInMainList(p));
        Object.values(stats).forEach(s => {
            const profile = profilesList.find(p => p.id === s.emp);
            if (profile && !employeeVisibleInMainList(profile)) return;
            if (s.hotel === hotel && !empsInHotel.find(p => p.id === s.emp)) {
                empsInHotel.push({ id: s.emp, nombre: s.emp, hotel_id: hotel, orden: 999 });
            }
        });

        const rows = empsInHotel.sort((a, b) => (a.orden || 999) - (b.orden || 999)).map(p => renderEmployeeRow(p, hotel)).join('');

        return `
        <div class="emp-hotel-section" data-hotel-section="${escapeHtml(hotel)}">
            <div class="section-title-premium">
                <span class="stp-icon">Hotel</span>
                <h2>${escapeHtml(hotel)}</h2>
                <span class="stp-count">${empsInHotel.length} fichas</span>
            </div>
            <div class="employees-line-table">
                <div class="emp-line-header">
                    <span>Empleado</span>
                    <span>Tipo</span>
                    <span>Empresa</span>
                    <span>Proxima salida</span>
                    <span>Turnos año</span>
                    <span>Sust.</span>
                    <span>Saldo vac.</span>
                </div>
                ${rows}
            </div>
        </div>`;
    }).join('');

    const otherEmployees = profilesList
        .filter(employeeVisibleInOtherList)
        .sort((a, b) => String(a.tipo_personal || '').localeCompare(String(b.tipo_personal || '')) || (a.orden || 999) - (b.orden || 999));
    const otherSection = otherEmployees.length ? `
        <div class="emp-hotel-section emp-other-section" data-hotel-section="otros">
            <div class="section-title-premium">
                <span class="stp-icon">Otros</span>
                <h2>Personal no operativo fijo</h2>
                <span class="stp-count">${otherEmployees.length} fichas</span>
            </div>
            <div class="employees-line-table">
                <div class="emp-line-header">
                    <span>Empleado</span>
                    <span>Tipo</span>
                    <span>Empresa</span>
                    <span>Proxima salida</span>
                    <span>Turnos año</span>
                    <span>Sust.</span>
                    <span>Saldo vac.</span>
                </div>
                ${otherEmployees.map(p => renderEmployeeRow(p, p.hotel_id || 'Otros')).join('')}
            </div>
        </div>
    ` : '';

    area.innerHTML = `
        <div class="employees-dashboard">
            <div class="ed-summary">
                <div><span>Fichas</span><strong>${totalEmployees}</strong></div>
                <div><span>Hoteles</span><strong>${hotels.length}</strong></div>
                <div><span>Vacaciones proximas</span><strong>${pendingVac}</strong></div>
            </div>
            <div class="ed-tools">
                <input id="empSearch" type="search" placeholder="Buscar empleado..." autocomplete="off">
                <select id="empHotelFilter">
                    <option value="all">Todos los hoteles</option>
                    ${hotels.map(h => `<option value="${escapeHtml(h)}">${escapeHtml(h)}</option>`).join('')}
                </select>
            </div>
        </div>
        ${hotelSections}
        ${otherSection}
    `;

    const applyEmployeeFilters = () => {
        const q = ($('#empSearch')?.value || '').trim().toLowerCase();
        const hotel = $('#empHotelFilter')?.value || 'all';
        document.querySelectorAll('.emp-line-row').forEach(card => {
            const matchesName = !q || card.dataset.empName.includes(q);
            const matchesHotel = hotel === 'all' || card.dataset.empHotel === hotel;
            card.style.display = matchesName && matchesHotel ? '' : 'none';
        });
        document.querySelectorAll('[data-hotel-section]').forEach(section => {
            const visible = Array.from(section.querySelectorAll('.emp-line-row')).some(card => card.style.display !== 'none');
            section.style.display = visible ? '' : 'none';
        });
    };
    $('#empSearch')?.addEventListener('input', applyEmployeeFilters);
    $('#empHotelFilter')?.addEventListener('change', applyEmployeeFilters);
};
window.openEmpDrawer = async (name) => {
    const drawer = $('#empDrawer');
    const body = $('#drawerBody');
    if (!drawer || !body) return;
    
    drawer.classList.add('open');
    body.innerHTML = `<div style="padding:4rem; text-align:center; opacity:0.5;">Cargando ficha...</div>`;

    const allStats = window._employeeCloudStats || window.calculateStats();
    const s = allStats[name] || { m:0, t:0, n:0, v:0, b:0, d:0, hotel: 'GENERAL', history: [] };
    
    // FETCH DESDE NUBE
    const employees = await window.TurnosDB.getEmpleados();
    const hotelsList = await window.TurnosDB.getHotels();
    const p = employees.find(e => e.id === name) || { id: name };
    
    const initials = name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase();
    const totalWorking = s.m + s.t + s.n;
    const nextVacationText = s.nextVacation ? window.TurnosDB.fmtDateLegacy(s.nextVacation.fecha) : 'Sin vacaciones pendientes';
    const nextAbsenceText = s.nextAbsence ? window.TurnosDB.fmtDateLegacy(s.nextAbsence.fecha) : 'Sin ausencias pendientes';
    const vacationBalanceText = s.vacationBalance ? `${s.vacationBalance.balance >= 0 ? '+' : ''}${s.vacationBalance.balance} dias` : 'No computa';
    const vacationNextYearText = s.vacationBalance ? `${s.vacationBalance.nextAllowance} dias proximo ano` : 'Sin calculo';
    const entitlementInfoForDisplay = s.vacationEntitlement || vacationEntitlementForYear(p, new Date().getFullYear());
    const vacationEntitlementText = s.vacationBalance
        ? `${s.vacationBalance.base} dias${s.vacationBalance.proportional ? ` (${s.vacationBalance.activeDays} trabajados)` : ''}`
        : `${entitlementInfoForDisplay.entitlement} dias${entitlementInfoForDisplay.proportional ? ` (${entitlementInfoForDisplay.activeDays} trabajados)` : ''}`;
    const vacationAdjustmentText = s.vacationBalance
        ? `${s.vacationBalance.adjustment >= 0 ? '+' : ''}${s.vacationBalance.adjustment} dias${s.vacationBalance.paid ? ' pagados' : ''}`
        : 'No computa';
    const restBalanceText = s.restBalance ? `${s.restBalance.balance >= 0 ? '+' : ''}${s.restBalance.balance} dias` : 'No computa';
    const displayName = p.nombre || name;
    const typeValue = String(p.tipo_personal || p.contrato || 'fijo').toLowerCase().replace(/\s+/g, '_');
    const statusValue = (p.estado_empresa || (p.activo === false ? 'baja_empresa' : 'activo'));
    const companyStatus = employeeStatusLabel(statusValue, p.activo);
    const companyClass = employeeStatusClass(statusValue, p.activo);
    const safeId = String(name).replace(/'/g, "\\'");
    const assignedHotels = new Set(String(p.hoteles_asignados || p.hotel_id || s.hotel || '').split(',').map(h => h.trim()).filter(Boolean));
    const primaryHotel = p.hotel_id || s.hotel || hotelsList[0] || '';
    const computesStats = employeeComputesForStats(p);
    const computesVacationCredit = employeeComputesForVacationCredit(p);
    const isSubstitute = typeValue === 'sustituto';
    const isFixed = typeValue === 'fijo';
    const quickCards = [];
    if (!isSubstitute) quickCards.push(`<div><span>Proxima vacacion</span><strong>${nextVacationText}</strong></div>`);
    if (!isFixed) quickCards.push(`<div><span>Sustituciones</span><strong>${s.substitutions || 0}</strong></div>`);
    if (computesVacationCredit) quickCards.push(`<div><span>Saldo vacaciones</span><strong>${escapeHtml(vacationBalanceText)}</strong></div>`);
    if (computesVacationCredit || isSubstitute) quickCards.push(`<div><span>Derecho vacaciones</span><strong>${escapeHtml(vacationEntitlementText)}</strong></div>`);
    if (computesVacationCredit) quickCards.push(`<div><span>Regularizacion</span><strong>${escapeHtml(vacationAdjustmentText)}</strong></div>`);
    if (computesVacationCredit) quickCards.push(`<div><span>Credito siguiente</span><strong>${escapeHtml(vacationNextYearText)}</strong></div>`);
    if (s.restBalance) quickCards.push(`<div><span>Saldo descansos</span><strong>${escapeHtml(restBalanceText)}</strong></div>`);
    const activityHtml = computesStats ? `
        <div class="emp-quick-strip">
            ${quickCards.join('')}
        </div>

        <div class="drawer-section-title">RESUMEN DE ACTIVIDAD (AÑO ACTUAL)</div>
        <div class="drawer-stats-grid-premium">
            <div class="stat-premium">
                <span class="sp-label">Mañanas</span>
                <span class="sp-value color-m">${s.m}</span>
                <div class="sp-bar"><div class="sp-bar-fill color-m" style="width:${Math.min(100, (s.m/30)*100)}%"></div></div>
            </div>
            <div class="stat-premium">
                <span class="sp-label">Tardes</span>
                <span class="sp-value color-t">${s.t}</span>
                <div class="sp-bar"><div class="sp-bar-fill color-t" style="width:${Math.min(100, (s.t/30)*100)}%"></div></div>
            </div>
            <div class="stat-premium">
                <span class="sp-label">Noches</span>
                <span class="sp-value color-n">${s.n}</span>
                <div class="sp-bar"><div class="sp-bar-fill color-n" style="width:${Math.min(100, (s.n/30)*100)}%"></div></div>
            </div>
            <div class="stat-premium">
                <span class="sp-label">Vacaciones</span>
                <span class="sp-value color-v">${s.v}</span>
                <div class="sp-bar"><div class="sp-bar-fill color-v" style="width:${Math.min(100, (s.v/30)*100)}%"></div></div>
            </div>
            <div class="stat-premium">
                <span class="sp-label">Bajas</span>
                <span class="sp-value color-b">${s.b}</span>
                <div class="sp-bar"><div class="sp-bar-fill color-b" style="width:${Math.min(100, (s.b/10)*100)}%"></div></div>
            </div>
            <div class="stat-premium">
                <span class="sp-label">Descansos</span>
                <span class="sp-value color-d">${s.d}</span>
                <div class="sp-bar"><div class="sp-bar-fill color-d" style="width:${Math.min(100, (s.d/30)*100)}%"></div></div>
            </div>
        </div>
    ` : '';
    const calendarHtml = computesStats ? `
        <div class="emp-calendar-panel">
            <div class="drawer-section-title compact">CALENDARIO MENSUAL</div>
            <div id="empMonthCalendar" data-month="${new Date().toISOString().slice(0, 7)}"></div>
            <div class="emp-calendar-legend">
                <span><i class="m"></i>M</span>
                <span><i class="t"></i>T</span>
                <span><i class="n"></i>N</span>
                <span><i class="v"></i>V</span>
                <span><i class="b"></i>B</span>
                <span><i class="d"></i>D</span>
            </div>
        </div>
    ` : '';
    const vacationRegularizationFields = computesVacationCredit ? `
                <div>
                    <span>Regularizacion vacaciones</span><br>
                    <input type="number" class="edit-input" value="${escapeHtml(p.ajuste_vacaciones_dias || 0)}" placeholder="Ej: -3 o 2" onchange="window.setEmpDraftField('${safeId}', 'ajuste_vacaciones_dias', this.value)">
                </div>
                <div>
                    <span>Vacaciones pagadas</span><br>
                    <label class="emp-checkline"><input type="checkbox" ${p.vacaciones_regularizadas_pagadas ? 'checked' : ''} onchange="window.setEmpDraftField('${safeId}', 'vacaciones_regularizadas_pagadas', this.checked)"> Regularizacion pagada</label>
                </div>
    ` : '';

    body.innerHTML = `
        <div class="drawer-header">
            <div class="emp-avatar large" style="--emp-hue:${Math.abs(name.length * 17) % 360}">${initials}</div>
            <div class="drawer-title-group">
                <h2 style="margin:0; font-size:1.6rem; letter-spacing:-0.02em;">${escapeHtml(displayName)}</h2>
                <div style="display:flex; gap:6px; margin-top:4px;">
                    <span class="status-badge" style="background:var(--accent-dim); color:var(--accent); border:none; font-size:0.7rem;">${escapeHtml(s.hotel)}</span>
                    <span class="status-badge" style="background:var(--success-dim); color:var(--success); border:none; font-size:0.7rem;">${escapeHtml(employeeTypeLabel(typeValue))}</span>
                    <span class="status-badge ${companyClass}" style="font-size:0.7rem;">${escapeHtml(companyStatus)}</span>
                </div>
            </div>
        </div>

        ${activityHtml}

        <div class="emp-ficha-split ${computesStats ? '' : 'minimal'}">
        <div class="glass emp-ficha-card" style="padding:1.2rem; margin-top:1.5rem; border-color:rgba(0,0,0,0.05); background:#fff;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px solid var(--border); padding-bottom:8px;">
                <h4 style="margin:0; color:var(--accent); font-size:0.8rem; text-transform:uppercase; letter-spacing:0.05em;">Ficha de empleado</h4>
                <span style="font-size:0.75rem; color:var(--text-dim);">${totalWorking} servicios totales</span>
            </div>
            <div class="emp-detail-grid">
                <div>
                    <span>Nombre</span><br>
                    <input type="text" class="edit-input" value="${escapeHtml(displayName)}" placeholder="Nombre del empleado" onchange="window.setEmpDraftField('${safeId}', 'nombre', this.value)">
                </div>
                <div>
                    <span>Tipo de personal</span><br>
                    <select class="edit-input" onchange="window.setEmpDraftField('${safeId}', 'tipo_personal', this.value)">
                        <option value="fijo" ${typeValue === 'fijo' ? 'selected' : ''}>Fijo</option>
                        <option value="sustituto" ${typeValue === 'sustituto' ? 'selected' : ''}>Sustituto</option>
                        <option value="tiempo_partido" ${typeValue === 'tiempo_partido' ? 'selected' : ''}>Tiempo partido</option>
                        <option value="apoyo" ${typeValue === 'apoyo' || typeValue === 'apollo' ? 'selected' : ''}>Apoyo</option>
                        <option value="ocasional" ${typeValue === 'ocasional' || typeValue === 'eventual' ? 'selected' : ''}>Ocasional</option>
                    </select>
                </div>
                <div>
                    <span>Estado en empresa</span><br>
                    <select class="edit-input" onchange="window.setEmpDraftField('${safeId}', 'estado_empresa', this.value)">
                        <option value="activo" ${statusValue !== 'baja_empresa' ? 'selected' : ''}>Activo</option>
                        <option value="baja_empresa" ${statusValue === 'baja_empresa' ? 'selected' : ''}>Baja en la empresa</option>
                    </select>
                </div>
                <div>
                    <span>Hotel principal</span><br>
                    <select class="edit-input" onchange="window.setEmpDraftField('${safeId}', 'hotel_id', this.value)">
                        ${hotelsList.map(h => `<option value="${escapeHtml(h)}" ${h === primaryHotel ? 'selected' : ''}>${escapeHtml(h)}</option>`).join('')}
                    </select>
                </div>
                <div class="emp-detail-hotels">
                    <span>Hoteles asignados</span>
                    <div class="emp-hotels-grid">
                        ${hotelsList.map(h => {
                            const hotelSafe = h.replace(/'/g, "\\'");
                            return `<label><input type="checkbox" ${assignedHotels.has(h) ? 'checked' : ''} onchange="window.toggleEmpHotelDraft('${safeId}', '${hotelSafe}', this.checked)"> ${escapeHtml(h)}</label>`;
                        }).join('')}
                    </div>
                </div>
                <div>
                    <span style="color:var(--text-dim); font-size:0.75rem;">Puesto</span><br>
                    <input type="text" class="edit-input" value="${escapeHtml(p.puesto || '')}" placeholder="Ej: Correturnos" onchange="window.setEmpDraftField('${safeId}', 'puesto', this.value)">
                </div>
                <div>
                    <span>Telefono</span><br>
                    <input type="tel" class="edit-input" value="${escapeHtml(p.telefono || '')}" placeholder="Telefono" onchange="window.setEmpDraftField('${safeId}', 'telefono', this.value)">
                </div>
                <div>
                    <span>Email</span><br>
                    <input type="email" class="edit-input" value="${escapeHtml(p.email || '')}" placeholder="correo@empresa.com" onchange="window.setEmpDraftField('${safeId}', 'email', this.value)">
                </div>
                <div>
                    <span>Fecha baja</span><br>
                    <input type="date" class="edit-input" value="${escapeHtml(p.fecha_baja || '')}" onchange="window.setEmpDraftField('${safeId}', 'fecha_baja', this.value)">
                </div>
                <div>
                    <span>Motivo baja</span><br>
                    <input type="text" class="edit-input" value="${escapeHtml(p.motivo_baja || '')}" placeholder="Opcional" onchange="window.setEmpDraftField('${safeId}', 'motivo_baja', this.value)">
                </div>
                ${vacationRegularizationFields}
                <div class="emp-detail-full">
                    <span>Observaciones</span><br>
                    <textarea class="edit-input emp-notes" placeholder="Notas internas de la ficha" onchange="window.setEmpDraftField('${safeId}', 'observaciones', this.value)">${escapeHtml(p.observaciones || '')}</textarea>
                </div></div>
            <div class="emp-save-row">
                <span id="save-indicator">Sin cambios pendientes</span>
                <button type="button" class="emp-save-btn" onclick="window.saveEmpFicha('${safeId}')">Guardar ficha en nube</button>
            </div>
        </div>

        ${calendarHtml}
        </div>
    `;
    if (computesStats) renderEmployeeMonthCalendar(name, new Date().toISOString().slice(0, 7));
};

window._empDrafts = window._empDrafts || {};

window.setEmpDraftField = (name, field, value) => {
    if (!window._empDrafts[name]) window._empDrafts[name] = { id: name };
    window._empDrafts[name][field] = value;
    if (field === 'estado_empresa') {
        window._empDrafts[name].activo = value !== 'baja_empresa';
    }

    const indicator = $('#save-indicator');
    if (indicator) {
        indicator.textContent = 'Cambios pendientes de guardar';
        indicator.className = 'pending';
    }
};

window.toggleEmpHotelDraft = (name, hotel, checked) => {
    if (!window._empDrafts[name]) window._empDrafts[name] = { id: name };
    const current = new Set(String(window._empDrafts[name].hoteles_asignados || '').split(',').map(h => h.trim()).filter(Boolean));

    if (!current.size) {
        document.querySelectorAll('.emp-hotels-grid input:checked').forEach(input => {
            const label = input.closest('label');
            const value = label ? label.textContent.trim() : '';
            if (value) current.add(value);
        });
    }

    if (checked) current.add(hotel);
    else current.delete(hotel);

    const list = Array.from(current);
    window._empDrafts[name].hoteles_asignados = list.join(', ');
    if (list.length && !window._empDrafts[name].hotel_id) {
        window._empDrafts[name].hotel_id = list[0];
    }

    const indicator = $('#save-indicator');
    if (indicator) {
        indicator.textContent = 'Cambios pendientes de guardar';
        indicator.className = 'pending';
    }
};

window.saveEmpFicha = async (name) => {
    try {
        const draft = window._empDrafts[name] || { id: name };
        const payload = { ...draft };
        await window.TurnosDB.upsertEmpleado(payload);

        delete window._empDrafts[name];
        const indicator = $('#save-indicator');
        if (indicator) {
            indicator.textContent = 'Guardado en Supabase';
            indicator.className = 'saved';
        }
        await window.populateEmployees();
        window.closeEmpDrawer();
    } catch (e) {
        console.error("Error guardando ficha:", e);
        const msg = e?.message || e?.details || "Error al guardar en la nube.";
        const indicator = $('#save-indicator');
        if (indicator) {
            indicator.textContent = msg;
            indicator.className = 'error';
        }
    }
};

window.saveEmpField = async (name, field, value) => {
    try {
        const payload = { id: name };
        payload[field] = value;
        if (field === 'estado_empresa') {
            payload.activo = value !== 'baja_empresa';
        }
        await window.TurnosDB.upsertEmpleado(payload);

        // Mostrar feedback visual
        const indicator = $('#save-indicator');
        if (indicator) {
            indicator.style.display = 'block';
            setTimeout(() => { if (indicator) indicator.style.display = 'none'; }, 2000);
        }
    } catch (e) {
        console.error("Error guardando ficha:", e);
        alert(e.message || "Error al guardar en la nube.");
    }
};

window.closeEmpDrawer = () => { $('#empDrawer').classList.remove('open'); };

// ==========================================
// 5. ARRANQUE E INTERACCIONES
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    window.addLog('Iniciando TurnosWeb Admin...');
    
    // Theme initialization
    const savedTheme = localStorage.getItem('turnosweb_theme') || 'light';
    if (savedTheme === 'light') {
        document.body.classList.add('light-mode');
    } else {
        document.body.classList.remove('light-mode');
    }

    // --- SISTEMA DE FUENTE DE VERDAD (SUPABASE CLOUD) ---
    window.addLog('Conectando a Fuente de Verdad (Supabase Cloud)...');
    
    // InicializaciÃ³n de UI y Datos
    (async function init() {
        // Forzar lunes como primer dÃ­a de la semana globalmente
        if (window.flatpickr && flatpickr.l10ns.es) {
            flatpickr.localize(flatpickr.l10ns.es);
            flatpickr.l10ns.es.firstDayOfWeek = 1;
        }

        // Asegurar valores iniciales en los selectores de fecha
        if ($('#prevMonth') && !$('#prevMonth').value) {
            const now = new Date();
            $('#prevMonth').value = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
        }
        if ($('#prevWeekDate') && !$('#prevWeekDate').value) {
            $('#prevWeekDate').value = window.isoDate(new Date());
        }
        
        // Carga inicial de componentes
        await window.populateHotels();
        window.populatePreview();
        window.populateEmployees();
        window.updateDashboardStats();
        if (window.refreshBadges) window.refreshBadges();
        
        window.addLog(`Sistema listo y sincronizado.`, 'ok');
        
        // Info en Dashboard
        try {
            const homeLog = $('#homeLogBody');
            if (homeLog && !window.homeLogInit) {
                const info = document.createElement('div');
                info.style.padding = '10px';
                info.innerHTML = `
                    <div style="font-size:0.8rem; font-weight:900; color:var(--accent); margin-bottom:5px;">âœ“ BASE DE DATOS ACTIVA</div>
                    <div style="font-size:0.75rem; opacity:0.7;">Origen: Supabase Cloud</div>
                `;
                homeLog.prepend(info);
                window.homeLogInit = true;
            }
        } catch(e) {}
    })();

    const dropZone = $('#drop-zone');
    const fileIn = $('#fileInput');

    if (dropZone) {
        dropZone.onclick = () => fileIn.click();
        dropZone.ondragover = (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); };
        dropZone.ondragleave = () => dropZone.classList.remove('drag-over');
        dropZone.ondrop = (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            handleFile(e.dataTransfer.files[0]);
        };
    }

    // Refresh badges every 60 seconds
    setInterval(() => { if (window.refreshBadges) window.refreshBadges(); }, 60000);

// ==========================================
// 5. BACKUP Y CONFIGURACIÃ“N (RESTAURACIÃ“N)
// ==========================================
window.exportConfig = () => {
    const data = {
        main: JSON.parse(localStorage.getItem('turnosweb_admin_data') || 'null'),
        profiles: JSON.parse(localStorage.getItem('turnosweb_emp_profiles') || 'null'),
        export_date: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `turnosweb_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    window.addLog('Backup generado y descargado.', 'ok');
};

window.importConfig = () => {
    const file = $('#configImport').files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (data.main) localStorage.setItem('turnosweb_admin_data', JSON.stringify(data.main));
            if (data.profiles) localStorage.setItem('turnosweb_emp_profiles', JSON.stringify(data.profiles));
            window.addLog('ConfiguraciÃ³n restaurada con Ã©xito.', 'ok');
            location.reload();
        } catch (err) {
            window.addLog('Error al importar: ' + err.message, 'err');
        }
    };
    reader.readAsText(file);
};

if (fileIn) fileIn.onchange = (e) => handleFile(e.target.files[0]);
});

function handleFile(file) {
    if (!file) return;
    window.addLog(`Leyendo: ${file.name}`);
    const r = new FileReader();
    r.onload = (ev) => {
        try {
            const wb = XLSX.read(new Uint8Array(ev.target.result), { type: 'array', cellDates: true });
            window.processWorkbook(wb);
        } catch (e) {
            window.addLog('Error: ' + e.message, 'err');
        }
    };
    r.readAsArrayBuffer(file);
}

// ==========================================
// 10. MODO EXCEL (RAW DATA INSPECTOR)
// ==========================================
const EXCEL_SOURCE_FILE = 'Plantilla%20Cuadrante%20Turnos%20v.8.0.xlsx';
const EXCEL_HOTEL_SHEETS = ['Cumbria Spa&Hotel', 'Sercotel Guadiana'];
const EXCEL_DAY_COLUMNS = [
    { title: 'lun', subtitle: 'Lunes', offset: 0 },
    { title: 'mar', subtitle: 'Martes', offset: 1 },
    { title: 'mie', subtitle: 'Miercoles', offset: 2 },
    { title: 'jue', subtitle: 'Jueves', offset: 3 },
    { title: 'vie', subtitle: 'Viernes', offset: 4 },
    { title: 'sab', subtitle: 'Sabado', offset: 5 },
    { title: 'dom', subtitle: 'Domingo', offset: 6 }
];

function excelCellDate(value) {
    if (!value) return null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) return window.isoDate(value);
    if (typeof value === 'number') {
        const d = new Date(Math.round((value - 25569) * 86400 * 1000));
        return window.isoDate(d);
    }
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : window.isoDate(d);
}

function monthBounds(monthStr) {
    const [y, m] = monthStr.split('-').map(Number);
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0);
    return { start: window.isoDate(start), end: window.isoDate(end) };
}

function shiftFromExcel(value) {
    const s = String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    if (!s) return '';
    if (s.startsWith('m') || s.includes('manana')) return 'M';
    if (s.startsWith('t') || s.includes('tarde')) return 'T';
    if (s.startsWith('n') || s.includes('noche')) return 'N';
    if (s.startsWith('d') || s.includes('descanso')) return 'D';
    return String(value || '').trim();
}

function excelShiftCell(cell) {
    const shift = String(cell.turno || '').toUpperCase();
    if (shift === 'M') return { cls: 'm', label: 'Mañana' };
    if (shift === 'T') return { cls: 't', label: 'Tarde' };
    if (shift === 'N') return { cls: 'n', label: 'Noche' };
    if (shift === 'D') return { cls: 'd', label: 'Descanso' };
    if (shift === 'V') return { cls: 'empty', label: '' };
    return { cls: 'empty', label: '' };
}

function renderExcelStaticTable(groups, dayColumns) {
    const monthNamesShort = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    const dayHead = (weekStart) => dayColumns.map(day => {
        const iso = window.addDays(weekStart, day.offset);
        const d = new Date(`${iso}T12:00:00`);
        const dateLabel = `${String(d.getDate()).padStart(2, '0')}/${monthNamesShort[d.getMonth()]}`;
        return `
        <th class="${day.offset >= 5 ? 'weekend' : ''}">
            <span>${escapeHtml(day.title)} ${escapeHtml(dateLabel)}</span>
            <strong>${escapeHtml(day.subtitle)}</strong>
        </th>
    `;
    }).join('');

    const body = groups.map(group => `
        <section class="excel-week-block">
            <div class="excel-week-title">
                <strong>${escapeHtml(group.hotel)}</strong>
                <span>Semana ${escapeHtml(window.TurnosDB.fmtDateLegacy(group.weekStart))}</span>
            </div>
            <table class="excel-native-table">
                <thead>
                    <tr>
                        <th class="person-col">Personal</th>
                        ${dayHead(group.weekStart)}
                    </tr>
                </thead>
                <tbody>
                    ${group.rows.map(row => `
                        <tr>
                            <td class="person-col">
                                <button type="button" onclick="window.openEmpDrawer('${escapeHtml(row.empleadoId).replace(/'/g, "\\'")}')">${escapeHtml(row.displayName)}</button>
                            </td>
                            ${row.cells.map(cell => {
                                const model = excelShiftCell(cell);
                                return `
                                    <td class="excel-shift-cell ${model.cls}" data-empleado-id="${escapeHtml(row.empleadoId)}" data-fecha="${escapeHtml(cell.fecha)}">
                                        <span>${escapeHtml(model.label)}</span>
                                    </td>
                                `;
                            }).join('')}
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </section>
    `).join('');

    return `<div class="excel-native-view">${body}</div>`;
}

async function loadExcelSourceRows() {
    if (window._excelSourceRows) return window._excelSourceRows;
    const response = await fetch(EXCEL_SOURCE_FILE, { cache: 'no-store' });
    if (!response.ok) throw new Error(`No se pudo leer el Excel original (${response.status})`);
    const buffer = await response.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
    const result = {};

    EXCEL_HOTEL_SHEETS.forEach(hotel => {
        const sheet = workbook.Sheets[hotel];
        if (!sheet) return;
        const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true });
        result[hotel] = matrix.slice(1).map((row, index) => ({
            hotel,
            rowIndex: index,
            weekStart: excelCellDate(row[0]),
            displayName: String(row[1] || ''),
            empleadoId: String(row[1] || '').trim(),
            values: EXCEL_DAY_COLUMNS.map((_, i) => shiftFromExcel(row[i + 2]))
        })).filter(row => row.weekStart && row.empleadoId);
    });

    window._excelSourceRows = result;
    return result;
}

window.renderExcelView = async () => {
    const area = $('#excel-grid-container');
    if (!area) return;
    
    area.innerHTML = `<div style="padding:4rem; text-align:center; opacity:0.5;">Cargando Excel original...</div>`;
    
    // Filtros
    const monthEl = $('#excelMonth');
    const hotelEl = $('#excelHotel');
    
    if (monthEl && !monthEl.value) {
        const now = new Date();
        monthEl.value = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    }
    
    const monthStr = monthEl ? monthEl.value : window.isoDate(new Date()).substring(0,7);
    const selHotel = hotelEl ? hotelEl.value : 'all';

    try {
        const { start, end } = monthBounds(monthStr);
        const source = await loadExcelSourceRows();
        const hotelsToRender = selHotel === 'all' ? EXCEL_HOTEL_SHEETS : [selHotel];

        const weeks = [];
        hotelsToRender.forEach(hotel => {
            (source[hotel] || []).forEach(row => {
                const weekEnd = window.addDays(row.weekStart, 6);
                if (row.weekStart <= end && weekEnd >= start) {
                    weeks.push(row);
                }
            });
        });

        if (!weeks.length) {
            area.innerHTML = `<div style="padding:4rem; text-align:center; opacity:0.5;">No hay filas del Excel original para este filtro.</div>`;
            return;
        }

        const groups = [];
        let currentGroup = null;
        weeks.forEach(sourceRow => {
            if (!currentGroup || currentGroup.hotel !== sourceRow.hotel || currentGroup.weekStart !== sourceRow.weekStart) {
                currentGroup = { hotel: sourceRow.hotel, weekStart: sourceRow.weekStart, rows: [] };
                groups.push(currentGroup);
            }
            currentGroup.rows.push({
                displayName: sourceRow.displayName,
                empleadoId: sourceRow.empleadoId,
                hotel_id: sourceRow.hotel,
                cells: EXCEL_DAY_COLUMNS.map((day, idx) => {
                    const fecha = window.addDays(sourceRow.weekStart, day.offset);
                    return {
                        fecha,
                        turno: sourceRow.values[idx]
                    };
                })
            });
        });

        area.innerHTML = renderExcelStaticTable(groups, EXCEL_DAY_COLUMNS);

    } catch (e) {
        area.innerHTML = `<div style="padding:2rem; color:var(--danger);">Error cargando datos: ${e.message}</div>`;
    }
};

// ==========================================
// 4. MÃ“DULO DE VACACIONES (V9.0)
// ==========================================
window.renderVacationsView = async () => {
    const area = $('#vacContent');
    if (!area) return;

    area.innerHTML = `<div style="padding:4rem; text-align:center; opacity:0.5;"><i class="fas fa-spinner fa-spin"></i> Cargando cuadrante de vacaciones...</div>`;

    try {
        const hotel = $('#vacHotel')?.value || 'all';
        const emp = $('#vacEmp')?.value || 'all';
        const rangeStr = $('#vacRange')?.value || '';
        
        let start = null, end = null;
        if (rangeStr.includes(" a ")) {
            [start, end] = rangeStr.split(" a ");
        }

        // Si no hay rango, por defecto desde hoy en adelante
        const today = window.isoDate(new Date());
        let data = await window.TurnosDB.fetchTipo('VAC', start || today, end);
        const allEmps = await window.TurnosDB.getEmpleados();

        // Aplicar filtros locales
        if (hotel !== 'all') data = data.filter(t => t.hotel_id === hotel);
        if (emp !== 'all') data = data.filter(t => t.empleado_id === emp);

        // Agrupar por periodos contiguos
        const periods = [];
        const sortedByEmp = {};
        data.forEach(t => {
            if (!sortedByEmp[t.empleado_id]) sortedByEmp[t.empleado_id] = [];
            sortedByEmp[t.empleado_id].push(t);
        });

        Object.keys(sortedByEmp).forEach(eId => {
            const list = sortedByEmp[eId].sort((a,b) => a.fecha.localeCompare(b.fecha));
            if (list.length === 0) return;

            let currentPeriod = {
                empId: eId,
                hotel: list[0].hotel_id,
                start: list[0].fecha,
                end: list[0].fecha,
                days: 1
            };

            for (let i = 1; i < list.length; i++) {
                const prevDate = new Date(list[i-1].fecha + 'T12:00:00');
                const currDate = new Date(list[i].fecha + 'T12:00:00');
                const diff = (currDate - prevDate) / (1000 * 60 * 60 * 24);

                if (diff === 1) {
                    currentPeriod.end = list[i].fecha;
                    currentPeriod.days++;
                } else {
                    periods.push(currentPeriod);
                    currentPeriod = {
                        empId: eId,
                        hotel: list[i].hotel_id,
                        start: list[i].fecha,
                        end: list[i].fecha,
                        days: 1
                    };
                }
            }
            periods.push(currentPeriod);
        });

        // Ordenar periodos por fecha de inicio (mÃ¡s recientes o futuros primero)
        periods.sort((a,b) => a.start.localeCompare(b.start));

        if (periods.length === 0) {
            area.innerHTML = `<div style="padding:4rem; text-align:center; opacity:0.3;">No se han encontrado registros de vacaciones para los filtros seleccionados.</div>`;
            return;
        }

        area.innerHTML = `
            <div class="glass" style="padding:0; overflow:hidden; border-radius:15px; border:1px solid var(--border);">
                <table class="preview-table" style="width:100%; border-collapse:collapse;">
                    <thead>
                        <tr style="background:var(--bg3);">
                            <th style="padding:1rem; text-align:left; font-size:0.7rem; color:var(--text-dim); text-transform:uppercase;">Empleado</th>
                            <th style="padding:1rem; text-align:left; font-size:0.7rem; color:var(--text-dim); text-transform:uppercase;">Hotel</th>
                            <th style="padding:1rem; text-align:center; font-size:0.7rem; color:var(--text-dim); text-transform:uppercase;">Desde</th>
                            <th style="padding:1rem; text-align:center; font-size:0.7rem; color:var(--text-dim); text-transform:uppercase;">Hasta</th>
                            <th style="padding:1rem; text-align:center; font-size:0.7rem; color:var(--text-dim); text-transform:uppercase;">DÃ­as</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${periods.map(p => `
                            <tr style="border-top:1px solid var(--border);">
                                <td style="padding:1rem; font-weight:700; color:var(--accent);">${p.empId}</td>
                                <td style="padding:1rem; font-size:0.85rem; color:var(--text-dim);">${p.hotel}</td>
                                <td style="padding:1rem; text-align:center; font-weight:600;">${window.TurnosDB.fmtDateLegacy(p.start)}</td>
                                <td style="padding:1rem; text-align:center; font-weight:600;">${window.TurnosDB.fmtDateLegacy(p.end)}</td>
                                <td style="padding:1rem; text-align:center;">
                                    <span style="background:var(--accent-dim); color:var(--accent); padding:4px 10px; border-radius:10px; font-weight:800; font-size:0.8rem;">
                                        ${p.days} d
                                    </span>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

    } catch (err) {
        console.error("Error Vacations:", err);
        area.innerHTML = `<div style="padding:2rem; color:var(--danger); text-align:center;">Error cargando vacaciones: ${err.message}</div>`;
    }
};

window.TurnosDB.initVacations = async () => {
    await window.populateHotels();
    await window.populateVacationFilters();
    window.renderVacationsView();
};

window.refreshBadges = async () => {
    try {
        if (!window.supabase) return;
        const { count, error } = await window.supabase
            .from('peticiones_cambio')
            .select('*', { count: 'exact', head: true })
            .eq('estado', 'pendiente');
            
        if (error) throw error;

        const badge = document.getElementById('badge-requests');
        if (badge) {
            badge.textContent = count || 0;
            badge.style.display = count > 0 ? 'flex' : 'none';
        }
        
    } catch (e) {
        console.warn("Fallo cargando badges de solicitudes:", e.message);
    }
};

