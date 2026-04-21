// Indicador global de conexion Supabase para todos los modulos.
(function () {
    const STATES = {
        connecting: { text: 'Conectando...', color: '#ff9800', bg: 'rgba(255,152,0,0.08)', border: 'rgba(255,152,0,0.35)' },
        ok: { text: 'Supabase conectado', color: '#10e898', bg: 'rgba(16,232,152,0.08)', border: 'rgba(16,232,152,0.35)' },
        warn: { text: 'Modo historico', color: '#ff9800', bg: 'rgba(255,152,0,0.08)', border: 'rgba(255,152,0,0.35)' },
        error: { text: 'Sin conexion nube', color: '#ff5f57', bg: 'rgba(255,95,87,0.08)', border: 'rgba(255,95,87,0.35)' },
        storage: { text: 'Almacenamiento bloqueado', color: '#ff5f57', bg: 'rgba(255,95,87,0.08)', border: 'rgba(255,95,87,0.35)' }
    };

    function ensureBadge() {
        let badge = document.getElementById('syncStatus');
        if (!badge) {
            const header = document.querySelector('.page-header') || document.querySelector('header') || document.body;
            badge = document.createElement('div');
            badge.id = 'syncStatus';
            badge.className = 'status-badge-premium';
            badge.style.marginLeft = 'auto';
            badge.style.display = 'flex';
            badge.style.alignItems = 'center';
            badge.style.gap = '8px';
            badge.style.padding = '6px 12px';
            badge.style.borderRadius = '30px';
            badge.style.border = '1px solid var(--border)';
            badge.innerHTML = '<span id="syncDot" style="width:8px; height:8px; border-radius:50%;"></span><span id="syncText">Conectando...</span>';
            header.appendChild(badge);
        }
        return badge;
    }

    window.setCloudStatus = function setCloudStatus(state, customText) {
        const cfg = STATES[state] || STATES.connecting;
        const badge = ensureBadge();
        const dot = document.getElementById('syncDot');
        const text = document.getElementById('syncText');
        if (dot) dot.style.background = cfg.color;
        if (text) {
            text.textContent = customText || cfg.text;
            text.style.color = cfg.color;
        }
        badge.style.borderColor = cfg.border;
        badge.style.background = cfg.bg;
        window.realtimeActivo = state === 'ok';
    };

    async function pingSupabase() {
        if (window.cloudStatusOverride) {
            window.setCloudStatus(window.cloudStatusOverride.state, window.cloudStatusOverride.text);
            return;
        }

        if (!window.supabase) {
            window.setCloudStatus('error', 'Supabase no cargado');
            return;
        }

        try {
            localStorage.setItem('turnos_sync_test', '1');
            localStorage.removeItem('turnos_sync_test');
        } catch (e) {
            window.setCloudStatus('storage');
            return;
        }

        try {
            const { error } = await window.supabase
                .from('turnos')
                .select('fecha', { count: 'exact', head: true })
                .limit(1);
            if (error) throw error;
            window.setCloudStatus('ok');
        } catch (e) {
            window.setCloudStatus('error');
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        window.setCloudStatus('connecting');
        let tries = 0;
        const wait = setInterval(() => {
            tries += 1;
            if (window.supabase || tries > 20) {
                clearInterval(wait);
                pingSupabase();
                window._cloudStatusInterval = setInterval(pingSupabase, 60000);
            }
        }, 250);
    });
})();
