const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.SUPABASE_URL || 'https://xofvsvhmszbwaxiccluo.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY;

const client = createClient(supabaseUrl, supabaseKey);

async function checkSandra() {
    const { data: emps, error } = await client
        .from('empleados')
        .select('*')
        .ilike('nombre', '%Sandra%');
    
    if (error) {
        console.error('Error:', error);
        return;
    }
    
    console.log('SANDRA PROFILES:', JSON.stringify(emps, null, 2));
}

checkSandra();
