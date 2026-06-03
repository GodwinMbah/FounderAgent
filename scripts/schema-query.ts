import { createClient } from '@supabase/supabase-js'
import { getRequiredSupabaseScriptConfig } from "./supabase-env";

const { url, secretKey } = getRequiredSupabaseScriptConfig();
const supabase = createClient(url, secretKey)

const tables = [
  'transactions',
  'uploads',
  'bank_accounts',
  'company_metrics',
  'subscriptions',
  'alerts',
  'agent_recommendations',
  'agent_tasks'
]

async function main() {
  for (const table of tables) {
    console.log(`\n=== ${table} ===`)
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .limit(1)

    if (error) {
      console.log(`ERROR: ${error.message}`)
    } else if (data && data.length > 0) {
      console.log('Columns:', Object.keys(data[0]).sort().join(', '))
    } else {
      const { data: anyData, error: anyError } = await supabase
        .from(table)
        .select('*')
        .eq('company_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
        .limit(1)

      if (anyError) {
        console.log(`ERROR with company_id filter: ${anyError.message}`)
      } else if (anyData && anyData.length > 0) {
        console.log('Columns:', Object.keys(anyData[0]).sort().join(', '))
      } else {
        console.log('No rows found, cannot determine columns from data')
      }
    }
  }
}

main()
