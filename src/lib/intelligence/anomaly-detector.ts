/**
 * Anomaly detection from uploaded transactions
 * Detects unusual spend against historical baselines and company thresholds
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { CategorisedRow } from "./categoriser";

export interface AnomalyFinding {
  title: string;
  description: string;
  severity: "critical" | "warning" | "info";
  category: string;
  transactionDate: string;
  merchant: string;
  amount: number;
  reason: string;
}

export interface AnomalyThresholds {
  singleTransactionWarning: number;
  singleTransactionCritical: number;
  categorySpikeMultiplier: number;
  advertisingSpikeThreshold: number;
  cloudSpikeThreshold: number;
}

const DEFAULT_THRESHOLDS: AnomalyThresholds = {
  singleTransactionWarning: 1000,
  singleTransactionCritical: 5000,
  categorySpikeMultiplier: 3,
  advertisingSpikeThreshold: 2000,
  cloudSpikeThreshold: 1000,
};

interface DetectOptions {
  thresholds?: Partial<AnomalyThresholds>;
  companyId?: string;
}

async function getHistoricalMerchantStats(companyId: string, merchant: string): Promise<{
  avgAmount: number;
  stdDev: number;
  count: number;
} | null> {
  try {
    const admin = createAdminClient();
    if (!admin) return null;

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const { data, error } = await admin
      .from("transactions")
      .select("amount")
      .eq("company_id", companyId)
      .eq("merchant", merchant)
      .eq("type", "expense")
      .gte("date", ninetyDaysAgo.toISOString().slice(0, 10))
      .limit(100);

    if (error || !data || data.length < 3) return null;

    const amounts = data.map((r) => Number(r.amount));
    const avg = amounts.reduce((s, v) => s + v, 0) / amounts.length;
    const variance = amounts.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / amounts.length;
    const stdDev = Math.sqrt(variance);

    return { avgAmount: avg, stdDev, count: amounts.length };
  } catch {
    return null;
  }
}

async function getHistoricalCategoryTotals(companyId: string): Promise<Map<string, number> | null> {
  try {
    const admin = createAdminClient();
    if (!admin) return null;

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const { data, error } = await admin
      .from("transactions")
      .select("category, amount")
      .eq("company_id", companyId)
      .eq("type", "expense")
      .gte("date", ninetyDaysAgo.toISOString().slice(0, 10))
      .limit(500);

    if (error || !data || data.length < 10) return null;

    const totals = new Map<string, number>();
    for (const row of data) {
      const cat = row.category || "Unknown";
      totals.set(cat, (totals.get(cat) || 0) + Number(row.amount));
    }
    return totals;
  } catch {
    return null;
  }
}

export async function detectAnomalies(
  rows: CategorisedRow[],
  options: DetectOptions = {}
): Promise<AnomalyFinding[]> {
  const config = { ...DEFAULT_THRESHOLDS, ...options.thresholds };
  const findings: AnomalyFinding[] = [];
  const companyId = options.companyId;

  // Fetch historical data if companyId provided
  let historicalCategoryTotals: Map<string, number> | null = null;
  if (companyId) {
    historicalCategoryTotals = await getHistoricalCategoryTotals(companyId);
  }

  // 1. Single large transactions + historical merchant baseline
  for (const row of rows) {
    if (row.type !== "expense") continue;

    // Static threshold check
    if (row.amount >= config.singleTransactionCritical) {
      findings.push({
        title: "High-value expense detected",
        description: `${row.merchant}: ${formatCurrency(row.amount)} on ${row.date}`,
        severity: "critical",
        category: row.category,
        transactionDate: row.date,
        merchant: row.merchant,
        amount: row.amount,
        reason: `Amount exceeds critical threshold of ${formatCurrency(config.singleTransactionCritical)}`,
      });
    } else if (row.amount >= config.singleTransactionWarning) {
      findings.push({
        title: "Large expense detected",
        description: `${row.merchant}: ${formatCurrency(row.amount)} on ${row.date}`,
        severity: "warning",
        category: row.category,
        transactionDate: row.date,
        merchant: row.merchant,
        amount: row.amount,
        reason: `Amount exceeds warning threshold of ${formatCurrency(config.singleTransactionWarning)}`,
      });
    }

    // Historical baseline check
    if (companyId) {
      const hist = await getHistoricalMerchantStats(companyId, row.merchant);
      if (hist && hist.stdDev > 0 && row.amount > hist.avgAmount + 2 * hist.stdDev) {
        findings.push({
          title: `Unusual spend: ${row.merchant}`,
          description: `${row.merchant}: ${formatCurrency(row.amount)} on ${row.date}`,
          severity: "warning",
          category: row.category,
          transactionDate: row.date,
          merchant: row.merchant,
          amount: row.amount,
          reason: `Spend is ${((row.amount - hist.avgAmount) / hist.avgAmount * 100).toFixed(0)}% higher than 90-day average of ${formatCurrency(hist.avgAmount)}`,
        });
      }
    }
  }

  // 2. Category spend spikes — compare against historical if available
  const categoryTotals = new Map<string, number>();
  for (const row of rows) {
    if (row.type !== "expense") continue;
    const total = categoryTotals.get(row.category) || 0;
    categoryTotals.set(row.category, total + row.amount);
  }

  for (const [category, total] of categoryTotals) {
    // Compare against historical baseline if available
    if (historicalCategoryTotals) {
      const histTotal = historicalCategoryTotals.get(category) || 0;
      if (histTotal > 0 && total > histTotal * 1.3) {
        findings.push({
          title: `${category} spend spike`,
          description: `Total ${category} spend of ${formatCurrency(total)} is ${((total / histTotal) * 100 - 100).toFixed(0)}% higher than previous 90-day average`,
          severity: "warning",
          category,
          transactionDate: rows.find((r) => r.category === category)?.date || "",
          merchant: "Multiple",
          amount: total,
          reason: `Category spend is ${((total / histTotal) * 100 - 100).toFixed(0)}% above 90-day historical baseline`,
        });
      }
    } else {
      // Fallback to cross-category average (within upload only)
      const avgCategorySpend = categoryTotals.size > 0
        ? Array.from(categoryTotals.values()).reduce((s, v) => s + v, 0) / categoryTotals.size
        : 0;
      if (avgCategorySpend > 0 && total > avgCategorySpend * config.categorySpikeMultiplier) {
        findings.push({
          title: `${category} spend spike`,
          description: `Total ${category} spend of ${formatCurrency(total)} is ${Math.round(total / avgCategorySpend)}x higher than average category spend in this upload`,
          severity: "warning",
          category,
          transactionDate: rows.find((r) => r.category === category)?.date || "",
          merchant: "Multiple",
          amount: total,
          reason: `Category spend is ${config.categorySpikeMultiplier}x above the per-category average in this upload`,
        });
      }
    }
  }

  // 3. Advertising spend spikes
  const advertisingTotal = Array.from(rows)
    .filter((r) => r.type === "expense" && r.category === "Advertising")
    .reduce((s, r) => s + r.amount, 0);

  if (advertisingTotal > config.advertisingSpikeThreshold) {
    findings.push({
      title: "Advertising spend spike",
      description: `Total advertising spend of ${formatCurrency(advertisingTotal)} detected`,
      severity: "warning",
      category: "Advertising",
      transactionDate: "",
      merchant: "Multiple",
      amount: advertisingTotal,
      reason: `Advertising spend exceeds ${formatCurrency(config.advertisingSpikeThreshold)} threshold`,
    });
  }

  // 4. Cloud infrastructure spikes
  const cloudTotal = Array.from(rows)
    .filter((r) => r.type === "expense" && r.category === "Cloud Infrastructure")
    .reduce((s, r) => s + r.amount, 0);

  if (cloudTotal > config.cloudSpikeThreshold) {
    findings.push({
      title: "Cloud infrastructure spend spike",
      description: `Total cloud spend of ${formatCurrency(cloudTotal)} detected`,
      severity: "info",
      category: "Cloud Infrastructure",
      transactionDate: "",
      merchant: "Multiple",
      amount: cloudTotal,
      reason: `Cloud spend exceeds ${formatCurrency(config.cloudSpikeThreshold)} threshold`,
    });
  }

  // 5. Unknown vendor with high amount
  for (const row of rows) {
    if (row.type !== "expense") continue;
    if (row.category === "Unknown" && row.amount >= config.singleTransactionWarning / 2) {
      findings.push({
        title: "Unknown vendor with significant spend",
        description: `${row.merchant}: ${formatCurrency(row.amount)} — category not recognised`,
        severity: "warning",
        category: "Unknown",
        transactionDate: row.date,
        merchant: row.merchant,
        amount: row.amount,
        reason: "Unknown vendor with significant transaction amount",
      });
    }
  }

  return findings;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(amount);
}
