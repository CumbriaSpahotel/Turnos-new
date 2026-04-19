// ==========================================
// 1. NÚCLEO Y CONFIGURACIÓN GLOBAL
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

// --- NAVEGACIÓN ---
window.switchSection = (id) => {
    window.addLog(`Cambiando a sección: ${id}`);
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
    if (!d || d.length < 10) return d || '—';
    const parts = d.split('-');
    return `${parseInt(parts[2])}/${parseInt(parts[1])}/${parts[0]}`;
};

window.fmtDateLegacy = (date) => {
    if (!date) return '—';
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
        window.addLog(`🚀 INICIANDO MIGRACIÓN A SUPABASE...`, 'ok');
        let processed = 0;
        const total = flatData.length;

        // Migración por lotes (opcional, upsert ya es eficiente)
        // Por ahora lo hacemos directo para simplicidad
        await window.TurnosDB.bulkUpsert(flatData);
        
        window.addLog(`✨ MIGRACIÓN EXITOSA: ${total} registros sincronizados ✅`, 'ok');
        window.updateDashboardStats();
    } catch (e) {
        console.error("Error migrando a Supabase:", e);
        window.addLog(`⚠️ ERROR EN MIGRACIÓN: ${e.message}`, 'error');
    }
};

window.clearAllData = async () => {
    if (!confirm("⚠️ ¿ESTÁS SEGURO? Esto borrará TODO el cuadrante de Supabase de forma permanente.")) return;
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

    // Vacaciones (próximos 30 días)
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
    // Detección mejorada de vacaciones (incluyendo emojis y prefijos)
    if (s.startsWith('v') || s.includes('vac') || s.includes('🏖️')) return 'v';
    if (s.startsWith('b') || s.includes('baja') || s.includes('permis') || s === 'p' || s.includes('🏥') || s.includes('📝')) return 'b';
    if (s === 'd' || s.startsWith('desc') || s.includes('🗓️')) return 'd';
    if (s.startsWith('m')) return 'm';
    if (s.startsWith('t')) return 't';
    if (s.startsWith('n')) return 'n';
    return '';
};

// --- HELPERS DE MAPEADO (ESTRICTOS V8.2) ---
function extraerTurno(txt) {
    const t = String(txt || '').toLowerCase();
    if (t.includes('mañana')) return 'M';
    if (t.includes('tarde')) return 'T';
    if (t.includes('noche')) return 'N';
    if (t.includes('descanso')) return 'D';
    return '';
}

function detectarTipo(txt) {
    const t = String(txt || '').toLowerCase();
    if (t.includes('vac')) return 'VAC 🏖️';
    if (t.includes('baja')) return 'BAJA 🏥';
    if (t.includes('perm')) return 'PERM 🗓️';
    // Solo CT si es expresamente un cambio/permuta entre dos personas
    if (t.includes('c/t') || t.includes('cambio')) return 'CT 🔄';
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
            window.addLog('⚠️ LIMITE LOCAL: Datos demasiado grandes para el navegador. Usando solo NUBE.', 'warn');
            localStorage.removeItem('turnosweb_admin_data');
            if ($('#status-text')) $('#status-text').textContent = 'Solo Nube (Local Lleno)';
        } else if (!window._storageWarningShown) {
            window.addLog('❌ ERROR: Bloqueo de Almacenamiento detectado.', 'error');
            alert("⚠️ ATENCIÓN: Tu navegador está bloqueando el almacenamiento de datos. Debes desactivar la 'Prevención de Seguimiento Estricta' o permitir cookies para este sitio.");
            window._storageWarningShown = true;
        }
    }
};

