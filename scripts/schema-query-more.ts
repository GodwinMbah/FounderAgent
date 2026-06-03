import { createClient } from '@supabase/supabase-js'
import { getRequiredSupabaseScriptConfig } from "./supabase-env";

const { url, secretKey } = getRequiredSupabaseScriptConfig();
const supabase = createClient(url, secretKey)

async function main() {
  for (const table of ['csv_mapping_profiles', 'reports', 'budgets', 'upload_sessions', 'company_members']) {
    console.log(`\n=== ${table} ===`)
    const { data, error } = await supabase.from(table).select('*').limit(1)
    if (error) {
      console.log(`ERROR: ${error.message}`)
    } else if (data && data.length > 0) {
      console.log('Columns:', Object.keys(data[0]).sort().join(', '))
    } else {
      console.log('No rows found')
    }
  }
}
main()
