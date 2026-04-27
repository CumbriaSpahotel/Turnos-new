
const fs = require('fs');

const filePath = 'admin.js';
let content = fs.readFileSync(filePath, 'utf8');

// The string in the file is literally "\n\nwindow.renderPreview" but where \n are literal backslashes and n.
// No, it's likely "\\n\\nwindow.renderPreview"
// Let's use a very safe replacement.

const badToken = '\\\\n\\\\nwindow.renderPreview = async () => {';
if (content.includes(badToken)) {
    content = content.replace(badToken, '\\n\\nwindow.renderPreview = async () => {');
} else {
    // Try with just one level of escaping if it's already semi-fixed
    const badToken2 = '\\n\\nwindow.renderPreview = async () => {';
    // This is hard to match if it's literal.
    // Let's use a split/join on the name of the function.
}

// Radical fix: find the index of "window.renderPreview" and ensure everything before it is clean.
const target = 'window.renderPreview = async () => {';
const idx = content.indexOf(target);
if (idx !== -1) {
    let before = content.substring(0, idx);
    // Remove trailing backslashes and 'n's
    before = before.replace(/[\\\\n\\s]+$/, '');
    content = before + '\\n\\n' + content.substring(idx);
}

fs.writeFileSync(filePath, content, 'utf8');
console.log("admin.js syntax fixed radically.");
