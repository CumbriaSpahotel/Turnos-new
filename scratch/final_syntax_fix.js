
const fs = require('fs');

const filePath = 'admin.js';
let content = fs.readFileSync(filePath, 'utf8');

// Fix the literal \\n\\n before renderPreview
content = content.replace(/\\\\n\\\\nwindow\.renderPreview = async \(\) => {/g, '\\n\\nwindow.renderPreview = async () => {');

fs.writeFileSync(filePath, content, 'utf8');
console.log("admin.js syntax fixed.");
