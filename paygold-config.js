// Configuración PayGold - Hotel Guadiana
module.exports = {
    merchantCode: process.env.REDSYS_MERCHANT_CODE || '168355840',
    terminal: process.env.REDSYS_TERMINAL || '1',
    merchantName: 'HOTEL GUADIANA',
    merchantEmail: 'administracion@hotelguadiana.es',
    merchantUrl: 'https://www.ecrpaygold.es',
    // Clave secreta SHA-256 en Base64 (proporcionada en el portal de Redsys)
    secretKey: process.env.REDSYS_SECRET_KEY || '',
    // Entorno: true para producción (Real), false para entorno de pruebas
    isProduction: process.env.REDSYS_ENVIRONMENT !== 'test'
};
