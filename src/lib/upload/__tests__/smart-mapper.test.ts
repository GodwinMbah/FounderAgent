import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parseUpload } from "@/lib/parser/unified-parser";
import type { CompanySettings } from "@/lib/db/company_settings";
import { smartMapCsv } from "../smart-mapper";
import {
  applyMerchantAndTransferSignals,
  categoriseCanonicalTransactions,
  isTransferStyleCategory,
} from "../categorisation-runner";

function testSettings(model: CompanySettings["businessModel"] = "mixed"): CompanySettings {
  return {
    id: "settings-1",
    companyId: "test-company",
    businessModel: model,
    country: "GB",
    currency: "GBP",
    revenueModels: [],
    costStructure: [],
    categoryRules: [],
    topRevenueChannels: [],
    paymentTools: [],
    toolsUsed: [],
    agentFocus: [],
    weeklyDigestEnabled: false,
    createdAt: new Date().toISOString(),
  };
}

function readRealRevolutCsv(): string {
  return fs.readFileSync(
    path.resolve(process.cwd(), "references/account-statement_01-Jan-2026_24-May-2026.csv"),
    "utf-8"
  );
}

describe("smartMapCsv categorisation preview", () => {
  it("uses the same canonical categorisation runner as import for the real 694-row file", async () => {
    const csvText = readRealRevolutCsv();
    const companySettings = testSettings();

    const preview = await smartMapCsv(csvText, {
      companyId: "test-company",
      companyCurrency: "GBP",
      companyCountry: "GB",
      companySettings,
      uploadId: "test-upload",
    });

    const parsed = parseUpload(csvText, {
      companyId: "test-company",
      companyCurrency: "GBP",
      companyCountry: "GB",
      uploadId: "test-upload",
    });
    applyMerchantAndTransferSignals(parsed.transactions);
    categoriseCanonicalTransactions(parsed.transactions, companySettings);

    expect(preview.previewRows).toHaveLength(694);
    expect(parsed.transactions).toHaveLength(694);
    expect(preview.failedRows).toHaveLength(0);
    expect(preview.detectedCurrency).toBe("GBP");

    preview.previewRows.forEach((row, index) => {
      const canonical = parsed.transactions[index];
      expect(row.category).toBe(canonical.category);
      expect(row.status).toBe(canonical.status);
      expect(row.kpiTreatment).toBe(canonical.kpiTreatment);
      expect(row.categoryConfidence).toBe(canonical.categoryConfidence);
      expect(row.categoryReason).toBe(canonical.categoryReason);
    });
  });

  it("keeps manual review as a last resort on the real 694-row file", async () => {
    const preview = await smartMapCsv(readRealRevolutCsv(), {
      companyId: "test-company",
      companyCurrency: "GBP",
      companyCountry: "GB",
      companySettings: testSettings(),
      uploadId: "test-upload",
    });

    const rows = preview.previewRows;
    const uncategorised = rows.filter((row) => row.category === "Uncategorised Review");
    const ambiguous = rows.filter((row) => row.category === "Ambiguous");
    const needsReview = rows.filter((row) => row.status === "needs_review");
    const transfers = rows.filter((row) => isTransferStyleCategory(row.category));
    const autoCategorised = rows.filter((row) => row.status === "categorised");
    const suggested = rows.filter((row) => row.status === "ai_suggested");

    expect(rows).toHaveLength(694);
    expect(uncategorised.length).toBeLessThanOrEqual(10);
    expect(ambiguous.length).toBeLessThanOrEqual(5);
    expect(needsReview.length).toBeLessThanOrEqual(90);
    expect(transfers.length).toBeGreaterThanOrEqual(40);
    expect(autoCategorised.length + suggested.length + transfers.length).toBeGreaterThanOrEqual(600);
    expect(uncategorised.every((row) => (row.categoryConfidence ?? row.confidenceScore) === 0)).toBe(true);
    expect(uncategorised.every((row) => row.categoryReason?.includes("Not enough information"))).toBe(true);
  });

  it("shows Revolut reference and bank description fields distinctly in preview", async () => {
    const preview = await smartMapCsv(readRealRevolutCsv(), {
      companyId: "test-company",
      companyCurrency: "GBP",
      companyCountry: "GB",
      companySettings: testSettings(),
      uploadId: "test-upload",
    });

    const commission = preview.previewRows.find((row) =>
      row.bankDescription === "To Emmanuel Nnamdi Umunnakwe" &&
      row.reference === "Marketing Commission"
    );

    expect(commission).toBeDefined();
    expect(commission!.merchant).toBe("Emmanuel Nnamdi Umunnakwe");
    expect(commission!.description).toBe("Marketing Commission");
    expect(commission!.bankDescription).toBe("To Emmanuel Nnamdi Umunnakwe");
    expect(commission!.reference).toBe("Marketing Commission");
    expect(commission!.category).toBe("Sales Commission");
    expect(commission!.categoryReason).toContain("Commission");
  });

  it("categorises the visible problem examples with explanation and KPI treatment", async () => {
    const preview = await smartMapCsv(readRealRevolutCsv(), {
      companyId: "test-company",
      companyCurrency: "GBP",
      companyCountry: "GB",
      companySettings: testSettings(),
      uploadId: "test-upload",
    });

    const findRow = (predicate: (row: (typeof preview.previewRows)[number]) => boolean) => {
      const row = preview.previewRows.find(predicate);
      expect(row).toBeDefined();
      return row!;
    };

    const examples = [
      { row: findRow((row) => row.description === "Marketing Commission"), category: "Sales Commission", kpi: "included" },
      { row: findRow((row) => row.description === "Sales Rep Commision Fee"), category: "Sales Commission", kpi: "included" },
      { row: findRow((row) => row.bankDescription?.startsWith("Canva")), category: "Software", kpi: "included" },
      { row: findRow((row) => row.bankDescription === "Gamma.app"), category: "Software", kpi: "included" },
      { row: findRow((row) => row.bankDescription === "Manus Ai"), category: "AI Tools", kpi: "included" },
      { row: findRow((row) => row.bankDescription === "Netflix"), category: "Subscriptions", kpi: "included" },
      { row: findRow((row) => row.bankDescription?.startsWith("Remitly")), category: "International Transfer", kpi: "excluded" },
      { row: findRow((row) => row.description.trim() === "Refund Processed"), category: "Revenue Adjustment", kpi: "included" },
      { row: findRow((row) => row.bankDescription === "From British Pound"), category: "Internal Transfer", kpi: "excluded" },
      { row: findRow((row) => row.bankDescription === "Klarna*amazon"), category: "Office Costs", kpi: "included" },
      { row: findRow((row) => row.bankDescription === "Moneyway"), category: "Loan Repayment", kpi: "excluded" },
      { row: findRow((row) => row.bankDescription === "Capital On Tap"), category: "Credit Card Payment", kpi: "excluded" },
      { row: findRow((row) => row.bankDescription === "Hostinger.com"), category: "Cloud Infrastructure", kpi: "included" },
      { row: findRow((row) => row.description === "Roller Banner Fee"), category: "Marketing", kpi: "included" },
      { row: findRow((row) => row.bankDescription === "Teleperformance Contac"), category: "Customer Service", kpi: "included" },
    ] as const;

    for (const example of examples) {
      expect(example.row.category).toBe(example.category);
      expect(example.row.kpiTreatment).toBe(example.kpi);
      expect(example.row.categoryReason).toBeTruthy();
      expect(example.row.categoryEvidence.length).toBeGreaterThan(0);
      expect(example.row.categoryConfidence).toBeGreaterThanOrEqual(70);
    }

    const facebookManager = findRow((row) => row.description === "Facebook Manager Salary Payout");
    expect(facebookManager.category).toBe("Payroll");
    expect(facebookManager.categoryReason).toContain("Salary");
  });
});
