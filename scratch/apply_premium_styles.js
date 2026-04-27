
const fs = require('fs');

const htmlPath = 'admin.html';
let html = fs.readFileSync(htmlPath, 'utf8');

// Update CSS for Premium Dashboard Prompt
const premiumStyles = `
    /* ESTILOS PREMIUM DASHBOARD PROMPT */
    .nav-toolbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: #ffffff;
        padding: 12px 24px;
        border-bottom: 1px solid #e0e0e0;
        box-shadow: 0 2px 10px rgba(0,0,0,0.02);
        margin-bottom: 20px;
        position: sticky;
        top: 0;
        z-index: 100;
    }
    .nav-group {
        display: flex;
        align-items: center;
        gap: 10px;
    }
    .nav-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 38px;
        height: 38px;
        border-radius: 8px; /* Solicitado: 8px */
        border: 1px solid #e0e0e0;
        background: #f8f9fa; /* Solicitado: #f8f9fa */
        color: #1e293b;
        cursor: pointer;
        transition: all 0.2s ease-in-out;
    }
    .nav-btn:hover {
        background: #e9ecef; /* Gris más oscuro */
        border-color: #1a73e8;
        color: #1a73e8;
    }
    .nav-btn-text {
        padding: 0 16px;
        height: 38px;
        border-radius: 8px;
        font-size: 0.8rem;
        font-weight: 600;
        border: 1px solid #e0e0e0;
        background: #f8f9fa;
        cursor: pointer;
        transition: all 0.2s ease;
    }
    .nav-btn-text:hover {
        background: #e9ecef;
    }
    .nav-date-indicator {
        font-size: 1rem;
        font-weight: 800;
        color: #1e293b;
        text-align: center;
        min-width: 250px;
    }
    .nav-toggle-group {
        display: flex;
        background: #f1f5f9;
        padding: 4px;
        border-radius: 10px;
        border: 1px solid #e2e8f0;
    }
    .nav-toggle-btn {
        padding: 6px 16px;
        border-radius: 6px;
        font-size: 0.75rem;
        font-weight: 700;
        border: none;
        background: transparent;
        color: #64748b;
        cursor: pointer;
        transition: all 0.2s ease;
    }
    .nav-toggle-btn.active {
        background: #1a73e8; /* Solicitado: Azul #1a73e8 */
        color: white;
        box-shadow: 0 2px 6px rgba(26,115,232,0.3);
    }
    .nav-calendar-trigger {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 38px;
        height: 38px;
        border-radius: 8px;
        background: #f8f9fa;
        color: #64748b;
        border: 1px solid #e0e0e0;
        cursor: pointer;
        transition: all 0.2s ease;
    }
    .nav-calendar-trigger:hover {
        color: #1a73e8;
        border-color: #1a73e8;
        background: white;
    }
`;

// Replace existing styles if any, or add new ones
if (html.includes('/* ESTILOS PREMIUM NAVEGACIÓN */')) {
    html = html.replace(/<style>[\s\S]*?\/\* ESTILOS PREMIUM NAVEGACIÓN \*\/[\s\S]*?<\/style>/, `<style>${premiumStyles}</style>`);
} else if (html.includes('/* ESTILOS PREMIUM DASHBOARD PROMPT */')) {
     html = html.replace(/<style>[\s\S]*?\/\* ESTILOS PREMIUM DASHBOARD PROMPT \*\/[\s\S]*?<\/style>/, `<style>${premiumStyles}</style>`);
}

fs.writeFileSync(htmlPath, html, 'utf8');
console.log("admin.html updated: Premium Dashboard styles applied.");
