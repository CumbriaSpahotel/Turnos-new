const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function padZero(n) {
    return n < 10 ? '0' + n : String(n);
}

function getTodayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${padZero(d.getMonth() + 1)}-${padZero(d.getDate())}`;
}

function getChangedFiles() {
    try {
        const out = execSync('git status --porcelain', { encoding: 'utf8' });
        const files = out.split('\n')
            .filter(line => line.length > 3)
            .map(line => line.slice(3).trim())
            .filter(f => !f.startsWith('REGISTRO_') && !f.endsWith('.log') && !f.startsWith('.gemini'));
        return Array.from(new Set(files));
    } catch {
        return [];
    }
}

function run() {
    const customDesc = process.argv[2] || 'Mejora y actualización del sistema';
    const rootDir = path.resolve(__dirname, '..');
    const registroPath = path.join(rootDir, 'REGISTRO_VERSIONES.md');

    if (!fs.existsSync(registroPath)) {
        console.error('No se encontró REGISTRO_VERSIONES.md en', registroPath);
        process.exit(1);
    }

    let registroContent = fs.readFileSync(registroPath, 'utf8');

    // 1. Extraer versión actual
    const versionMatch = registroContent.match(/\*\*Versión Global Actual:\*\*\s*`v(\d+)\.(\d+)`/);
    if (!versionMatch) {
        console.error('No se pudo encontrar la versión actual en REGISTRO_VERSIONES.md');
        process.exit(1);
    }

    const major = parseInt(versionMatch[1], 10);
    const minor = parseInt(versionMatch[2], 10);
    const newMinor = minor + 1;
    const currentVersionStr = `v${major}.${minor}`;
    const newVersionStr = `v${major}.${newMinor}`;
    const newVersionRaw = `${major}.${newMinor}`;
    const today = getTodayISO();

    console.log(`[BUMP-VERSION] Incrementando versión: ${currentVersionStr} -> ${newVersionStr} (${today})`);

    // 2. Obtener archivos modificados
    const changedFiles = getChangedFiles();
    const changedFilesStr = changedFiles.length > 0 
        ? changedFiles.map(f => `\`${f}\``).join(', ') 
        : 'Módulos del sistema';

    // 3. Actualizar REGISTRO_VERSIONES.md cabecera
    registroContent = registroContent.replace(
        /\*\*Versión Global Actual:\*\*\s*`v\d+\.\d+`/,
        `**Versión Global Actual:** \`${newVersionStr}\``
    );
    registroContent = registroContent.replace(
        /\*\*Última Actualización:\*\*\s*\d{4}-\d{2}-\d{2}/,
        `**Última Actualización:** ${today}`
    );

    // 4. Insertar nueva fila en la tabla de REGISTRO_VERSIONES.md
    const tableHeaderMarker = '| :---: | :---: | :--- | :--- |\n';
    const newRow = `| **\`${newVersionStr}\`** | ${today} | ${changedFilesStr} | ${customDesc} |\n`;

    if (registroContent.includes(tableHeaderMarker)) {
        registroContent = registroContent.replace(tableHeaderMarker, tableHeaderMarker + newRow);
    } else {
        registroContent += `\n${newRow}`;
    }

    fs.writeFileSync(registroPath, registroContent, 'utf8');
    console.log(`[BUMP-VERSION] REGISTRO_VERSIONES.md actualizado.`);

    // 5. Actualizar admin.html
    const adminHtmlPath = path.join(rootDir, 'admin.html');
    if (fs.existsSync(adminHtmlPath)) {
        let adminHtml = fs.readFileSync(adminHtmlPath, 'utf8');
        
        // Reemplazar ?v=... en scripts y links locales
        adminHtml = adminHtml.replace(/((?:src|href)="[^"]+?\.(?:js|css))\?v=[^"&]+/g, `$1?v=${newVersionRaw}`);
        // Reemplazar texto visible de versión en panel
        adminHtml = adminHtml.replace(/v\d+\.\d+\s*\((?:Premium|Sistema)\)/g, `${newVersionStr} (Premium)`);

        fs.writeFileSync(adminHtmlPath, adminHtml, 'utf8');
        console.log(`[BUMP-VERSION] admin.html actualizado con ?v=${newVersionRaw}.`);
    }

    // 6. Actualizar index.html
    const indexHtmlPath = path.join(rootDir, 'index.html');
    if (fs.existsSync(indexHtmlPath)) {
        let indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
        indexHtml = indexHtml.replace(/((?:src|href)="[^"]+?\.(?:js|css))\?v=[^"&]+/g, `$1?v=${newVersionRaw}`);
        indexHtml = indexHtml.replace(/sw\.js\?v=[^'"]+/g, `sw.js?v=${newVersionRaw}`);

        fs.writeFileSync(indexHtmlPath, indexHtml, 'utf8');
        console.log(`[BUMP-VERSION] index.html actualizado con ?v=${newVersionRaw}.`);
    }

    // 7. Actualizar live.mobile.html si existe
    const mobileHtmlPath = path.join(rootDir, 'live.mobile.html');
    if (fs.existsSync(mobileHtmlPath)) {
        let mobileHtml = fs.readFileSync(mobileHtmlPath, 'utf8');
        mobileHtml = mobileHtml.replace(/((?:src|href)="[^"]+?\.(?:js|css))\?v=[^"&]+/g, `$1?v=${newVersionRaw}`);
        mobileHtml = mobileHtml.replace(/sw\.js\?v=[^'"]+/g, `sw.js?v=${newVersionRaw}`);

        fs.writeFileSync(mobileHtmlPath, mobileHtml, 'utf8');
        console.log(`[BUMP-VERSION] live.mobile.html actualizado con ?v=${newVersionRaw}.`);
    }

    console.log(`[BUMP-VERSION] ✅ Versión global fijada en ${newVersionStr} con éxito.`);
}

run();
