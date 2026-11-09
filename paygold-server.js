const http = require('http');
const fs = require('fs');
const path = require('path');
const RedsysPayGoldService = require('./paygold-service');
const initialConfig = require('./paygold-config');

const PORT = process.env.PORT || 3030;
const HISTORY_FILE = path.join(__dirname, 'data', 'paygold_history.json');

// Cargar o inicializar historial
function loadHistory() {
    try {
        if (!fs.existsSync(HISTORY_FILE)) {
            fs.mkdirSync(path.dirname(HISTORY_FILE), { recursive: true });
            fs.writeFileSync(HISTORY_FILE, '[]', 'utf8');
            return [];
        }
        return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
    } catch {
        return [];
    }
}

function saveHistoryItem(item) {
    try {
        const history = loadHistory();
        history.unshift(item);
        if (history.length > 100) history.pop();
        fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), 'utf8');
    } catch (e) {
        console.error('Error guardando historial:', e);
    }
}

// Cargar .env si existe
if (fs.existsSync('.env')) {
    try {
        const envContent = fs.readFileSync('.env', 'utf8');
        envContent.split('\n').forEach(line => {
            const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
            if (m) {
                const key = m[1];
                let val = m[2] || '';
                if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
                process.env[key] = val;
            }
        });
    } catch {}
}

const server = http.createServer(async (req, res) => {
    // CORS headers para permitir llamadas locales
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
    const pathname = parsedUrl.pathname;

    // 1. Servir interfaz de PayGold
    if (pathname === '/' || pathname === '/paygold' || pathname === '/paygold.html') {
        const htmlPath = path.join(__dirname, 'paygold.html');
        if (fs.existsSync(htmlPath)) {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            fs.createReadStream(htmlPath).pipe(res);
            return;
        }
    }

    // 2. API Config
    if (pathname === '/api/paygold/config' && req.method === 'GET') {
        const hasKey = Boolean(process.env.REDSYS_SECRET_KEY || initialConfig.secretKey);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            merchantCode: process.env.REDSYS_MERCHANT_CODE || initialConfig.merchantCode,
            terminal: process.env.REDSYS_TERMINAL || initialConfig.terminal,
            merchantName: initialConfig.merchantName,
            isProduction: process.env.REDSYS_ENVIRONMENT ? process.env.REDSYS_ENVIRONMENT !== 'test' : initialConfig.isProduction,
            hasKey: hasKey
        }));
        return;
    }

    // 3. API Historial
    if (pathname === '/api/paygold/history' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(loadHistory()));
        return;
    }

    // 4. API Guardar Clave
    if (pathname === '/api/paygold/save-key' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const { secretKey, isProduction } = JSON.parse(body);
                if (secretKey) {
                    process.env.REDSYS_SECRET_KEY = secretKey.trim();
                }
                if (typeof isProduction === 'boolean') {
                    process.env.REDSYS_ENVIRONMENT = isProduction ? 'production' : 'test';
                }

                // Guardar en .env
                let env = '';
                if (fs.existsSync('.env')) env = fs.readFileSync('.env', 'utf8');
                const updateEnvVar = (name, val) => {
                    const regex = new RegExp(`^${name}=.*$`, 'm');
                    if (regex.test(env)) {
                        env = env.replace(regex, `${name}=${val}`);
                    } else {
                        env += `\n${name}=${val}`;
                    }
                };
                if (secretKey) updateEnvVar('REDSYS_SECRET_KEY', secretKey.trim());
                if (typeof isProduction === 'boolean') updateEnvVar('REDSYS_ENVIRONMENT', isProduction ? 'production' : 'test');
                fs.writeFileSync('.env', env.trim() + '\n', 'utf8');

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: true, message: 'Configuración guardada correctamente en .env' }));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: false, error: err.message }));
            }
        });
        return;
    }

    // 5. API Crear Enlace de Pago
    if (pathname === '/api/paygold/create' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const payload = JSON.parse(body);
                const activeKey = payload.secretKey || process.env.REDSYS_SECRET_KEY || initialConfig.secretKey;
                const isProd = typeof payload.isProduction === 'boolean' 
                    ? payload.isProduction 
                    : (process.env.REDSYS_ENVIRONMENT ? process.env.REDSYS_ENVIRONMENT !== 'test' : initialConfig.isProduction);

                const service = new RedsysPayGoldService({
                    merchantCode: process.env.REDSYS_MERCHANT_CODE || initialConfig.merchantCode,
                    terminal: process.env.REDSYS_TERMINAL || initialConfig.terminal,
                    secretKey: activeKey,
                    isProduction: isProd,
                    merchantUrl: initialConfig.merchantUrl
                });

                const result = await service.solicitarEnlace({
                    importeEuros: payload.importe,
                    concepto: payload.concepto || 'Reserva Hotel Guadiana',
                    nombreCliente: payload.nombreCliente || '',
                    telefono: payload.telefono || '',
                    email: payload.email || '',
                    solicitarTokenTarjeta: Boolean(payload.solicitarToken),
                    caducidadHoras: payload.caducidadHoras || 24
                });

                if (result.ok) {
                    saveHistoryItem({
                        id: result.order,
                        fecha: new Date().toISOString(),
                        importe: payload.importe,
                        concepto: payload.concepto || 'Cobro Hotel Guadiana',
                        cliente: payload.nombreCliente || 'No especificado',
                        telefono: payload.telefono || null,
                        email: payload.email || null,
                        urlPago: result.urlPago,
                        entorno: isProd ? 'Producción' : 'Pruebas'
                    });
                }

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result));
            } catch (err) {
                console.error('[PayGold ERROR]', err);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: false, mensaje: err.message }));
            }
        });
        return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
});

server.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`💳 SERVIDOR PAYGOLD HOTEL GUADIANA ACTIVO`);
    console.log(`📍 Acceso web: http://localhost:${PORT}`);
    console.log(`🏢 Comercio: 168355840 | Terminal 1`);
    console.log(`======================================================\n`);
});
