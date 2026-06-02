import fs from "fs";
import path from "path";
import { parseUpload } from "../src/lib/parser/unified-parser";
import { generateTransactionHash } from "../src/lib/intelligence/duplicate-detector-v2";

const COMPANY_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

async function debugProvider(fileName: string, label: string) {
  console.log(`\n=== ${label} ===`);

  // Parse the CSV
  const csvPath = path.join(process.cwd(), "test_data/csv", fileName);
  const csvText = fs.readFileSync(csvPath, "utf-8");
  const parseResult = parseUpload(csvText, {
    companyId: COMPANY_ID,
    companyCurrency: "GBP",
    companyCountry: "GB",
    uploadId: "test-upload",
  });

  console.log(`Parsed ${parseResult.transactions.length} transactions`);

  for (const tx of parseResult.transactions) {
    const hash = generateTransactionHash(tx);
    console.log(`  ${tx.merchantName} | ${tx.transactionDate} | ${tx.amount} | ${tx.currency} | src=${tx.sourceProvider} | acct=${tx.accountName || "n/a"} | hash=${hash}`);
  }
}

async function main() {
  await debugProvider("monzo_sample.csv", "Monzo");
  await debugProvider("generic_money_in_out.csv", "Generic CSV");
  await debugProvider("tide_sample.csv", "Tide");
}

main().catch(console.error);