// ==========================================
// 2. MOTOR DE PROCESAMIENTO EXCEL (PARSER)
// ==========================================
window.processWorkbook = async (wb) => {
    window.addLog(`🚀 INICIANDO MIGRACIÓN ESTRICTA A BASE DE DATOS...`);
    window.addLog(`Analizando Excel (Hojas: ${wb.SheetNames.join(', ')})...`);
    
    const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    const SUBS_SHEETS = ['Sustituciones', 'Sustitución', 'Bajas'];
    const VALID_TYPES = ['VAC', 'BAJA', 'PERM', 'NORMAL', 'CT'];
    
    const subs = {};
    const toInsert = [];
    const seen = new Set();
    const stats = { inserted: 0, skipped: 0, duplicates: 0 };

    // 1. Procesar Hoja de Sustituciones (Normalización y Limpieza)
    const subsSheetName = wb.SheetNames.find(n => SUBS_SHEETS.some(s => n.toLowerCase().includes(s.toLowerCase())));
    if (subsSheetName) {
        window.addLog(`Analizando ausencias y cambios en: ${subsSheetName}`);
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[subsSheetName], { defval: '' });
        
        const subs = {}; // key: hotel_fecha_emp -> {sustituto, tipo}
        const swaps = {}; // key: hotel_fecha -> Set of [a, b] groups

        rows.forEach(r => {
            const rawDate = r['Fecha'] || r['Día'] || r['fecha'];
            const fecha = window.isoDate(rawDate);
            const emp = String(r['Empleado'] || r['Nombre'] || '').trim();
            const hotel = String(r['Hotel'] || '').trim();
            if (!fecha || !emp || !hotel) return;

            const cambio = String(r['Cambio de Turno'] || r['Cambio de turno'] || '').trim();
            const sustituto = String(r['Sustituto'] || '').trim();
            const tipo = String(r['TipoAusencia'] || r['Tipo Ausencia'] || r['Tipo'] || '');

            if (cambio) {
                const dayKey = `${hotel}_${fecha}`;
                if (!swaps[dayKey]) swaps[dayKey] = [];
                // Para evitar duplicados en swaps de doble dirección (A->B y B->A)
                const pair = [emp, cambio].sort();
                if (!swaps[dayKey].some(p => p[0] === pair[0] && p[1] === pair[1])) {
                    swaps[dayKey].push(pair);
                }
            } else if (sustituto || tipo) {
                const subKey = `${hotel}_${fecha}_${emp}`;
                subs[subKey] = { sustituto, tipo: detectarTipo(tipo) };
            }
        });
        window._tempSubs = subs;
        window._tempSwaps = swaps;
    }

    // 2. Procesar Hojas de Hoteles (Extracción y Normalización)
    for (const sheetName of wb.SheetNames) {
        if (sheetName === subsSheetName) continue;
        const sheet = wb.Sheets[sheetName];
        const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        if (rawRows.length === 0) continue;

        const firstRow = rawRows[0];
        const hasEmpCol = Object.keys(firstRow).some(k => k.trim().toLowerCase().includes('empleado') || k.trim().toLowerCase().includes('nombre'));
        if (!hasEmpCol) continue;

        window.addLog(`Procesando cuadrante: ${sheetName}...`);
        
        rawRows.forEach(rawRow => {
            const row = {}; for (let k in rawRow) row[String(k).trim()] = rawRow[k];
            
            const semanaCol = Object.keys(row).find(k => k.toLowerCase().includes('semana'));
            const rawSemana = row[semanaCol];
            if (!rawSemana) return;

            const weekDate = typeof rawSemana === 'number' ? new Date((rawSemana - 25569) * 86400 * 1000) : new Date(rawSemana);
            const lunes = window.isoDate(window.getMonday(weekDate));
            
            const empCol = Object.keys(row).find(k => k.toLowerCase().includes('empleado') || k.toLowerCase().includes('nombre'));
            const emp = String(row[empCol] || '').trim();
            
            // CAPTURAR ORDEN (PROYECTO ANTERIOR)
            if (!window.hotelOrders) window.hotelOrders = {};
            if (!window.hotelOrders[sheetName]) window.hotelOrders[sheetName] = [];
            if (!window.hotelOrders[sheetName].includes(emp)) window.hotelOrders[sheetName].push(emp);

            if (!lunes || !emp) { stats.skipped++; return; }
            
            DIAS.forEach((dia, i) => {
                const diaCol = Object.keys(row).find(k => 
                    k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(
                        dia.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                    )
                );
                
                if (diaCol) {
                    const fechaISO = window.addDays(lunes, i);
                    const rawTurno = String(row[diaCol] || '').trim();
                    const sustKey = `${emp}_${fechaISO}`;
                    
                    let finalTurno = extraerTurno(rawTurno);
                    let finalTipo = 'NORMAL';
                    let sustituto = null;

                    // FUSIÓN OBLIGATORIA CON SUSTITUCIONES (V8.2 - Persistencia Estricta)
                    if (subs[sustKey]) {
                        const s = subs[sustKey];
                        // Prioridad: 1. Tipo en hoja de sustituciones, 2. Tipo en celda de cuadrante, 3. Por defecto VAC (si hay sust)
                        const tipoEnCelda = detectarTipo(rawTurno);
                        if (s.tipo && s.tipo !== 'NORMAL') {
                            finalTipo = s.tipo;
                        } else if (tipoEnCelda !== 'NORMAL') {
                            finalTipo = tipoEnCelda;
                        } else {
                            // SI HAY SUSTITUTO Y NO SE DICE NADA, SON VACACIONES (según requerimiento user)
                            finalTipo = 'VAC 🏖️'; 
                        }
                        sustituto = s.sustituto;
                    } else {
                        finalTipo = detectarTipo(rawTurno);
                    }

                    const uniqKey = `${emp}|${fechaISO}`;
                    if (seen.has(uniqKey)) {
                        stats.duplicates++;
                        return;
                    }
                    seen.add(uniqKey);

                    if (!finalTurno && finalTipo === 'NORMAL') return; 

                    toInsert.push({
                        empleado_id: emp,
                        fecha: fechaISO,
                        turno: finalTurno,
                        hotel_id: sheetName,
                        tipo: finalTipo,
                        sustituto: sustituto
                    });
                    stats.inserted++;
                }
            });
        });
    }

    // 3. Ejecutar Inserción por Batch en Supabase
    if (toInsert.length > 0) {
        window.addLog(`Cargando ${toInsert.length} registros válidos...`);
      // 3. SEGUNDA PASADA: Aplicar Cambios de Turno (SWAPS) y Sustituciones
    const subs = window._tempSubs || {};
    const swaps = window._tempSwaps || {};
    
    // Agrupar por dia/hotel para facilitar swaps
    const hotelDayMap = {}; // key: hotel_fecha -> { emp: turnoInfo }
    toInsert.forEach(t => {
        const key = `${t.hotel_id}_${t.fecha}`;
        if (!hotelDayMap[key]) hotelDayMap[key] = {};
        hotelDayMap[key][t.empleado_id] = t;
    });

    // --- APLICAR SWAPS ---
    Object.keys(swaps).forEach(dayKey => {
        const [hotel, fecha] = dayKey.split('_');
        const dayShifts = hotelDayMap[dayKey];
        if (!dayShifts) return;

        swaps[dayKey].forEach(([empA, empB]) => {
            if (dayShifts[empA] && dayShifts[empB]) {
                const turnA = dayShifts[empA].turno;
                const turnB = dayShifts[empB].turno;
                
                // Intercambio
                dayShifts[empA].turno = turnB;
                dayShifts[empA].tipo = 'CT 🔄';
                
                dayShifts[empB].turno = turnA;
                dayShifts[empB].tipo = 'CT 🔄';
                
                window.addLog(`🔄 Swap aplicado entre ${empA} y ${empB} (${fecha})`, 'ok');
            }
        });
    });

    // --- APLICAR SUSTITUCIONES ---
    toInsert.forEach(t => {
        const subKey = `${t.hotel_id}_${t.fecha}_${t.empleado_id}`;
        if (subs[subKey]) {
            const s = subs[subKey];
            // Si hay sustitución, el empleado original se queda con la ausencia 
            const tipoEnCelda = detectarTipo(t.turno); // Por si en el cuadrante ponía "Vacaciones"
            if (s.tipo && s.tipo !== 'NORMAL') {
                t.tipo = s.tipo;
            } else if (tipoEnCelda !== 'NORMAL') {
                t.tipo = tipoEnCelda;
            } else {
                t.tipo = 'VAC 🏖️'; // Default legacy
            }
            t.sustituto = s.sustituto;
            window.addLog(`🏖️ Sustitución: ${t.empleado_id} -> ${s.sustituto} (${t.tipo})`, 'ok');
        }
    });

    // 4. PERSISTENCIA FINAL DE TURNOS
    try {
        await window.TurnosDB.bulkUpsert(toInsert);
        window.addLog(`🚀 Migración exitosa: ${toInsert.length} registros`, 'ok');
        
        // --- 5. SINCRONIZAR FICHAS DE EMPLEADO (BULK UPSERT V8.2) ---
        const empObjects = [];
        const uniqueEmpMap = {}; // key: name -> hotel_id

        toInsert.forEach(t => {
            if (!uniqueEmpMap[t.empleado_id]) uniqueEmpMap[t.empleado_id] = t.hotel_id;
            if (t.sustituto && !uniqueEmpMap[t.sustituto]) uniqueEmpMap[t.sustituto] = t.hotel_id;
        });

        for (const [name, hotel] of Object.entries(uniqueEmpMap)) {
            let ordenFinal = 999;
            Object.values(window.hotelOrders || {}).forEach(list => {
                const idx = list.indexOf(name);
                if (idx !== -1 && idx < ordenFinal) ordenFinal = idx;
            });

            empObjects.push({
                id: name,
                nombre: name,
                hotel_id: hotel,
                orden: ordenFinal,
                activo: true,
                updated_at: new Date().toISOString()
            });
        }

        if (empObjects.length > 0) {
            window.addLog(`Sincronizando ${empObjects.length} fichas de empleados...`);
            const { error: empError } = await window.supabase.from('empleados').upsert(empObjects);
            if (empError) throw empError;
            window.addLog(`✅ Fichas sincronizadas con éxito.`, 'ok');
        }

        // Limpiar cache y refrescar UI
        await localforage.clear();
        window.renderPreview();
    } catch (err) {
            console.error("Error en migración batch:", err);
            window.addLog(`❌ FALLO EN MIGRACIÓN: ${err.message}`, 'error');
            alert("Error crítico durante la carga de datos. Revisa la consola.");
        }
    } else {
        window.addLog(`⚠️ No se encontraron datos válidos para importar.`, 'warn');
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
    if (!window.TurnosDB) return;
    const area = $('#previewContent');
    if (!area) return;
    
    area.innerHTML = `<div style="padding:2rem; text-align:center; opacity:0.5;">Preparando vista por hoteles...</div>`;
    
    const isWeekly = window._previewMode === 'weekly';
    const selHotel = $('#prevHotel')?.value || 'all';
    
    let inicio, fin;
    if (isWeekly) {
        const activeDate = $('#prevWeekDate')?.value || window.isoDate(new Date());
        const dt = new Date(activeDate); 
        const off = (dt.getDay() === 0 ? -6 : 1 - dt.getDay());
        dt.setDate(dt.getDate() + off);
        inicio = window.isoDate(dt);
        const finDt = new Date(dt);
        finDt.setDate(finDt.getDate() + 6);
        fin = window.isoDate(finDt);
    } else {
        const monthStr = $('#prevMonth')?.value || window.isoDate(new Date()).substring(0,7);
        const dt = new Date(monthStr + "-01");
        inicio = window.isoDate(dt);
        const nextMonth = new Date(dt.getFullYear(), dt.getMonth() + 1, 0);
        fin = window.isoDate(nextMonth);
    }
    
    const data = await window.TurnosDB.fetchRango(inicio, fin);
    
    // Agrupar por Hotel
    const hotelsInDB = await window.TurnosDB.getHotels();
    const hotelsToRender = (selHotel === 'all') ? hotelsInDB : [selHotel];
    
    area.innerHTML = ''; // Limpiar
    
    for (const hotelName of hotelsToRender) {
        const hotelData = data.filter(t => t.hotel_id === hotelName);
        if (hotelData.length === 0 && selHotel !== 'all') {
            area.innerHTML += `<div style="padding:2rem; text-align:center; opacity:0.3;">No hay datos para ${hotelName} en este periodo.</div>`;
            continue;
        } else if (hotelData.length === 0) continue;

        // Crear contenedor para el hotel
        const section = document.createElement('div');
        section.className = 'hotel-preview-card';
        section.style = `
            background: var(--surface);
            border-radius: 15px;
            padding: 1rem;
            margin-bottom: 2rem;
            box-shadow: 0 10px 30px rgba(0,0,0,0.05);
            border: 1px solid var(--border);
        `;
        
        const header = document.createElement('div');
        header.style = 'font-weight:900; color:var(--accent); font-size:1rem; margin-bottom:1rem; text-transform:uppercase; letter-spacing:1px;';
        header.textContent = hotelName;
        section.appendChild(header);
        
        const tableArea = document.createElement('div');
        section.appendChild(tableArea);
        area.appendChild(section);
        
        // Renderizar tabla virtual para este hotel
        await window.renderSemanaEnContenedor(tableArea, inicio, fin, hotelData);
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
        const dayName = ['DOMINGO','LUNES','MARTES','MIÉRCOLES','JUEVES','VIERNES','SÁBADO'][curr.getDay()];
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
    
    // --- LÓGICA DE FUSIÓN DE SUSTITUTOS (V8.2) ---
    // 1. Obtener lista de empleados base + sustitutos mencionados
    const empBase = new Set(hotelData.map(t => t.empleado_id));
    hotelData.forEach(t => { if (t.sustituto) empBase.add(t.sustituto); });
    
    // 2. Ordenar según el orden persistido (V8.2 Premium)
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
            
            // Si no tiene registro directo, ¿está sustituyendo a alguien?
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
};

// ==========================================
// 3. ORQUESTADOR DE RENDERIZACIÓN PÚBLICA (VIRTUALIZADO)
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
        const dayNames = ['DOM','LUN','MAR','MIÉ','JUE','VIE','SÁB'];
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
    
    // --- LÓGICA DE FUSIÓN Y ORDENACIÓN (ESTILO V8.2 PREMIUM) ---
    const profiles = await window.TurnosDB.getEmpleados();
    const empBaseSet = new Set(hotelData.map(t => t.empleado_id));
    hotelData.forEach(t => { if (t.sustituto) empBaseSet.add(t.sustituto); });
    const allEmp = Array.from(empBaseSet);

    // Contar ausencias para mover al fondo
    const absenceCount = {};
    allEmp.forEach(name => {
        absenceCount[name] = 0;
        columns.forEach(c => {
            const d = hotelData.find(s => s.empleado_id === name && s.fecha === c.dbFecha);
            if (d && d.tipo !== 'NORMAL' && !d.tipo.includes('CT')) absenceCount[name]++;
        });
    });

    const isTotalAbsent = (name) => absenceCount[name] >= columns.length;

    const getOrder = (name) => {
        if (name === '¿?') return -1;
        const p = profiles.find(pr => pr.id === name || pr.nombre === name);
        return p?.orden ?? 999;
    };

    const empNamesOrdered = allEmp.sort((a, b) => {
        // 1. Ausentes totales al final
        const aAb = isTotalAbsent(a), bAb = isTotalAbsent(b);
        if (aAb !== bAb) return aAb ? 1 : -1;
        // 2. Orden de base de datos
        return getOrder(a) - getOrder(b);
    });

    const rows = empNamesOrdered.map(name => {
        const cells = columns.map(c => {
            const direct = hotelData.find(s => s.empleado_id === name && s.fecha === c.dbFecha);
            if (direct) return { turno: direct.turno, tipo: direct.tipo, sustituto: direct.sustituto };
            
            const substituted = hotelData.find(s => s.sustituto === name && s.fecha === c.dbFecha);
            if (substituted) return { turno: substituted.turno, tipo: 'NORMAL', isSub: true, subFor: substituted.empleado_id };
            
            return { turno: '', tipo: 'NORMAL' };
        });
        return { empName: name, cells: cells, hotel_id: hotelName };
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
    
    modal = document.createElement('div');
    modal.id = 'quickEditModal';
    modal.style = `position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background:var(--surface); padding:25px; border-radius:15px; box-shadow:0 10px 50px rgba(0,0,0,0.6); z-index:9999; display:flex; gap:10px; flex-direction:column; border:1px solid var(--border); min-width:300px;`;
    
    modal.innerHTML = `
        <h3 style="margin:0 0 10px 0; text-align:center;">✍️ Editar Turno</h3>
        <p style="margin:0 0 15px 0; text-align:center; color:var(--text-dim);"><b>${empleadoId}</b> &bull; ${fecha}</p>
        
        <input type="text" id="quickTurno" placeholder="Ej: M, T, N" class="search-input" style="text-align:center; margin-bottom:15px; font-size:1.2rem; font-weight:bold;" autocomplete="off" value="${cellEl.textContent.trim() === '·' ? '' : cellEl.textContent.trim()}">
        
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
            <button class="btn" style="background:rgba(255, 152, 0, 0.2); color:#ff9800;" onclick="window.seleccionarTipo('${empleadoId}','${fecha}','VAC 🏖️')">🏖️ VAC</button>
            <button class="btn" style="background:rgba(233, 30, 99, 0.2); color:#e91e63;" onclick="window.seleccionarTipo('${empleadoId}','${fecha}','BAJA 🏥')">🏥 BAJA</button>
            <button class="btn" style="background:rgba(33, 150, 243, 0.2); color:#2196f3;" onclick="window.seleccionarTipo('${empleadoId}','${fecha}','PERM 🗓️')">🗓️ PERM</button>
            <button class="btn" style="background:rgba(156, 39, 176, 0.2); color:#9c27b0;" onclick="window.seleccionarTipo('${empleadoId}','${fecha}','CT 🔄')">🔄 CT</button>
            <button class="btn active" style="grid-column: span 2; background:var(--accent); color:white;" onclick="window.seleccionarTipo('${empleadoId}','${fecha}','NORMAL')">✅ GUARDAR (NORMAL)</button>
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
    
    const VALID_TYPES = ['VAC 🏖️', 'BAJA 🏥', 'PERM 🗓️', 'CT 🔄', 'NORMAL', 'VAC', 'BAJA', 'PERM', 'CT'];
    if (!VALID_TYPES.includes(tipo)) {
        throw new Error(`Tipo de turno inválido: ${tipo}`);
    }
};

window.seleccionarTipo = async (empleado_id, fecha, tipo) => {
    const turnoVal = document.getElementById('quickTurno')?.value || '';
    const modal = document.getElementById('quickEditModal');
    
    // 1. VALIDACIÓN DE NEGOCIO PREVIA
    try {
        window.validarTurno(fecha, tipo);
    } catch (ve) {
        alert("🚨 Validacion: " + ve.message);
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
        
        // 5. ROLLBACK AUTOMÁTICO + ESTADO DE ERROR VISUAL
        if (window.virtualTable && oldData) {
            window.virtualTable.rollbackRow(empleado_id, fecha, oldData);
        }

        window.addLog(`❌ FALLO: ${e.message}`, 'error');
        alert("⚠️ Error de Red: No se pudo sincronizar. El cambio ha sido revertido.");
        
        if(modal) {
            modal.style.opacity = '1';
            modal.style.pointerEvents = 'auto';
        }
    }
};

// ==========================================
// 4. GESTIÓN DE EMPLEADOS Y PERSONAL
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

window.populateEmployees = async () => {
    const area = $('#employeesContent'); if (!area) return;
    
    // 1. CARGA DESDE NUBE (FUERZA DE VERDAD)
    const profilesList = await window.TurnosDB.getEmpleados();
    const stats = window.calculateStats() || {};
    
    // Identificar todos los hoteles disponibles (de stats o de fichas)
    const hotelSet = new Set(Object.values(stats).map(s => s.hotel));
    profilesList.forEach(p => { if(p.hotel_id) hotelSet.add(p.hotel_id); });
    const hotels = Array.from(hotelSet).filter(Boolean).sort();

    if (profilesList.length === 0 && hotels.length === 0) {
        area.innerHTML = '<div style="padding:100px; text-align:center; opacity:0.5;">No hay empleados registrados. Importa un Excel para crearlos automáticamente.</div>';
        return;
    }
    
    area.innerHTML = hotels.map(hotel => {
        // Combinar datos: Buscamos empleados que pertenezcan a este hotel (en ficha o en stats)
        const empsInHotel = profilesList.filter(p => p.hotel_id === hotel);
        
        // Si hay gente en stats que no está en profilesList (raro), los añadimos
        Object.values(stats).forEach(s => {
            if (s.hotel === hotel && !empsInHotel.find(p => p.id === s.emp)) {
                empsInHotel.push({ id: s.emp, nombre: s.emp, hotel_id: hotel, orden: 999 });
            }
        });

        const cards = empsInHotel.sort((a,b) => (a.orden || 999) - (b.orden || 999)).map(p => {
            const s = stats[p.id] || { m:0, t:0, n:0, v:0, b:0, hotel: hotel };
            const initials = p.nombre.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
            const totalWork = s.m + s.t + s.n;
            const hue = Math.abs(p.nombre.length * 137.5) % 360;
            
            return `
            <div class="emp-card-premium" onclick="window.openEmpDrawer('${p.id.replace(/'/g, "\\'")}')">
                <div class="ep-gradient" style="background: linear-gradient(135deg, hsl(${hue}, 70%, 65%), hsl(${hue}, 70%, 45%))"></div>
                <div class="ep-body">
                    <div class="ep-avatar-wrap">
                        <div class="ep-avatar" style="background: hsl(${hue}, 70%, 95%); color: hsl(${hue}, 70%, 30%)">${initials}</div>
                    </div>
                    <div class="ep-info">
                        <h3 class="ep-name">${p.nombre}</h3>
                        <p class="ep-role">${p.puesto || 'Ficha de Personal'}</p>
                    </div>
                    <div class="ep-stats">
                        <div class="ep-stat"><span class="ep-label">M</span><span class="ep-val">${s.m}</span></div>
                        <div class="ep-stat"><span class="ep-label">T</span><span class="ep-val">${s.t}</span></div>
                        <div class="ep-stat"><span class="ep-label">N</span><span class="ep-val">${s.n}</span></div>
                        <div class="ep-stat highlight"><span class="ep-label">V</span><span class="ep-val">${s.v}</span></div>
                    </div>
                    <div class="ep-footer">
                         <div class="ep-progress-label">Ficha Supabase Cloud</div>
                         <div class="ep-progress-bar"><div class="ep-progress-fill" style="width:100%; background:hsl(${hue}, 70%, 50%)"></div></div>
                         <div class="ep-total">ID: ${p.id}</div>
                    </div>
                </div>
            </div>`;
        }).join('');

        return `
        <div class="emp-hotel-section">
            <div class="section-title-premium" style="margin-top:2rem;">
                <span class="stp-icon">🏨</span>
                <h2>${hotel}</h2>
                <span class="stp-count">${empsInHotel.length} fichas</span>
            </div>
            <div class="employees-grid-inner">${cards}</div>
        </div>`;
    }).join('');
};

window.openEmpDrawer = async (name) => {
    const drawer = $('#empDrawer');
    const body = $('#drawerBody');
    if (!drawer || !body) return;
    
    drawer.classList.add('open');
    body.innerHTML = `<div style="padding:4rem; text-align:center; opacity:0.5;">Cargando ficha...</div>`;

    const allStats = window.calculateStats();
    const s = allStats[name] || { m:0, t:0, n:0, v:0, b:0, d:0, hotel: 'GENERAL', history: [] };
    
    // FETCH DESDE NUBE
    const employees = await window.TurnosDB.getEmpleados();
    const p = employees.find(e => e.id === name) || { id: name };
    
    const initials = name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase();
    const totalWorking = s.m + s.t + s.n;

    body.innerHTML = `
        <div class="drawer-header">
            <div class="emp-avatar large" style="--emp-hue:${Math.abs(name.length * 17) % 360}">${initials}</div>
            <div class="drawer-title-group">
                <h2 style="margin:0; font-size:1.6rem; letter-spacing:-0.02em;">${name}</h2>
                <div style="display:flex; gap:6px; margin-top:4px;">
                    <span class="status-badge" style="background:var(--accent-dim); color:var(--accent); border:none; font-size:0.7rem;">${s.hotel}</span>
                    <span class="status-badge" style="background:var(--success-dim); color:var(--success); border:none; font-size:0.7rem;">${p.contrato || 'Fijo'}</span>
                </div>
            </div>
        </div>
        
        <div class="drawer-section-title">RESUMEN DE ACTIVIDAD (MES ACTUAL)</div>
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

        <div class="glass" style="padding:1.2rem; margin-top:1.5rem; border-color:rgba(0,0,0,0.05); background:#fff;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px solid var(--border); padding-bottom:8px;">
                <h4 style="margin:0; color:var(--accent); font-size:0.8rem; text-transform:uppercase; letter-spacing:0.05em;">Ficha Técnica (Cloud)</h4>
                <span style="font-size:0.75rem; color:var(--text-dim);">${totalWorking} servicios totales</span>
            </div>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; font-size:0.85rem;">
                <div>
                    <span style="color:var(--text-dim); font-size:0.75rem;">Antigüedad</span><br>
                    <input type="text" class="edit-input" value="${p.antiguedad || ''}" placeholder="Ej: 2021" onchange="window.saveEmpField('${name}', 'antiguedad', this.value)">
                </div>
                <div>
                    <span style="color:var(--text-dim); font-size:0.75rem;">Categoría</span><br>
                    <input type="text" class="edit-input" value="${p.categoria || ''}" placeholder="Ej: Recepcionista" onchange="window.saveEmpField('${name}', 'categoria', this.value)">
                </div>
                <div>
                    <span style="color:var(--text-dim); font-size:0.75rem;">Puesto</span><br>
                    <input type="text" class="edit-input" value="${p.puesto || ''}" placeholder="Ej: Correturnos" onchange="window.saveEmpField('${name}', 'puesto', this.value)">
                </div>
                <div>
                    <span style="color:var(--text-dim); font-size:0.75rem;">Contrato</span><br>
                    <select class="edit-input" onchange="window.saveEmpField('${name}', 'contrato', this.value)">
                        <option value="Fijo" ${p.contrato === 'Fijo' ? 'selected' : ''}>Fijo</option>
                        <option value="Eventual" ${p.contrato === 'Eventual' ? 'selected' : ''}>Eventual</option>
                        <option value="Sustitución" ${p.contrato === 'Sustitución' ? 'selected' : ''}>Sustitución</option>
                    </select>
                </div>
            </div>
            <div style="margin-top:10px; font-size:0.7rem; color:var(--success); display:none;" id="save-indicator">✓ Guardado en Supabase</div>
        </div>

        <div class="drawer-section-title" style="margin-top:2rem;">HISTORIAL DE TURNOS</div>
        <div class="history-list">
            ${s.history.slice(0, 15).map(h => `
                <div class="history-item">
                    <div class="hi-date">
                        <span class="hi-day">${h.fecha.split('-')[2]}</span>
                        <span class="hi-month">${h.fecha.split('-')[1]}</span>
                    </div>
                    <div class="hi-info">
                        <div style="font-weight:600; font-size:0.9rem;">${h.turno}</div>
                        <div style="font-size:0.7rem; opacity:0.5;">${h.hotel}</div>
                    </div>
                    <div class="hi-type"><span class="type-dot ${h.cls}"></span></div>
                </div>
            `).join('')}
        </div>
    `;
};

window.saveEmpField = async (name, field, value) => {
    try {
        const payload = { id: name };
        payload[field] = value;
        await window.TurnosDB.upsertEmpleado(payload);

        // Mostrar feedback visual
        const indicator = $('#save-indicator');
        if (indicator) {
            indicator.style.display = 'block';
            setTimeout(() => { if (indicator) indicator.style.display = 'none'; }, 2000);
        }
    } catch (e) {
        console.error("Error guardando ficha:", e);
        alert("Error al guardar en la nube.");
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
    
    // Inicialización de UI y Datos
    (async function init() {
        // Forzar lunes como primer día de la semana globalmente
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
                    <div style="font-size:0.8rem; font-weight:900; color:var(--accent); margin-bottom:5px;">✓ BASE DE DATOS ACTIVA</div>
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
// 5. BACKUP Y CONFIGURACIÓN (RESTAURACIÓN)
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
            window.addLog('Configuración restaurada con éxito.', 'ok');
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
window.renderExcelView = async () => {
    const area = $('#excel-grid-container');
    if (!area) return;
    
    area.innerHTML = `<div style="padding:4rem; text-align:center; opacity:0.5;">Cargando Base de Datos Maestra...</div>`;
    
    // Filtros
    const monthEl = $('#excelMonth');
    const hotelEl = $('#excelHotel');
    
    if (monthEl && !monthEl.value) {
        const now = new Date();
        monthEl.value = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    }
    
    const monthStr = monthEl ? monthEl.value : window.isoDate(new Date()).substring(0,7);
    const selHotel = hotelEl ? hotelEl.value : 'all';

    const dt = new Date(monthStr + "-01");
    const inicio = window.isoDate(dt);
    const lastDay = new Date(dt.getFullYear(), dt.getMonth() + 1, 0);
    const fin = window.isoDate(lastDay);
    
    try {
        let data = await window.TurnosDB.fetchRango(inicio, fin);
        if (selHotel !== 'all') {
            data = data.filter(t => t.hotel_id === selHotel);
        }
        
        // Columnas para todo el mes
        const columns = [];
        let cur = new Date(inicio);
        while (cur <= lastDay) {
            const iso = window.isoDate(cur);
            columns.push({
                dbFecha: iso,
                title: ['dom','lun','mar','mié','jue','vie','sáb'][cur.getDay()],
                subtitle: cur.getDate(),
                isWeekend: cur.getDay() === 0 || cur.getDay() === 6
            });
            cur.setDate(cur.getDate() + 1);
        }
        
        // 4. Preparar datos (Lógica de Fusión V8.2)
        const empBase = new Set(data.map(t => t.empleado_id));
        data.forEach(t => { if(t.sustituto) empBase.add(t.sustituto); });
        const empNames = Array.from(empBase).sort();

        const rows = empNames.map(name => {
            const cells = columns.map(c => {
                const direct = data.find(s => s.empleado_id === name && s.fecha === c.dbFecha);
                if (direct) {
                    return { turno: direct.turno, tipo: direct.tipo, sustituto: direct.sustituto };
                }
                const beingSubstituted = data.find(s => s.sustituto === name && s.fecha === c.dbFecha);
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

        if (!window.virtualTable) {
            window.virtualTable = new window.VirtualTable(area, {
                columns: columns,
                rowHeight: 55
            });
            area.addEventListener('cellEdit', (e) => {
                window.abrirEditorRapido(e.detail.empleado, e.detail.fecha, e.detail.cellElement);
            });
        }
        
        window.virtualTable.setData(rows);

    } catch (e) {
        area.innerHTML = `<div style="padding:2rem; color:var(--danger);">Error cargando datos: ${e.message}</div>`;
    }
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
