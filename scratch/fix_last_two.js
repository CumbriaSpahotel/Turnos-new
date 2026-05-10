const fs = require('fs');
let c = fs.readFileSync('admin.js', 'utf8');
const lines = c.split('\n');
let changed = 0;

for (let i = 0; i < lines.length; i++) {
    // Fix L4114 area: the raw.includes check for mojibake detection in formatDisplayName
    if (lines[i] && lines[i].includes('raw.includes') && lines[i].includes('Ã¢') && i > 4100 && i < 4130) {
        console.log('Before L'+(i+1)+':', lines[i].substring(0, 100));
        // Replace with a cleaner version using unicode escapes for the bytes we're detecting
        lines[i] = lines[i].replace(
            /raw\.includes\('[^\)]+'\) \|\| raw\.includes\('[^\)]+'\) \|\| raw\.includes\('[^\)]+'\)/,
            "raw.includes('\\u00c3\\u00a2') || raw.includes('\\u00ef\\u00bf\\u00bd')"
        );
        if (!lines[i].includes('Ã¢')) {
            console.log('After:', lines[i].substring(0, 100));
            changed++;
        } else {
            // Direct replacement
            const badPart = lines[i].match(/raw\.includes\('[^']+'\) \|\| raw\.includes\('[^']+'\) \|\| raw\.includes\('[^']+'\)/);
            if (badPart) {
                lines[i] = lines[i].replace(badPart[0], "raw.includes('\u00c3\u00a2') || raw.includes('\ufffd')");
                console.log('After(direct):', lines[i].substring(0, 100));
                changed++;
            }
        }
    }
    
    // Fix L5750 area: MOJIBAKE_RE regex with literal corrupted chars
    if (lines[i] && lines[i].includes('MOJIBAKE_RE') && i > 5740 && i < 5760) {
        console.log('MOJIBAKE_RE L'+(i+1)+':', lines[i]);
        lines[i] = "        const MOJIBAKE_RE = /\u00c3[\u00c2\u0192\u00b1\u00a9\u00b3\u00a1]|\u00c2[\u00b0\u00b7\u00aa\u00ba]|\uFFFD/;";
        console.log('Fixed to:', lines[i]);
        changed++;
    }
}

c = lines.join('\n');
fs.writeFileSync('admin.js', c, 'utf8');
console.log('Changed', changed, 'lines');
