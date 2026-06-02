/**
 * Generates structured agent recommendations from upload findings
 */

import type { CategorisedRow } from "./categoriser";
import type { DetectedSubscription } from "./subscription-detector";
import type { AnomalyFinding } from "./anomaly-detector";
import { isIncome, isExpense } from "@/lib/reporting/filters";

export interface UploadRecommendation {
  title: string;
  description: string;
  category: string;
  severity: "critical" | "warning" | "info";
  potentialSavings?: number;
  impactScore: number;
  effortScore: number;
  source: string;
}

export interface UploadFindings {
  rows: CategorisedRow[];
  subscriptions: DetectedSubscription[];
  duplicateTools: Array<{ category: string; vendors: string[]; message: string }>;
  anomalies: AnomalyFinding[];
  categoryBreakdown: Array<{ category: string; count: number; amount: number }>;
}

export function generateRecommendations(findings: UploadFindings): UploadRecommendation[] {
  const recommendations: UploadRecommendation[] = [];
  const { rows, subscriptions, duplicateTools, anomalies, categoryBreakdown } = findings;

  const totalExpenses = rows.filter((r) => isExpense(r)).reduce((s, r) => s + r.amount, 0);
  const totalIncome = rows.filter((r) => isIncome(r)).reduce((s, r) => s + r.amount, 0);

  // 1. Software spend increased
  const softwareSpend = categoryBreakdown.find((c) => c.category === "Software" || c.category === "AI Tools" || c.category === "Subscriptions")?.amount ?? 0;
  if (softwareSpend > 500) {
    recommendations.push({
      title: "Software spend detected",
      description: `Total software and SaaS spend of ${formatCurrency(softwareSpend)} in this upload. Review for optimisation opportunities.`,
      category: "cost_reduction",
      severity: "info",
      potentialSavings: Math.round(softwareSpend * 0.15),
      impactScore: 60,
      effortScore: 40,
      source: "upload_analysis",
    });
  }

  // 2. Duplicate subscriptions
  for (const dup of duplicateTools) {
    recommendations.push({
      title: `Possible duplicate ${dup.category.toLowerCase()}`,
      description: dup.message,
      category: "duplicate_subscription",
      severity: "warning",
      potentialSavings: 100,
      impactScore: 70,
      effortScore: 30,
      source: "subscription_detection",
    });
  }

  // 3. Advertising vs revenue
  const adSpend = categoryBreakdown.find((c) => c.category === "Advertising")?.amount ?? 0;
  if (adSpend > 0 && totalIncome > 0) {
    const ratio = adSpend / totalIncome;
    if (ratio > 0.3) {
      recommendations.push({
        title: "Advertising spend ratio high",
        description: `Advertising spend (${formatCurrency(adSpend)}) is ${Math.round(ratio * 100)}% of revenue (${formatCurrency(totalIncome)}). Consider optimising ad channels.`,
        category: "cost_reduction",
        severity: ratio > 0.5 ? "critical" : "warning",
        potentialSavings: Math.round(adSpend * 0.2),
        impactScore: 80,
        effortScore: 50,
        source: "upload_analysis",
      });
    }
  }

  // 4. Uncategorised transactions
  const unknownCount = rows.filter((r) => r.category === "Uncategorised Review").length;
  if (unknownCount > 0) {
    recommendations.push({
      title: `${unknownCount} uncategorised transaction${unknownCount > 1 ? "s" : ""} need review`,
      description: `Found ${unknownCount} transaction${unknownCount > 1 ? "s" : ""} that could not be automatically categorised. Review and assign categories to improve accuracy.`,
      category: "categorisation",
      severity: "info",
      impactScore: 50,
      effortScore: 20,
      source: "categorisation",
    });
  }

  // 5. Anomaly-based recommendations
  for (const anomaly of anomalies) {
    recommendations.push({
      title: anomaly.title,
      description: anomaly.description,
      category: "spending",
      severity: anomaly.severity,
      potentialSavings: anomaly.severity === "critical" ? Math.round(anomaly.amount * 0.3) : undefined,
      impactScore: anomaly.severity === "critical" ? 90 : anomaly.severity === "warning" ? 70 : 40,
      effortScore: 30,
      source: "anomaly_detection",
    });
  }

  // 6. Cash outflow > inflow
  if (totalExpenses > totalIncome && totalIncome > 0) {
    const diff = totalExpenses - totalIncome;
    recommendations.push({
      title: "Expenses exceed income in upload",
      description: `Total expenses (${formatCurrency(totalExpenses)}) exceed income (${formatCurrency(totalIncome)}) by ${formatCurrency(diff)}. Review discretionary spending.`,
      category: "cash_flow",
      severity: diff > totalIncome * 0.5 ? "critical" : "warning",
      potentialSavings: Math.round(diff * 0.25),
      impactScore: 85,
      effortScore: 40,
      source: "upload_analysis",
    });
  }

  // 7. Payment processor fees
  const processorFees = categoryBreakdown.find((c) => c.category === "Payment Processor Fees")?.amount ?? 0;
  if (processorFees > 100) {
    recommendations.push({
      title: "Payment processor fees detected",
      description: `Total payment processor fees of ${formatCurrency(processorFees)}. Compare rates or negotiate with your provider.`,
      category: "cost_reduction",
      severity: "info",
      potentialSavings: Math.round(processorFees * 0.2),
      impactScore: 55,
      effortScore: 60,
      source: "upload_analysis",
    });
  }

  // 8. Recurring subscriptions detected
  if (subscriptions.length > 0) {
    const totalSubSpend = subscriptions.reduce((s, sub) => s + sub.amount, 0);
    recommendations.push({
      title: `${subscriptions.length} subscription${subscriptions.length > 1 ? "s" : ""} detected`,
      description: `Found ${subscriptions.length} recurring subscription${subscriptions.length > 1 ? "s" : ""} with estimated monthly spend of ${formatCurrency(totalSubSpend)}.`,
      category: "subscription",
      severity: "info",
      impactScore: 60,
      effortScore: 30,
      source: "subscription_detection",
    });
  }

  // 9. Runway impact (if large new expenses)
  const oneTimePurchases = categoryBreakdown.find((c) => c.category === "Office Costs")?.amount ?? 0;
  if (oneTimePurchases > 2000) {
    recommendations.push({
      title: "Large office cost detected",
      description: `Office cost of ${formatCurrency(oneTimePurchases)} may affect cash runway. Review timing and necessity.`,
      category: "cash_flow",
      severity: oneTimePurchases > 5000 ? "warning" : "info",
      impactScore: 65,
      effortScore: 20,
      source: "upload_analysis",
    });
  }

  return recommendations;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(amount);
}
