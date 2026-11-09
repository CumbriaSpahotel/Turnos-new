const crypto = require('crypto');

class RedsysPayGoldService {
    constructor(config = {}) {
        this.merchantCode = config.merchantCode || '168355840';
        this.terminal = config.terminal || '1';
        this.secretKey = config.secretKey || '';
        this.isProduction = config.isProduction ?? true;
        this.merchantUrl = config.merchantUrl || 'https://www.ecrpaygold.es';
    }

    get endpoint() {
        return this.isProduction
            ? 'https://sis.redsys.es/sis/rest/trataPeticionREST'
            : 'https://sis-t.redsys.es:25443/sis/rest/trataPeticionREST';
    }

    /**
     * Genera un número de pedido válido para Redsys:
     * - Longitud: 4 a 12 caracteres.
     * - Los 4 primeros caracteres DEBEN ser dígitos numéricos.
     */
    generateOrderId() {
        const now = new Date();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const rand = Math.floor(1000 + Math.random() * 9000);
        return `${mm}${dd}${rand}`;
    }

    /**
     * Deriva la clave 3DES usando el número de pedido (Estándar Redsys)
     */
    encryptOrder(order, secretKey) {
        const keyBuffer = Buffer.from(secretKey, 'base64');
        const iv = Buffer.alloc(8, 0); // IV de 8 bytes a cero
        const cipher = crypto.createCipheriv('des-ede3-cbc', keyBuffer, iv);
        cipher.setAutoPadding(true);
        const encrypted = Buffer.concat([
            cipher.update(order, 'utf8'),
            cipher.final()
        ]);
        return encrypted;
    }

    /**
     * Calcula la firma HMAC-SHA256
     */
    calculateSignature(paramsB64, derivedKey) {
        return crypto.createHmac('sha256', derivedKey)
            .update(paramsB64)
            .digest('base64');
    }

    /**
     * Solicita la creación de un enlace de pago PayGold vía REST
     */
    async solicitarEnlace({
        importeEuros,
        concepto = 'Reserva Hotel Guadiana',
        nombreCliente = '',
        telefono = '',
        email = '',
        orderId = null,
        solicitarTokenTarjeta = false,
        caducidadHoras = 24
    }) {
        if (!this.secretKey) {
            throw new Error('Falta la clave secreta de Redsys (SHA-256). Consulta el panel de administración de Redsys.');
        }

        const order = orderId || this.generateOrderId();
        const amountCents = Math.round(Number(importeEuros) * 100).toString();

        if (isNaN(amountCents) || Number(amountCents) <= 0) {
            throw new Error('El importe debe ser un número positivo mayor que 0.');
        }

        const merchantParams = {
            DS_MERCHANT_AMOUNT: amountCents,
            DS_MERCHANT_CURRENCY: '978', // EUR
            DS_MERCHANT_MERCHANTCODE: this.merchantCode,
            DS_MERCHANT_TERMINAL: this.terminal,
            DS_MERCHANT_TRANSACTIONTYPE: 'F', // 'F' = PayGold
            DS_MERCHANT_ORDER: order,
            DS_MERCHANT_MERCHANTURL: this.merchantUrl
        };

        if (telefono && String(telefono).trim()) {
            merchantParams.DS_MERCHANT_CUSTOMER_MOBILE = String(telefono).trim();
        }

        if (email && String(email).trim()) {
            merchantParams.DS_MERCHANT_CUSTOMER_MAIL = String(email).trim();
        }

        if (solicitarTokenTarjeta) {
            merchantParams.DS_MERCHANT_IDENTIFIER = 'REQUIRED';
        }

        // Caducidad personalizada (opcional)
        if (caducidadHoras && Number(caducidadHoras) > 0) {
            const expiry = new Date(Date.now() + caducidadHoras * 3600 * 1000);
            const pad = n => String(n).padStart(2, '0');
            const pad3 = n => String(n).padStart(3, '0');
            merchantParams.DS_MERCHANT_P2F_EXPIRYDATE = `${expiry.getFullYear()}-${pad(expiry.getMonth() + 1)}-${pad(expiry.getDate())}-${pad(expiry.getHours())}.${pad(expiry.getMinutes())}.${pad(expiry.getSeconds())}.${pad3(expiry.getMilliseconds())}`;
        }

        // Datos personalizados para email/SMS
        if (nombreCliente || concepto) {
            merchantParams.DS_MERCHANT_P2F_XMLDATA = `<![CDATA[<nombreComprador>${nombreCliente || 'Huésped'}</nombreComprador><textoLibre1>${concepto}</textoLibre1><subjectMailCliente>${concepto}</subjectMailCliente>]]>`;
        }

        // Codificación y firma
        const paramsB64 = Buffer.from(JSON.stringify(merchantParams)).toString('base64');
        const derivedKey = this.encryptOrder(order, this.secretKey);
        const signature = this.calculateSignature(paramsB64, derivedKey);

        const requestBody = {
            Ds_SignatureVersion: 'HMAC_SHA256_V1',
            Ds_MerchantParameters: paramsB64,
            Ds_Signature: signature
        };

        const res = await fetch(this.endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        const rawJson = await res.json();

        if (rawJson.Ds_MerchantParameters) {
            const decoded = JSON.parse(Buffer.from(rawJson.Ds_MerchantParameters, 'base64').toString('utf8'));
            const isSuccess = decoded.Ds_Response === '9998'; // 9998 indica que el enlace Paygold se generó correctamente

            return {
                ok: isSuccess,
                order: order,
                urlPago: decoded.Ds_UrlPago2Fases || null,
                responseCode: decoded.Ds_Response,
                amountEuros: (Number(decoded.Ds_Amount) / 100).toFixed(2),
                raw: decoded,
                mensaje: isSuccess ? 'Enlace generado con éxito' : `Respuesta Redsys: ${decoded.Ds_Response}`
            };
        } else if (rawJson.errorCode) {
            return {
                ok: false,
                order: order,
                errorCode: rawJson.errorCode,
                mensaje: this.explainError(rawJson.errorCode)
            };
        }

        return {
            ok: false,
            order: order,
            mensaje: 'Respuesta inesperada del servidor de Redsys',
            raw: rawJson
        };
    }

    explainError(code) {
        const errors = {
            'SIS0324': 'Imposible enviar el link al titular (comprueba teléfono o email).',
            'SIS0325': 'El PayGold ya ha finalizado o no existe fase inicial.',
            'SIS0487': 'El comercio o terminal no tiene habilitado el método PayGold.',
            'SIS0042': 'Firma de la petición incorrecta (comprueba la clave secreta).',
            'SIS0018': 'FUC o Terminal no existen o inactivos.',
            'SIS0019': 'Error en el formato del número de pedido (debe empezar por 4 dígitos).'
        };
        return errors[code] || `Error Redsys ${code}`;
    }
}

module.exports = RedsysPayGoldService;
