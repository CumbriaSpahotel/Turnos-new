const fs = require('fs');
const path = 'c:/Users/comun/OneDrive/Documentos/GitHub/Turnos-new/admin.js';
let content = fs.readFileSync(path, 'utf8');

// Purge any string that looks like mojibake (long sequences of Ã and other non-ASCII)
// This is aggressive but necessary for this file.
content = content.replace(/Ãƒ[A-Za-z0-9ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ã‚Â¡Ãƒâ€ Ã¢â‚¬â„¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ã‚Â½ÃƒÂ Ã‚Â¯\?Ã‚Â·Ã‚Â¸\—\s?]+/g, (match) => {
    if (match.length > 5) return '—';
    return match;
});

// Specifically fix the ones I saw in the last view_file
content = content.replace(/ÃƒÂ Ã‚Â¯\?ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â Ã¢â‚¬â„¢—ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡— /g, '—');

// Restore some valid Spanish characters that might have been hit
// (Though in this file, most 'Ã' are mojibake)
content = content.replace(/NAVEGACI—N/g, 'NAVEGACIÓN');
content = content.replace(/configuraci—n/g, 'configuración');
content = content.replace(/publicaci—n/g, 'publicación');

fs.writeFileSync(path, content, 'utf8');
console.log('Admin.js final mojibake purge complete.');
