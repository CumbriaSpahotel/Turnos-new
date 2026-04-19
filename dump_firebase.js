const fs = require('fs');

// The project has firebase-config.js which points to turnosweb-7e927. 
// However, since we don't have the server key, we can use the firebase REST API.
const https = require('https');

https.get('https://turnosweb-7e927-default-rtdb.europe-west1.firebasedatabase.app/turnosweb/data.json', (res) => {
    let data = '';
    res.on('data', (c) => data += c);
    res.on('end', () => {
        fs.writeFileSync('c:\\Users\\comun\\Documents\\GitHub\\Turnos-new\\fb_dump.json', data);
        console.log('Firebase dumped.');
    });
}).on('error', (e) => console.error(e));
