import { enrichMerchant } from "../src/lib/intelligence/merchant-enrichment";

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean, details?: string) {
  if (condition) {
    console.log(`PASS: ${label}`);
    passed++;
  } else {
    console.log(`FAIL: ${label}${details ? ` — ${details}` : ""}`);
    failed++;
  }
}

/* ── Amazon ── */
{
  const result = enrichMerchant("AMAZON.COM");
  assert(
    "AMAZON.COM → displayName is 'Amazon'",
    result.displayName === "Amazon",
    `got '${result.displayName}'`
  );
  assert(
    "AMAZON.COM → isKnown is true",
    result.isKnown === true
  );
  assert(
    "AMAZON.COM → initials are 'AM'",
    result.initials === "AM",
    `got '${result.initials}'`
  );
}

/* ── Starbucks London ── */
{
  const result = enrichMerchant("STARBUCKS LONDON");
  assert(
    "STARBUCKS LONDON → displayName is 'Starbucks'",
    result.displayName === "Starbucks",
    `got '${result.displayName}'`
  );
  assert(
    "STARBUCKS LONDON → isKnown is false",
    result.isKnown === false
  );
  assert(
    "STARBUCKS LONDON → initials are 'ST'",
    result.initials === "ST",
    `got '${result.initials}'`
  );
}

/* ── OpenAI Inc ── */
{
  const result = enrichMerchant("OPENAI INC");
  assert(
    "OPENAI INC → displayName is 'OpenAI'",
    result.displayName === "OpenAI",
    `got '${result.displayName}'`
  );
  assert(
    "OPENAI INC → isKnown is true",
    result.isKnown === true
  );
}

/* ── Stripe Payout ── */
{
  const result = enrichMerchant("STRIPE PAYOUT");
  assert(
    "STRIPE PAYOUT → displayName is 'Stripe'",
    result.displayName === "Stripe",
    `got '${result.displayName}'`
  );
  assert(
    "STRIPE PAYOUT → isKnown is true",
    result.isKnown === true
  );
}

/* ── Unknown merchant fallback ── */
{
  const result = enrichMerchant("UNKNOWN MERCHANT XYZ");
  assert(
    "UNKNOWN MERCHANT XYZ → isKnown is false",
    result.isKnown === false
  );
  assert(
    "UNKNOWN MERCHANT XYZ → initials are 'UX'",
    result.initials === "UX",
    `got '${result.initials}'`
  );
  assert(
    "UNKNOWN MERCHANT XYZ → color is a valid Tailwind bg class",
    result.color.startsWith("bg-"),
    `got '${result.color}'`
  );
}

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
