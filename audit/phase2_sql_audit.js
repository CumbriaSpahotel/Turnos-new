const fs = require('fs');

const sql = fs.readFileSync('database/migrations/01_phase2_vacation_balances.sql', 'utf8');

let errors = 0;

// 1. Ausencia de parámetros de cliente en la firma
const rpcMatch = sql.match(/CREATE OR REPLACE FUNCTION close_employee_vacation_year\(([\s\S]*?)\)/);
if (rpcMatch) {
    const params = rpcMatch[1];
    if (params.includes('p_opening_balance') || params.includes('p_annual_entitlement') || params.includes('p_adjustments_total')) {
        console.error('[FAIL] La firma de la RPC incluye parámetros autoritativos del cliente.');
        errors++;
    } else {
        console.log('[PASS] Ausencia de p_opening_balance, p_annual_entitlement y p_adjustments_total en la firma.');
    }
} else {
    console.error('[FAIL] No se encontró la definición de close_employee_vacation_year.');
    errors++;
}

// 2. Existencia de lectura de opening_balance_days
if (sql.includes('opening_balance_days,') && sql.includes('INTO v_year_row') && sql.includes('FROM employee_vacation_years')) {
    console.log('[PASS] Existencia de lectura de opening_balance_days y derecho desde BD.');
} else {
    console.error('[FAIL] No se extraen los datos autoritativos desde la BD.');
    errors++;
}

// 3. Existencia de suma SQL de ajustes
if (sql.includes('SELECT COALESCE(SUM(days), 0)') && sql.includes('INTO v_adjustments_total')) {
    console.log('[PASS] Existencia de suma SQL de ajustes no revertidos.');
} else {
    console.error('[FAIL] No se suman los ajustes dinámicamente en el servidor.');
    errors++;
}

// 4. Ausencia de políticas permisivas para authenticated
const selectPolicyMatch = sql.match(/CREATE POLICY .* USING \((.*?)\)/g);
let selectPermissive = false;
if (selectPolicyMatch) {
    selectPolicyMatch.forEach(p => {
        if (p.includes('auth.uid() IS NOT NULL') || p.includes("auth.role() = 'authenticated'")) {
            selectPermissive = true;
            console.error(`[FAIL] Política permisiva encontrada: ${p}`);
        }
    });
}
if (selectPermissive) {
    errors++;
} else {
    console.log('[PASS] Ausencia de políticas permisivas para authenticated.');
}

// 5. Existencia de REVOKE EXECUTE
if (sql.includes('REVOKE ALL ON FUNCTION public.close_employee_vacation_year') && sql.includes('FROM PUBLIC') && sql.includes('FROM anon') && sql.includes('FROM authenticated')) {
    console.log('[PASS] Existencia de REVOKE EXECUTE explícito.');
} else {
    console.error('[FAIL] Falta revocar el EXECUTE a los roles públicos.');
    errors++;
}

// 6. Existencia de SET search_path
if (sql.includes('SET search_path = public, pg_temp')) {
    console.log('[PASS] Existencia de SET search_path.');
} else {
    console.error('[FAIL] Falta SET search_path en la definición de la función.');
    errors++;
}

// 7. Existencia de validación de auth.uid()
if (sql.includes('v_actor_id := auth.uid()') && sql.includes('RAISE EXCEPTION \'UNAUTHORIZED\'')) {
    console.log('[PASS] Existencia de validación estricta de auth.uid().');
} else {
    console.error('[FAIL] No se valida correctamente el actor ID (auth.uid).');
    errors++;
}

// 8. Existencia de inserción en employee_vacation_year_actions
if (sql.includes('INSERT INTO employee_vacation_year_actions') && sql.includes("'CLOSE'")) {
    console.log('[PASS] Existencia de inserción en employee_vacation_year_actions transaccional.');
} else {
    console.error('[FAIL] No se inserta el registro en la tabla de acciones.');
    errors++;
}

// 9. Existencia de control VACATION_YEAR_NOT_FOUND
if (sql.includes("reason', 'VACATION_YEAR_NOT_FOUND'")) {
    console.log('[PASS] Existencia de control VACATION_YEAR_NOT_FOUND.');
} else {
    console.error('[FAIL] Falta el control para el caso de año no encontrado.');
    errors++;
}

// 10. Existencia de validación de referenceDate a 31 de diciembre
if (sql.includes('make_date(p_year, 12, 31)') || sql.includes("make_date(p_year, 12, 31)")) {
    console.log('[PASS] Existencia de validación de referenceDate a 31 de diciembre.');
} else {
    console.error('[FAIL] Falta asegurar la referenceDate contra el 31/12 del año.');
    errors++;
}

if (errors > 0) {
    console.error(`\n[FAIL] Auditoría estática fallida con ${errors} errores.`);
    process.exit(1);
} else {
    console.log(`\n[SUCCESS] Auditoría estática SQL superada correctamente.`);
}
