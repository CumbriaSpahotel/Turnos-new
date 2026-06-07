const fs = require('fs');
let admin = fs.readFileSync('admin.js', 'utf8');

// The literal strings currently in the file are `\\n`
admin = admin.replace(/\] \|\| \[\];\\n                const combined/g, '] || [];\n                const combined');
admin = admin.replace(/;\\n                const weekSeed/g, ';\n                const weekSeed');
admin = admin.replace(/if \(!s\) return;\\n                    if \(s/g, 'if (!s) return;\n                    if (s');
admin = admin.replace(/count\\n                    const/g, 'count\n                    const');

fs.writeFileSync('admin.js', admin);
console.log('Fixed \\n syntax error');
