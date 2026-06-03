import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { getRequiredSupabaseScriptConfig } from "./supabase-env";

const { url, secretKey } = getRequiredSupabaseScriptConfig();
const supabase = createClient(url, secretKey);

async function testStatus(status: string) {
  const id = crypto.randomUUID();
  const { error } = await supabase.from('transactions').insert({
    id,
    company_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    date: '2024-01-01',
    merchant: 'Test',
    amount: 100,
    type: 'expense',
    status,
    metadata: {},
  });
  if (error) {
    if (error.message.includes('invalid input value for enum')) {
      console.log(`INVALID: ${status}`);
    } else {
      console.log(`OTHER ERROR for ${status}: ${error.message}`);
    }
  } else {
    console.log(`VALID: ${status}`);
    await supabase.from('transactions').delete().eq('id', id);
  }
}

async function main() {
  const candidates = [
    'pending', 'completed', 'failed', 'cancelled', 'processing',
    'new', 'review', 'approved', 'rejected', 'uncategorized',
    'categorized', 'transfer', 'possible_duplicate', 'duplicate',
    'income', 'expense', 'active', 'inactive', 'archived',
    'verified', 'unverified', 'manual', 'auto', 'imported',
    'confirmed', 'unconfirmed', 'flagged', 'cleared',
    'reconciled', 'unreconciled', 'posted', 'scheduled',
    'hold', 'released', 'refunded', 'chargeback',
  ];

  for (const status of candidates) {
    await testStatus(status);
  }
}
main().catch(console.error);
