const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE env vars!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Checking Supabase tables...");
  
  // Try querying common tables
  const tables = ['products', 'product', 'items', 'csv_data', 'csv_products', 'imported_products'];
  for (const table of tables) {
    try {
      const { data, error, count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        console.log(`Table '${table}' query error:`, error.message);
      } else {
        console.log(`Table '${table}' exists! Count:`, count);
        // Let's get one row to inspect columns
        const { data: rows, error: rowError } = await supabase
          .from(table)
          .select('*')
          .limit(1);
        if (rowError) {
          console.log(`Failed to fetch row from '${table}':`, rowError.message);
        } else {
          console.log(`Sample row from '${table}':`, JSON.stringify(rows[0], null, 2));
        }
      }
    } catch (e) {
      console.log(`Table '${table}' threw exception:`, e.message);
    }
  }
}

run();
