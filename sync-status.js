// sync-status.js
// Global Cloud Connection Indicator Logic (Supabase Edition)
document.addEventListener('DOMContentLoaded', () => {
    const checkSb = setInterval(() => {
        if (window.TurnosDB && window.TurnosDB.client) {
            clearInterval(checkSb);
            
            const syncText = document.getElementById('syncText');
            const syncDot = document.getElementById('syncDot');
            
            let isBlocked = false;
            try {
                localStorage.setItem('local_sync_test', '1');
                localStorage.removeItem('local_sync_test');
            } catch(e) {
                isBlocked = true;
                if (syncText) syncText.innerText = "Almacenamiento Bloqueado";
                if (syncDot) syncDot.style.background = "#ff5f57"; 
            }

            if (!isBlocked) {
                // Estado inicial
                if (syncText) {
                    syncText.innerText = "Supabase Conectado";
                    syncDot.style.background = "#10e898";
                    syncText.parentElement.style.borderColor = "rgba(16,232,152,0.3)";
                    syncText.parentElement.style.background = "rgba(16,232,152,0.05)";
                    syncText.style.color = "#10e898";
                }
                
                // Podríamos añadir un ping real aquí, pero por ahora si el cliente existe, asumimos OK
            }
        }
    }, 500);
});
