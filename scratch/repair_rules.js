const fs = require('fs');
const path = 'c:\\Users\\comun\\OneDrive\\Documentos\\GitHub\\Turnos-new\\turnos-rules.js';
let content = fs.readFileSync(path, 'utf8');

// Fix the stray token around line 370
const strayPattern = /}\s*'\);\s*icons\.delete\('📌'\);\s*}/;
if (strayPattern.test(content)) {
    console.log('Found stray token pattern');
    content = content.replace(strayPattern, '}');
} else {
    // Try literal match if regex fails
    const literalStray = "        }');\n            icons.delete('📌');\n        }";
    if (content.includes(literalStray)) {
        console.log('Found literal stray');
        content = content.replace(literalStray, "        }");
    }
}

// Fix the corrupted ending
const corruptedEnd = /if \(hasOperationalTurns\) \{\s*logVisibility\(true, 'ordinary_employee_with_partial_absence'\);\s*re\s*window\.TurnosRules = \{\s*return true;\s*\}\s*logVisibility\(false, 'strict_fallback_false'\);\s*return false;\s*\};/;
const replacementEnd = `if (hasOperationalTurns) {
            logVisibility(true, 'ordinary_employee_with_partial_absence');
            return true;
        }
        logVisibility(false, 'no_operational_turns_or_total_absence');
        return false;
    };`;

if (corruptedEnd.test(content)) {
    console.log('Found corrupted end pattern');
    content = content.replace(corruptedEnd, replacementEnd);
} else {
    // More flexible match for the corrupted end
    const lines = content.split('\n');
    let startLine = -1;
    let endLine = -1;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('if (hasOperationalTurns)') && lines[i+1]?.includes('logVisibility(true')) {
            startLine = i;
        }
        if (startLine !== -1 && lines[i].includes('window.TurnosRules = {') && lines[i-1]?.includes('return false;')) {
             // This might be the SECOND TurnosRules assignment
             endLine = i - 1;
             break;
        }
    }
    if (startLine !== -1 && endLine !== -1) {
        console.log(`Found corrupted block from line ${startLine+1} to ${endLine+1}`);
        lines.splice(startLine, endLine - startLine + 1, replacementEnd);
        content = lines.join('\n');
    }
}

fs.writeFileSync(path, content, 'utf8');
console.log('Done fixing turnos-rules.js');
