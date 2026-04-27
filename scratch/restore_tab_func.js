const fs = require('fs');
const path = 'c:\\Users\\comun\\Documents\\GitHub\\Turnos-new\\admin.js';
let content = fs.readFileSync(path, 'utf8');

const missingTabFunc = `
window.setEmployeeProfileTab = (tab) => {
    window._employeeProfileTab = tab;
    window.renderEmployeeProfile();
};`;

const marker = 'window.openEmpDrawer =';
if (content.includes(marker) && !content.includes('window.setEmployeeProfileTab =')) {
    content = content.replace(marker, missingTabFunc + '\n\n' + marker);
    fs.writeFileSync(path, content, 'utf8');
    console.log('Restored missing tab function');
} else {
    console.log('Tab function already present or marker not found');
}
