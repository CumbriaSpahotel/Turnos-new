require('dotenv').config();
const fs = require('fs');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const IMPORTER_VERSION = '1.0.0';
const VALIDATION_SCHEMA_VERSION = '1.0.0';

// Centralized Canonical Normalization Logic
function buildCanonicalPayload(rows) {
    if (!Array.isArray(rows)) return '[]';
    
    // Sort primarily by employee_id as text
    const sorted = [...rows].sort((a, b) => String(a.employee_id || '').trim().localeCompare(String(b.employee_id || '').trim()));
    
    const canonicalRows = sorted.map(row => {
        // Exclude employee_name from payload, normalize boolean, decimals, dates
        let legacyReviewed = row.legacy_adjustment_reviewed;
        if (typeof legacyReviewed === 'string') legacyReviewed = legacyReviewed.trim().toUpperCase() === 'YES' ? 'YES' : 'NO';
        
        let legacyIncluded = row.legacy_adjustment_included;
        if (typeof legacyIncluded === 'string') legacyIncluded = legacyIncluded.trim().toUpperCase() === 'YES' ? 'YES' : 'NO';

        return {
            employee_id: String(row.employee_id || '').trim(),
            cutoff_date: String(row.cutoff_date || '').trim(), // e.g. YYYY-MM-DD
            vacation_year: Number(row.vacation_year),
            opening_balance_days: Number(row.opening_balance_days || 0).toFixed(2),
            annual_entitlement_days: Number(row.annual_entitlement_days || 0).toFixed(2),
            legacy_adjustment_reviewed: legacyReviewed,
            legacy_adjustment_included: legacyIncluded,
            justification: String(row.justification || "").trim()
        };
    });
    
    // Serialize to UTF-8 JSON without extra spaces
    return JSON.stringify(canonicalRows);
}

function computeSha256(content) {
    return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

async function runCli() {
    const args = process.argv.slice(2);
    
    // Offline validation mode
    if (args.includes('--offline-test')) {
        console.log('[CLI] Running in offline validation mode. No remote connections will be made.');
        const url = process.env.SUPABASE_LOCAL_URL || process.env.SUPABASE_URL;
        if (!url) {
            console.error('[CLI-ERROR] Variable de URL ausente.');
            process.exit(1);
        }
        if (url.includes('supabase.co') || url.includes('supabase.in')) {
            console.error('[CLI-ERROR] URL con supabase.co u otro servicio remoto bloqueado.');
            process.exit(1);
        }
        if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
            console.error('[CLI-ERROR] Aparición de service_role prohibida.');
            process.exit(1);
        }
        console.log('[CLI] Verificaciones offline superadas. Abortando sin conexión.');
        process.exit(0);
    }

    const url = process.env.SUPABASE_LOCAL_URL || process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_LOCAL_ANON_KEY || process.env.SUPABASE_ANON_KEY;
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;

    if (!url || !key || !email || !password) {
        console.error('Missing required environment variables');
        process.exit(1);
    }

    const supabase = createClient(url, key);

    console.log(`[CLI] Authenticating as ${email}...`);
    const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({ email, password });
    if (authErr) {
        console.error('[CLI] Authentication failed:', authErr.message);
        process.exit(1);
    }
    console.log(`[CLI] Authenticated successfully. User ID: ${authData.user.id}`);
    
    console.log('[CLI] Ready.');
    process.exit(0);
}

if (require.main === module) {
    runCli();
}

module.exports = {
    buildCanonicalPayload,
    computeSha256,
    IMPORTER_VERSION,
    VALIDATION_SCHEMA_VERSION
};
