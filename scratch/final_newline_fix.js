
const fs = require('fs');

const filePath = 'admin.js';
let content = fs.readFileSync(filePath, 'utf8');

// Replace literal "\n\n" with real newlines
content = content.replace(/\\n\\nwindow\.renderPreview/g, '\n\nwindow.renderPreview');

fs.writeFileSync(filePath, content, 'utf8');
console.log("admin.js syntax fixed: Literal newlines replaced with real ones.");
