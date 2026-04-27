const fs = require('fs');
const jsPath = 'c:/Users/comun/Documents/GitHub/Turnos-new/admin.js';
let js = fs.readFileSync(jsPath, 'utf8');

// 1. LIMPIEZA DE SINTAXIS (Duplicados de $ y $$)
// Primero eliminamos cualquier declaración de const $ o const $$ que hayamos inyectado erróneamente
js = js.replace(/const \$ = window\.\$;\r?\nconst \$\$ = window\.\$\$;/g, '');
// Nos aseguramos de que existan como window.$ pero sin redolarar const si ya existen
if (!js.includes('window.updateConnectionUI')) {
    const connectionLogic = `
// ==========================================
// MÓDULO: ESTADO DE CONEXIÓN SUPABASE
// ==========================================
window.connectionState = {
    status: 'connecting',
    checkedAt: null,
    message: ''
};

window.updateConnectionUI = (status, msg = '') => {
    window.connectionState.status = status;
    window.connectionState.checkedAt = new Date();
    window.connectionState.message = msg;

    const dot = document.getElementById('syncDot');
    const text = document.getElementById('syncText');
    const kpi = document.getElementById('stat-cloud-status');
    const container = document.getElementById('syncStatus');

    if (!dot || !text) return;

    const config = {
        connecting: { color: '#f59e0b', text: 'Conectando...', kpi: '...' },
        connected: { color: '#10b981', text: 'Supabase conectado', kpi: 'Online' },
        error: { color: '#ef4444', text: 'Error de conexión', kpi: 'Offline' },
        unconfigured: { color: '#64748b', text: 'Sin configurar', kpi: 'N/A' }
    };

    const state = config[status] || config.error;
    dot.style.background = state.color;
    text.textContent = state.text;
    if (kpi) {
        kpi.textContent = state.kpi;
        kpi.style.color = state.color;
    }

    if (status === 'error') {
        container.title = msg;
        if (!document.getElementById('btn-retry-conn')) {
            const btn = document.createElement('button');
            btn.id = 'btn-retry-conn';
            btn.innerHTML = '<i class="fas fa-sync-alt"></i>';
            btn.style = 'margin-left:8px; border:none; background:none; color:var(--text-dim); cursor:pointer; font-size:0.7rem;';
            btn.onclick = (e) => {
                e.stopPropagation();
                window.checkSupabaseConnection();
            };
            container.appendChild(btn);
        }
    } else {
        const btn = document.getElementById('btn-retry-conn');
        if (btn) btn.remove();
    }
};

window.checkSupabaseConnection = async () => {
    window.updateConnectionUI('connecting');
    
    const timeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Tiempo de espera agotado al conectar con Supabase')), 5000)
    );

    try {
        if (!window.supabase || !window.TurnosDB) {
            throw new Error('Cliente Supabase no inicializado');
        }

        // Prueba real de consulta
        const query = window.supabase.from('empleados').select('count', { count: 'exact', head: true });
        await Promise.race([query, timeout]);
        
        window.updateConnectionUI('connected');
        console.log("[CONN] Supabase conectado correctamente.");
    } catch (err) {
        console.error("[CONN ERROR]", err);
        const isConfigError = err.message.includes('URL') || err.message.includes('Key');
        window.updateConnectionUI(isConfigError ? 'unconfigured' : 'error', err.message);
        
        if (window.addLog) window.addLog(\`Fallo de conexión: \${err.message}\`, 'error');
    }
};
`;
    // Insertar después de las utilidades
    js = js.replace(/\/\/ --- UTILIDADES GLOBALES ---[\s\S]*?\/\/ --- FIX DATA/, (match) => match + '\n' + connectionLogic);
}

// 2. DISPARAR VALIDACIÓN AL CARGAR
if (!js.includes('window.checkSupabaseConnection()')) {
    js = js.replace('window.renderDashboard();', 'window.renderDashboard();\n    window.checkSupabaseConnection();');
}

// 3. ASEGURAR QUE LOS KPIs DEL DASHBOARD USAN EL ESTADO
const kpiRenderFix = `
        const [pendientes, bajas] = await Promise.all([
            window.TurnosDB.fetchPeticiones().then(d => d.filter(r => r.estado === 'pendiente').length).catch(() => 0),
            window.TurnosDB.fetchEventos().then(d => d.filter(ev => ev.tipo === 'BAJA' && (ev.estado || 'activo') === 'activo').length).catch(() => 0)
        ]);

        if ($('#stat-pending-requests')) $('#stat-pending-requests').textContent = pendientes;
        if ($('#stat-today-activity')) $('#stat-today-activity').textContent = bajas;
        if ($('#stat-last-sync')) $('#stat-last-sync').textContent = new Date().toLocaleTimeString();
        
        // El estado de Cloud se actualiza vía window.updateConnectionUI
`;
js = js.replace(/const \[pendientes, bajas\] = await Promise\.all\(\[[\s\S]*?\/\/ El estado de Cloud se actualiza vía window\.updateConnectionUI/, kpiRenderFix);

fs.writeFileSync(jsPath, js);
console.log("admin.js connection logic and syntax fixed.");
