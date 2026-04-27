
const fs = require('fs');

const filePath = 'admin.js';
let content = fs.readFileSync(filePath, 'utf8');

// 1. CLEAN UP Global State declarations
content = content.replace('window._fpWeek = null;', '');
content = content.replace('window._fpMonth = null;', '');

// 2. FIX synchronization logic in navigateToday and navigatePreview
const syncOldWeekly = "if (window._previewMode === 'weekly' && window._fpWeek) window._fpInstance.setDate(window._previewDate);";
const syncNewWeekly = "if (window._previewMode === 'weekly' && window._fpInstance) window._fpInstance.setDate(window._previewDate);";
content = content.replace(syncOldWeekly, syncNewWeekly);

const syncOldMonthly = "if (window._previewMode === 'monthly' && window._fpMonth) window._fpInstance.setDate(window._previewDate);";
const syncNewMonthly = "if (window._previewMode === 'monthly' && window._fpInstance) window._fpInstance.setDate(window._previewDate);";
content = content.replace(syncOldMonthly, syncNewMonthly);

// Also check navigateToday (similar logic)
content = content.replace("if (window._previewMode === 'weekly' && window._fpWeek) {", "if (window._previewMode === 'weekly' && window._fpInstance) {");
content = content.replace("window._fpWeek.setDate(window._previewDate);", "window._fpInstance.setDate(window._previewDate);");
content = content.replace("} else if (window._previewMode === 'monthly' && window._fpMonth) {", "} else if (window._previewMode === 'monthly' && window._fpInstance) {");
content = content.replace("window._fpMonth.setDate(window._previewDate);", "window._fpInstance.setDate(window._previewDate);");

fs.writeFileSync(filePath, content, 'utf8');
console.log("admin.js updated: Sync logic fully migrated to window._fpInstance.");
