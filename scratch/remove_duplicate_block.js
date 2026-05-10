/**
 * Removes the duplicate/orphaned block that was injected between
 * validatePublishChanges and validateSystemHealth, starting at line ~5710.
 * The block is the closing of showPublishPreview and a second publishToSupabase + validatePublishChanges.
 */
const fs = require('fs');
let content = fs.readFileSync('admin.js', 'utf8');

// The duplicate starts after validatePublishChanges's return statement (around line 5710)
// and ends before validateSystemHealth (around line 5860).
// 
// Pattern: validatePublishChanges ends with "return errors;\n};"
// Then the duplicate block starts with "\n    // 3. Validar Snapshot (Bloqueante)"
// and ends before "    /**\n     * TAREA CODEX" comment or "window.validateSystemHealth"

const DUP_START = '\n    // 3. Validar Snapshot (Bloqueante)\n    const validation = await window.validatePublicationSnapshot(snapshots);\n';
const startIdx = content.indexOf(DUP_START);

if (startIdx < 0) {
    console.log('Duplicate block start NOT FOUND — may already be removed');
    process.exit(0);
}

// Find where the duplicate ends — look for the second definition of validateSystemHealth
// or the comment block before it
const HEALTH_MARKER = 'window.validateSystemHealth = async (weekStartOrContext) => {';
const healthIdx = content.indexOf(HEALTH_MARKER);

if (healthIdx < 0) {
    console.log('validateSystemHealth NOT FOUND');
    process.exit(1);
}

// The duplicate block is between startIdx and the start of validateSystemHealth
// We want to keep everything before startIdx and everything from healthIdx onwards
const before = content.substring(0, startIdx);
const after = content.substring(healthIdx);

// Verify
console.log('Before ends with:', JSON.stringify(before.substring(before.length - 100)));
console.log('After starts with:', JSON.stringify(after.substring(0, 100)));
console.log('Duplicate block length:', healthIdx - startIdx, 'chars');

content = before + '\n\n' + after;
fs.writeFileSync('admin.js', content, 'utf8');
console.log('Duplicate block removed. File saved.');
