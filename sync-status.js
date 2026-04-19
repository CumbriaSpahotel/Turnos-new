// sync-status.js
// Global Cloud Connection Indicator Logic
document.addEventListener('DOMContentLoaded', () => {
    const checkFb = setInterval(() => {
        if (window.firebase && firebase.apps && firebase.apps.length > 0) {
            clearInterval(checkFb);
            
            const syncText = document.getElementById('syncText');
            const syncDot = document.getElementById('syncDot');
            
            let isBlocked = false;
            try {
                localStorage.setItem('local_sync_test', '1');
                localStorage.removeItem('local_sync_test');
            } catch(e) {
                isBlocked = true;
                if (syncText) syncText.innerText = "Almacenamiento Bloqueado";
                if (syncDot) syncDot.style.background = "#ff5f57"; // Danger Red
                if (syncText) syncText.parentElement.style.borderColor = "rgba(255,95,87,0.3)";
                if (syncText) syncText.parentElement.style.background = "rgba(255,95,87,0.05)";
                if (syncText) syncText.style.color = "#ff5f57";
            }

            if (!isBlocked) {
                firebase.database().ref('.info/connected').on('value', function(snap) {
                    if (!syncText || !syncDot) return;
                    if (snap.val() === true) {
                        syncText.innerText = "Nube Conectada";
                        syncDot.style.background = "#10e898"; // Success Green
                        syncText.parentElement.style.borderColor = "rgba(16,232,152,0.3)";
                        syncText.parentElement.style.background = "rgba(16,232,152,0.05)";
                        syncText.style.color = "#10e898";
                    } else {
                        syncText.innerText = "Sin Conexión / Revisar Red";
                        syncDot.style.background = "#ffb23f"; // Warning Orange
                        syncText.parentElement.style.borderColor = "rgba(255,178,63,0.3)";
                        syncText.parentElement.style.background = "rgba(255,178,63,0.05)";
                        syncText.style.color = "#ffb23f";
                    }
                });
            }
        }
    }, 500);
});
