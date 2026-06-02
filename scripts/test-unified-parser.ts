import { parseUpload } from "../src/lib/parser/unified-parser";
import * as fs from "fs";
import * as path from "path";

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

/* ── Revolut Business sample ── */
{
  const csvPath = path.join("./test_data/csv", "revolut_business_sample.csv");
  const csvText = fs.readFileSync(csvPath, "utf-8");
  const result = parseUpload(csvText, { companyId: "test-co-1", companyCurrency: "GBP" });

  assert(
    "Revolut: provider detected",
    result.detectedProvider === "revolut_business_csv",
    `got ${result.detectedProvider}`
  );

  assert(
    "Revolut: transactions created",
    result.transactions.length > 0,
    `got ${result.transactions.length}`
  );

  assert(
    "Revolut: first amount correct (expense 45.67)",
    result.transactions[0]?.amount === -45.67,
    `got ${result.transactions[0]?.amount}`
  );

  assert(
    "Revolut: top-up amount correct (income 2000.00)",
    result.transactions[2]?.amount === 2000.00,
    `got ${result.transactions[2]?.amount}`
  );

  assert(
    "Revolut: failed rows are reasonable",
    result.failedRows.length < 3,
    `got ${result.failedRows.length} failed rows`
  );
}

/* ── Tide sample ── */
{
  const csvPath = path.join("./test_data/csv", "tide_sample.csv");
  const csvText = fs.readFileSync(csvPath, "utf-8");
  const result = parseUpload(csvText, { companyId: "test-co-2", companyCurrency: "GBP" });

  assert(
    "Tide: provider detected",
    result.detectedProvider === "tide",
    `got ${result.detectedProvider}`
  );

  assert(
    "Tide: transactions created",
    result.transactions.length > 0,
    `got ${result.transactions.length}`
  );

  const incomeTx = result.transactions.find((t) => t.description.includes("Client Payment"));
  assert(
    "Tide: client payment is income of 2500.00",
    incomeTx !== undefined && incomeTx.amount === 2500,
    incomeTx ? `got ${incomeTx.amount}` : "transaction not found"
  );

  const expenseTx = result.transactions.find((t) => t.description.includes("AWS Hosting"));
  assert(
    "Tide: AWS hosting is expense of 120.00",
    expenseTx !== undefined && expenseTx.amount === -120,
    expenseTx ? `got ${expenseTx.amount}` : "transaction not found"
  );
}

/* ── Generic bank standard sample ── */
{
  const csvPath = path.join("./test_data/csv", "bank-standard.csv");
  const csvText = fs.readFileSync(csvPath, "utf-8");
  const result = parseUpload(csvText, { companyId: "test-co-3", companyCurrency: "GBP" });

  assert(
    "Generic: transactions created",
    result.transactions.length > 0,
    `got ${result.transactions.length}`
  );

  assert(
    "Generic: provider detected",
    result.detectedProvider !== undefined && result.detectedProvider !== "none",
    `got ${result.detectedProvider}`
  );

  const stripeTx = result.transactions.find((t) => t.description.includes("Stripe Payout"));
  assert(
    "Generic: Stripe Payout amount is 2500.00",
    stripeTx !== undefined && stripeTx.amount === 2500,
    stripeTx ? `got ${stripeTx.amount}` : "transaction not found"
  );

  const awsTx = result.transactions.find((t) => t.description.includes("AWS Services"));
  assert(
    "Generic: AWS Services amount is -89.50",
    awsTx !== undefined && awsTx.amount === -89.5,
    awsTx ? `got ${awsTx.amount}` : "transaction not found"
  );
}

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
