import {
  normaliseAmount,
  normaliseSplitAmount,
  normaliseInOutAmount,
  extractFee,
} from "../src/lib/parser/amount-normaliser";


let passed = 0;
let failed = 0;

function assert(
  label: string,
  condition: boolean,
  details?: string
) {
  if (condition) {
    console.log(`PASS: ${label}`);
    passed++;
  } else {
    console.log(`FAIL: ${label}${details ? ` — ${details}` : ""}`);
    failed++;
  }
}

/* ── UK bank convention ── */
{
  const result = normaliseAmount("-50.00", "uk_bank");
  assert(
    "UK bank: '-50.00' is expense of 50.00",
    result !== null && result.type === "expense" && Math.abs(result.amount) === 50,
    result ? `got ${result.amount} / ${result.type}` : "null"
  );
}

/* ── US bank convention ── */
{
  const result = normaliseAmount("50.00", "us_bank");
  assert(
    "US bank: '50.00' is expense of 50.00",
    result !== null && result.type === "expense" && Math.abs(result.amount) === 50,
    result ? `got ${result.amount} / ${result.type}` : "null"
  );
}

/* ── Accounting convention ── */
{
  const result = normaliseAmount("50.00", "accounting");
  assert(
    "Accounting: '50.00' is income of 50.00",
    result !== null && result.type === "income" && Math.abs(result.amount) === 50,
    result ? `got ${result.amount} / ${result.type}` : "null"
  );
}

/* ── Debit / credit split columns ── */
{
  const result = normaliseSplitAmount("50", "");
  assert(
    "Split columns: debit='50', credit='' is expense of 50.00",
    result !== null && result.type === "expense" && Math.abs(result.amount) === 50,
    result ? `got ${result.amount} / ${result.type}` : "null"
  );
}

/* ── Money In / Money Out columns ── */
{
  const result = normaliseInOutAmount("100", "");
  assert(
    "Money In/Out: moneyIn='100', moneyOut='' is income of 100.00",
    result !== null && result.type === "income" && Math.abs(result.amount) === 100,
    result ? `got ${result.amount} / ${result.type}` : "null"
  );
}

/* ── European decimal format ── */
{
  const result = normaliseAmount("1.234,56", "unknown");
  assert(
    "European decimal: '1.234,56' parses to 1234.56",
    result !== null && Math.abs(result.amount) === 1234.56,
    result ? `got ${result.amount}` : "null"
  );
}

/* ── Parentheses negative ── */
{
  const result = normaliseAmount("(25.00)", "uk_bank");
  assert(
    "Parentheses: '(25.00)' is expense of 25.00",
    result !== null && result.type === "expense" && Math.abs(result.amount) === 25,
    result ? `got ${result.amount} / ${result.type}` : "null"
  );
}

/* ── Fee extraction ── */
{
  const result = extractFee("5.00");
  assert(
    "Fee extraction: '5.00' extracts fee of 5.00",
    result !== null && result.feeAmount === 5,
    result ? `got ${result.feeAmount}` : "null"
  );
}

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
