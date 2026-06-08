const fs = require('fs');
const textTest = fs.readFileSync('admin_test.js', 'utf8');
const textAdmin = fs.readFileSync('admin.js', 'utf8');

const startIndex = textTest.indexOf('// 6B. EMPLEADOS - LISTADO OPERATIVO EN LINEAS');
const endIndex = textTest.indexOf('window.populateEmployees = async () => {', startIndex);

if (startIndex > -1 && endIndex > -1) {
    const missingFunctions = textTest.substring(startIndex, endIndex);
    
    const insertIndex = textAdmin.indexOf('window.populateEmployees = async () => {');
    if (insertIndex > -1) {
        const newAdmin = textAdmin.substring(0, insertIndex) + missingFunctions + '\n' + textAdmin.substring(insertIndex);
        fs.writeFileSync('admin.js', newAdmin);
        console.log("Successfully inserted missing functions into admin.js");
    } else {
        console.log("Could not find insertion point in admin.js");
    }
} else {
    console.log("Could not find the block in admin_test.js");
}
