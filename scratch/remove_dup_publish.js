/**
 * Fix: Remove the duplicate/broken window.publishToSupabase at line 6188.
 * The real one is at line 5631 (correct, used by showPublishPreview).
 * The second one at 6188 overrides it and has a TDZ bug on weeksAffected.
 * 
 * Also:
 * - Fix "CAMBIOS POR PUBLICAR" counter to count pending events too
 */
const fs = require('fs');
let content = fs.readFileSync('admin.js', 'utf8');
const lines = content.split('\n');

// 1. Find the second publishToSupabase (around line 6188)
let secondStart = -1;
let secondEnd = -1;
for (let i = 6180; i < 6210; i++) {
    if (lines[i] && lines[i].includes('window.publishToSupabase = async ()')) {
        secondStart = i;
        console.log('Found second publishToSupabase at line', i + 1);
        break;
    }
}

if (secondStart < 0) {
    console.error('Could not find second publishToSupabase!');
    process.exit(1);
}

// Find the end of this function: look for the closing '};' at indent level 0
let braceDepth = 0;
let inFunction = false;
for (let i = secondStart; i < lines.length; i++) {
    const line = lines[i];
    // Count braces
    for (const ch of line) {
        if (ch === '{') { braceDepth++; inFunction = true; }
        if (ch === '}') { braceDepth--; }
    }
    if (inFunction && braceDepth === 0) {
        secondEnd = i;
        console.log('Second publishToSupabase ends at line', i + 1);
        break;
    }
}

if (secondEnd < 0) {
    console.error('Could not find end of second publishToSupabase!');
    process.exit(1);
}

// Show what we're removing
console.log('Removing lines', secondStart + 1, 'to', secondEnd + 1, '(' + (secondEnd - secondStart + 1) + ' lines)');
console.log('First line:', lines[secondStart].trim());
console.log('Last line:', lines[secondEnd].trim());

// Replace the duplicate function with a comment
const REPLACEMENT = [
    '// [REMOVED] Duplicate window.publishToSupabase was here.',
    '// The real implementation is at the function defined above (showPublishPreview flow).',
    '// This duplicate had a TDZ bug on `weeksAffected` and was overriding the correct function.',
];

lines.splice(secondStart, secondEnd - secondStart + 1, ...REPLACEMENT);
console.log('Removed', (secondEnd - secondStart + 1), 'lines, replaced with', REPLACEMENT.length, 'comment lines');

content = lines.join('\n');
fs.writeFileSync('admin.js', content, 'utf8');
console.log('\nFile saved. New total lines:', content.split('\n').length);
console.log('File size:', fs.statSync('admin.js').size, 'bytes');
