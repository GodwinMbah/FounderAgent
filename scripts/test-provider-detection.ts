import { parseCsv } from "../src/lib/parser/csv-core";
import { detectProvider } from "../src/lib/providers/adapter-registry";
import * as fs from "fs";
import * as path from "path";

const TEST_DIR = "./test_data/csv";

const EXPECTED_PROVIDERS: Record<string, string> = {
  "revolut_business_sample.csv": "revolut_business_csv",
  "tide_sample.csv": "tide",
  "monzo_sample.csv": "monzo",
  "starling_sample.csv": "starling",
  "wise_sample.csv": "wise",
  "barclays_sample.csv": "barclays",
  "hsbc_sample.csv": "hsbc",
  "lloyds_sample.csv": "lloyds",
  "natwest_sample.csv": "natwest",
  "chase_sample.csv": "chase",
  "stripe_payouts_sample.csv": "stripe_csv",
  "paypal_activity_sample.csv": "paypal_csv",
  "square_sample.csv": "square_csv",
  "gocardless_sample.csv": "gocardless_csv",
  "shopify_payouts_sample.csv": "shopify_payouts_csv",
  "generic_money_in_out.csv": "tide",
  "generic_debit_credit.csv": "generic_bank",
};

async function run() {
  let passed = 0;
  let failed = 0;

  for (const [fileName, expectedProvider] of Object.entries(EXPECTED_PROVIDERS)) {
    const filePath = path.join(TEST_DIR, fileName);
    if (!fs.existsSync(filePath)) {
      console.log(`SKIP: ${fileName} (file not found)`);
      continue;
    }

    const text = fs.readFileSync(filePath, "utf-8");
    const parsed = parseCsv(text);
    const matches = detectProvider(parsed);
    const detected = matches[0]?.provider.id ?? "none";
    const confidence = matches[0]?.score ?? 0;

    if (detected === expectedProvider) {
      console.log(`PASS: ${fileName} → ${detected} (${confidence}%)`);
      passed++;
    } else {
      console.log(`FAIL: ${fileName} → expected ${expectedProvider}, got ${detected} (${confidence}%)`);
      failed++;
    }
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run();
