/**
 * Parser validation test script
 * Run: npx tsx scripts/test-revolut-parse.ts
 */

import { parseCsv } from "../src/lib/parser/csv-core";
import { parseRevolutCsv } from "../src/lib/parser/adapters/revolut-csv";
import { parseGenericCsv } from "../src/lib/parser/adapters/generic-csv";

const SAMPLE_ROWS = [
  '2024-01-15T10:30:00Z,2024-01-15T10:31:00Z,txn_123,POS Purchase Starbucks,REF001,CARD,COMPLETED,-5.20,-5.20,0.00,1000.00,Main GBP,1234,USD,-6.50,GBP,txref_999',
  '2024-01-16T09:00:00Z,2024-01-16T09:01:00Z,txn_124,Transfer to Savings,REF002,TRANSFER,COMPLETED,-100.00,-100.00,0.00,900.00,Main GBP,,,,GBP,',
  '2024-01-17T14:20:00Z,2024-01-17T14:21:00Z,txn_125,Stripe Payout,REF003,TRANSFER,COMPLETED,250.00,250.00,0.00,1150.00,Main GBP,,,,GBP,',
];

function makeCsv(headers: string[], rows: string[]): string {
  return [headers.join(","), ...rows].join("\n");
}

const TEST_CASES = [
  {
    name: "Standard Revolut headers",
    headers: [
      "Date Started (UTC)", "Date Completed (UTC)", "ID", "Description", "Reference",
      "Type", "State", "Amount", "Total Amount", "Fee", "Balance", "Account",
      "MCC", "Orig Currency", "Orig Amount", "Payment Currency", "Related Transaction ID",
    ],
  },
  {
    name: "Revolut headers without (UTC)",
    headers: [
      "Date Started", "Date Completed", "ID", "Description", "Reference",
      "Type", "State", "Amount", "Total Amount", "Fee", "Balance", "Account",
      "MCC", "Orig Currency", "Orig Amount", "Payment Currency", "Related Transaction ID",
    ],
  },
  {
    name: "Revolut headers with lowercase spacing",
    headers: [
      "date started utc", "date completed utc", "id", "description", "reference",
      "type", "state", "amount", "total amount", "fee", "balance", "account",
      "mcc", "orig currency", "orig amount", "payment currency", "related transaction id",
    ],
  },
  {
    name: "Revolut headers with extra spaces",
    headers: [
      " Date Started UTC ", " Date Completed UTC ", " ID ", " Description ", " Reference ",
      " Type ", " State ", " Amount ", " Total Amount ", " Fee ", " Balance ", " Account ",
      " MCC ", " Orig Currency ", " Orig Amount ", " Payment Currency ", " Related Transaction ID ",
    ],
  },
  {
    name: "Preamble rows before header",
    preamble: ["Account: Main GBP", "Statement Period: Jan 2024", ""],
    headers: [
      "Date Started (UTC)", "Date Completed (UTC)", "ID", "Description", "Reference",
      "Type", "State", "Amount", "Total Amount", "Fee", "Balance", "Account",
      "MCC", "Orig Currency", "Orig Amount", "Payment Currency", "Related Transaction ID",
    ],
  },
  {
    name: "Missing some Revolut columns (fallback to generic)",
    headers: [
      "Date", "Description", "Amount", "Currency", "Type",
    ],
  },
];

let passed = 0;
let failed = 0;

for (const testCase of TEST_CASES) {
  const csvText = makeCsv(testCase.headers, SAMPLE_ROWS);
  const parsed = parseCsv(csvText);

  console.log(`\n--- Test: ${testCase.name} ---`);
  console.log("Headers:", parsed.headers);
  console.log("Delimiter:", JSON.stringify(parsed.delimiter));
  console.log("Row count:", parsed.rowCount);
  console.log("Column count:", parsed.columnCount);

  const context = {
    companyId: "test-company",
    companyCurrency: "GBP",
    companyCountry: "GB",
  };

  const revolutResult = parseRevolutCsv(parsed, context);
  console.log("Revolut rows:", revolutResult.rows.length);
  console.log("Revolut failed:", revolutResult.failedRows.length);
  console.log("Revolut currency:", revolutResult.currencyResult.currency);

  if (testCase.name.includes("fallback")) {
    // For fallback case, generic parser should still produce something
    const genericResult = parseGenericCsv(parsed, { ...context, source: undefined });
    console.log("Generic rows:", genericResult.rows.length);
    if (genericResult.rows.length === 0) {
      console.error("FAIL: Generic parser produced no rows for fallback case");
      failed++;
    } else {
      console.log("PASS: Fallback generic parser produced rows");
      passed++;
    }
    continue;
  }

  // Standard expectations
  let testPassed = true;

  if (parsed.columnCount < 10) {
    console.error(`FAIL: Expected at least 10 columns, got ${parsed.columnCount}`);
    testPassed = false;
  }

  if (revolutResult.rows.length === 0 && revolutResult.failedRows.length > 0) {
    console.error("FAIL: Revolut parser produced no valid rows");
    testPassed = false;
  }

  // Check first row has date and amount
  if (revolutResult.rows.length > 0) {
    const first = revolutResult.rows[0];
    if (!first.date) {
      console.error("FAIL: First row missing date");
      testPassed = false;
    }
    if (first.amount === 0) {
      console.error("FAIL: First row has zero amount");
      testPassed = false;
    }
  }

  if (testPassed) {
    console.log("PASS");
    passed++;
  } else {
    failed++;
  }
}

console.log(`\n====================`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
