const fs = require('fs');
const path = 'c:/Users/comun/Documents/GitHub/Turnos-new/admin.js';
let content = fs.readFileSync(path, 'utf8');

// The block to replace starts at the first showPublishPreview and ends just before showPublishNotification
const startSearch = 'window.showPublishPreview = async (targetHotel = null, targetWeekStart = null) => {';
const endSearch = 'window.showPublishNotification = function';

const firstIndex = content.indexOf(startSearch);
const lastIndex = content.lastIndexOf(endSearch);

if (firstIndex !== -1 && lastIndex !== -1) {
    const newBlock = `window.showPublishPreview = async (targetHotel = null, targetWeekStart = null) => {
    // 1. Identificar rango y hotel
    const hotelSel = targetHotel || $('#prevHotel')?.value || 'all';
    const rawDate = targetWeekStart || window._previewDate;
    
    const base = new Date(rawDate + 'T12:00:00');
    const weekStart = window.isoDate(window.getMonday(base));
    
    // Almacenar para persistencia robusta
    window._publishTargetHotel = hotelSel;
    window._publishTargetWeek = weekStart; 
    
    console.log("[PUBLISH_PREVIEW] target resolved", { hotelSel, weekStart });
    const weekEnd = window.addIsoDays(weekStart, 6);

    console.log("[PUBLISH_PREVIEW] dates", { weekStart, weekEnd });

    // 2. Generar Snapshot Preview
    let snapshots = [];
    try {
        console.log("[PUBLISH_PREVIEW] building snapshot for", { weekStart, hotelSel });
        snapshots = await window.buildPublicationSnapshotPreview(weekStart, hotelSel);
    } catch (e) {
        console.error("[PUBLISH_PREVIEW] Error building snapshot:", e);
        window.showPublishNotification({ type: 'error', title: 'Error al generar previsualización', message: e.message });
        return;
    }

    if (snapshots.length === 0) {
        console.warn("[PUBLISH_PREVIEW] No snapshots returned for", { weekStart, hotelSel });
        window.showPublishNotification({ type: 'warning', title: 'Sin datos', message: 'No hay datos operativos para publicar en esta selección.' });
        return;
    }

    // 3. Validar Snapshot
    const validation = await window.validatePublicationSnapshot(snapshots);
    const cleanValidationMessage = (msg) => {
        const c = (...codes) => String.fromCharCode(...codes);
        return String(msg || '')
            .replaceAll(c(0x00f0, 0x0178, 0x201d, 0x201e), 'cambio')
            .replaceAll(c(0x00e2, 0x2020, 0x201d), '<->')
            .replaceAll(c(0x00e2, 0x2020, 0x2019), '<->')
            .replaceAll(c(0x00e2, 0x20ac, 0x201d), '-');
    };

    // 4. Mostrar Modal con Resultado
    const modalId = 'publishPreviewModal';
    let modal = document.getElementById(modalId);
    if (!modal) {
        modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'drawer-overlay';
        modal.style.display = 'none';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
        modal.style.zIndex = '10000';
        modal.onclick = () => modal.classList.remove('open');
        document.body.appendChild(modal);
    }

    const hotelSummary = snapshots.map(s => \`
        <div style="background: white; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 8px; display: flex; justify-content: space-between;">
            <span style="font-weight: 700; color: #0f172a;">\${s.hotel_nombre}</span>
            <span style="background: #f1f5f9; padding: 2px 8px; border-radius: 12px; font-size: 0.7rem; font-weight: 700;">\${s.rows.length} empleados</span>
        </div>
    \`).join('');

    const validationHtml = validation.ok
        ? \`<div style="background: #f0fdf4; border: 1px solid #bbf7d0; color: #15803d; padding: 16px; border-radius: 12px; margin-bottom: 24px; display: flex; align-items: center; gap: 12px;">
             <i class="fas fa-check-circle"></i>
             <div>
                <strong>Integridad Validada</strong>
                <span style="font-size: 0.85rem;">El snapshot cumple con todas las reglas de protección.</span>
             </div>
           </div>\`
        : \`<div style="background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c; padding: 16px; border-radius: 12px; margin-bottom: 24px;">
             <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                <i class="fas fa-times-circle" style="font-size: 1.2rem;"></i>
                <strong>Errores Críticos Detectados</strong>
             </div>
             <ul style="margin: 0; padding-left: 20px; font-size: 0.85rem; line-height: 1.5;">
                \${validation.errors.map(e => \\\`<li>\\\${cleanValidationMessage(e)}</li>\\\`).join('')}
             </ul>
           </div>\`;

    const visibleWarnings = validation.warnings.filter(w => !window.isPublicationWarningAuthorized(w, snapshots));
    const authorizedWarningsCount = validation.warnings.length - visibleWarnings.length;
    window._pendingPublicationWarningSnapshots = snapshots;
    window._pendingPublicationWarnings = visibleWarnings;
    
    const warningsHtml = visibleWarnings.length > 0
        ? \`<div style="background: #fffbeb; border: 1px solid #fef3c7; color: #b45309; padding: 16px; border-radius: 12px; margin-bottom: 24px;">
             <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                <i class="fas fa-exclamation-triangle" style="font-size: 1.1rem;"></i>
                <strong style="font-size: 0.9rem;">Advertencias de Cobertura</strong>
             </div>
             <ul style="margin: 0; padding-left: 20px; font-size: 0.8rem; opacity: 0.9;">
                \${visibleWarnings.slice(0, 5).map(w => \\\`<li>\\\${cleanValidationMessage(w)}</li>\\\`).join('')}
                \${visibleWarnings.length > 5 ? \\\`<li>... y \\\${visibleWarnings.length - 5} avisos más.</li>\\\` : ''}
             </ul>
           </div>\`
        : '';
        
    const authorizedWarningsHtml = authorizedWarningsCount > 0
        ? \`<div style="background:#eff6ff;border:1px solid #dbeafe;color:#1e40af;padding:10px 12px;border-radius:10px;margin-bottom:16px;font-size:0.78rem;font-weight:700;">
             \${authorizedWarningsCount} advertencia\${authorizedWarningsCount === 1 ? '' : 's'} ya autorizada\${authorizedWarningsCount === 1 ? '' : 's'} para esta semana. No se volverán a tratar como pendiente.
           </div>\`
        : '';

    modal.innerHTML = \`
        <div class="drawer-content" style="max-width: 600px; padding: 0; border-radius: 24px; overflow: hidden; background: #f8fafc;">
            <header style="padding: 24px 32px; background: #0f172a; color: white;">
                <h2 id="snapshotPublishTitle" style="margin: 0; font-size: 1.25rem;">Publicar Snapshot de Turnos</h2>
                <p style="margin: 4px 0 0 0; font-size: 0.85rem; opacity: 0.8;">Semana del \${weekStart} al \${weekEnd}</p>
            </header>

            <div style="padding: 32px; overflow-y: auto; max-height: 65vh;">
                \${validationHtml}
                \${authorizedWarningsHtml}
                \${warningsHtml}

                <section style="margin-bottom: 24px;">
                    <h3 style="font-size: 0.85rem; font-weight: 800; color: #64748b; text-transform: uppercase; margin-bottom: 12px; letter-spacing: 0.05em;">Hoteles Incluidos</h3>
                    \${hotelSummary}
                </section>

                <div style="background: #eff6ff; border: 1px solid #dbeafe; padding: 16px; border-radius: 12px; font-size: 0.85rem; color: #1e40af;">
                    <strong>Nota:</strong> Al publicar, se creará una versión inmutable (Snapshot) que será la única fuente de verdad para el Cuadrante Público. Los cambios locales en el Excel también se sincronizarán con la base de datos.
                </div>
            </div>

            <footer style="padding: 24px 32px; background: white; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; gap: 12px;">
                <button onclick="document.getElementById('\${modalId}').classList.remove('open')" style="padding: 12px 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: white; font-weight: 700; cursor: pointer; color: #64748b;">Cancelar</button>
                <button id="btnConfirmPublish"
                        onclick="window.publishToSupabase()"
                        \${!validation.ok ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}
                        style="padding: 12px 32px; border: none; border-radius: 12px; background: #3b82f6; color: white; font-weight: 800; cursor: pointer; box-shadow: 0 4px 10px rgba(59, 130, 246, 0.3);">
                    Confirmar y Publicar
                </button>
            </footer>
        </div>
    \`;
    modal.style.display = 'flex';
    modal.style.justifyContent = 'center'; 
    modal.classList.add('open');
    
    const inner = modal.querySelector('.drawer-content');
    if (inner) {
        inner.style.transform = 'none';
        inner.style.margin = 'auto';
    }
};

/**
 * showPublishNotification — Aviso no bloqueante en Dashboard.
 */
`;
    const finalContent = content.substring(0, firstIndex) + newBlock + content.substring(lastIndex);
    fs.writeFileSync(path, finalContent, 'utf8');
    console.log('REPLACEMENT_SUCCESS');
} else {
    console.log('MARKERS_NOT_FOUND', { firstIndex, lastIndex });
}
