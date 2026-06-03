import { getKpiExclusionReasonForCategory, isKpiExcludedCategory, isTransferStyleCategory } from "@/lib/kpi-treatment";

export type ReportingTreatmentCode =
  | "operating_revenue"
  | "payment_processor_payout"
  | "refund_or_adjustment"
  | "operating_expense"
  | "subscription_expense"
  | "cost_of_goods_sold"
  | "tax_payment"
  | "bank_fee"
  | "internal_transfer"
  | "money_transfer"
  | "international_transfer"
  | "credit_card_repayment"
  | "loan_repayment"
  | "loan_funding"
  | "owner_drawings"
  | "capital_injection"
  | "data_quality_review"
  | "duplicate_row"
  | "failed_row";

export interface ReportingTreatment {
  category?: string;
  subcategory?: string;
  reportingTreatment: ReportingTreatmentCode;
  treatment: ReportingTreatmentCode;
  label: string;
  includedInOperatingKpis: boolean;
  includedInOperatingRevenue: boolean;
  includedInOperatingExpenses: boolean;
  includedInProfitAndLoss: boolean;
  includedInCashFlow: boolean;
  includedInCashMovement: boolean;
  includedInBalanceSheetMovement: boolean;
  includedInDebtTracking: boolean;
  includedInOwnerMovement: boolean;
  includedInSubscriptionTracking: boolean;
  includedInRecurringRevenueTracking: boolean;
  includedInTaxReporting: boolean;
  includedInDataQualityReporting: boolean;
  includedInAuditTrail: boolean;
  kpiExclusionReason?: string;
  sourceEvidence: string[];
  confidence: number;
  explanation: string;
}

export interface ReportingTreatmentInput {
  type?: string;
  amount?: number;
  category?: string;
  subcategory?: string;
  description?: string;
  merchant?: string;
  merchantName?: string;
  reference?: string;
  transactionType?: string;
  status?: string;
  rowStatus?: string;
  row_status?: string;
  kpiTreatment?: "included" | "excluded";
  kpiExcluded?: boolean;
  kpi_excluded?: boolean;
  kpiExclusionReason?: string | null;
  kpi_exclusion_reason?: string | null;
  isTransfer?: boolean;
  isCreditCardRepayment?: boolean;
  isSubscriptionCandidate?: boolean;
  isRecurringCandidate?: boolean;
  isPossibleDuplicate?: boolean;
  isRecurring?: boolean;
  subscriptionId?: string;
  duplicateOfTransactionId?: string;
  duplicate_of_transaction_id?: string;
  tags?: string[];
  parseErrors?: string[];
  metadata?: Record<string, unknown> | null;
  reportingTreatment?: ReportingTreatment;
  userConfirmedCategory?: boolean;
  user_confirmed_category?: boolean;
}

function metadataOf(input: ReportingTreatmentInput): Record<string, unknown> {
  return input.metadata ?? {};
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function lower(value?: string | null): string {
  return (value ?? "").toLowerCase();
}

function directionOf(input: ReportingTreatmentInput): "income" | "expense" | "unknown" {
  const raw = lower(input.type);
  if (raw === "income" || raw === "expense") return raw;
  if (typeof input.amount === "number" && Number.isFinite(input.amount)) {
    if (input.amount > 0) return "income";
    if (input.amount < 0) return "expense";
  }
  return "unknown";
}

function compact(values: Array<string | undefined | null | false>): string[] {
  return values.filter((value): value is string => typeof value === "string" && value.trim().length > 0);
}

function textFor(input: ReportingTreatmentInput): string {
  const metadata = metadataOf(input);
  const rawData = metadata.raw_data && typeof metadata.raw_data === "object"
    ? Object.values(metadata.raw_data as Record<string, unknown>).join(" ")
    : "";
  return [
    input.transactionType,
    input.description,
    input.reference,
    input.merchant,
    input.merchantName,
    Array.isArray(input.tags) ? input.tags.join(" ") : undefined,
    asString(metadata.transaction_type_raw),
    asString(metadata.reference),
    asString(metadata.counterparty_name),
    rawData,
  ].filter(Boolean).join(" ").toLowerCase();
}

function hasAny(haystack: string, needles: string[]): boolean {
  return needles.some((needle) => haystack.includes(needle));
}

function normaliseReason(reason?: string | null): string | undefined {
  if (!reason) return undefined;
  return reason.toLowerCase().replace(/\s+/g, "_");
}

function storedTreatmentFrom(value: unknown): ReportingTreatment | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<ReportingTreatment>;
  if (
    typeof candidate.includedInOperatingRevenue === "boolean" &&
    typeof candidate.includedInOperatingExpenses === "boolean" &&
    typeof candidate.includedInCashMovement === "boolean" &&
    typeof candidate.reportingTreatment === "string"
  ) {
    return {
      ...candidate,
      treatment: candidate.treatment ?? candidate.reportingTreatment,
      includedInOperatingKpis: candidate.includedInOperatingKpis ?? (
        candidate.includedInOperatingRevenue || candidate.includedInOperatingExpenses
      ),
      includedInAuditTrail: candidate.includedInAuditTrail ?? true,
      sourceEvidence: Array.isArray(candidate.sourceEvidence) ? candidate.sourceEvidence : ["stored_reporting_treatment"],
      confidence: typeof candidate.confidence === "number" ? candidate.confidence : 80,
      explanation: candidate.explanation ?? "Stored reporting treatment.",
      label: candidate.label ?? labelFor(candidate.reportingTreatment as ReportingTreatmentCode),
    } as ReportingTreatment;
  }
  return null;
}

export function getStoredReportingTreatment(input: ReportingTreatmentInput): ReportingTreatment | null {
  return storedTreatmentFrom(input.reportingTreatment) ?? storedTreatmentFrom(metadataOf(input).reporting_treatment);
}

function buildTreatment(
  input: ReportingTreatmentInput,
  code: ReportingTreatmentCode,
  options: {
    category?: string;
    subcategory?: string;
    label?: string;
    operatingRevenue?: boolean;
    operatingExpense?: boolean;
    profitAndLoss?: boolean;
    cashFlow?: boolean;
    cashMovement?: boolean;
    balanceSheet?: boolean;
    debt?: boolean;
    owner?: boolean;
    subscription?: boolean;
    recurringRevenue?: boolean;
    tax?: boolean;
    dataQuality?: boolean;
    kpiExclusionReason?: string;
    sourceEvidence: string[];
    confidence: number;
    explanation: string;
  }
): ReportingTreatment {
  const operatingRevenue = options.operatingRevenue ?? false;
  const operatingExpense = options.operatingExpense ?? false;
  const treatment = {
    category: options.category ?? input.category,
    subcategory: options.subcategory ?? input.subcategory,
    reportingTreatment: code,
    treatment: code,
    label: options.label ?? labelFor(code),
    includedInOperatingKpis: operatingRevenue || operatingExpense,
    includedInOperatingRevenue: operatingRevenue,
    includedInOperatingExpenses: operatingExpense,
    includedInProfitAndLoss: options.profitAndLoss ?? (operatingRevenue || operatingExpense),
    includedInCashFlow: options.cashFlow ?? (operatingRevenue || operatingExpense),
    includedInCashMovement: options.cashMovement ?? (operatingRevenue || operatingExpense),
    includedInBalanceSheetMovement: options.balanceSheet ?? false,
    includedInDebtTracking: options.debt ?? false,
    includedInOwnerMovement: options.owner ?? false,
    includedInSubscriptionTracking: options.subscription ?? false,
    includedInRecurringRevenueTracking: options.recurringRevenue ?? false,
    includedInTaxReporting: options.tax ?? false,
    includedInDataQualityReporting: options.dataQuality ?? false,
    includedInAuditTrail: true,
    kpiExclusionReason: options.kpiExclusionReason,
    sourceEvidence: options.sourceEvidence,
    confidence: options.confidence,
    explanation: options.explanation,
  };

  return treatment;
}

function labelFor(code: ReportingTreatmentCode): string {
  const labels: Record<ReportingTreatmentCode, string> = {
    operating_revenue: "Operating revenue",
    payment_processor_payout: "Payment processor payout",
    refund_or_adjustment: "Refund or adjustment",
    operating_expense: "Operating expense",
    subscription_expense: "Subscription expense",
    cost_of_goods_sold: "Cost of goods sold",
    tax_payment: "Tax payment",
    bank_fee: "Bank fee",
    internal_transfer: "Internal transfer",
    money_transfer: "Money transfer",
    international_transfer: "International transfer",
    credit_card_repayment: "Credit card repayment",
    loan_repayment: "Loan repayment",
    loan_funding: "Loan funding",
    owner_drawings: "Owner drawings",
    capital_injection: "Capital injection",
    data_quality_review: "Needs reporting review",
    duplicate_row: "Duplicate row",
    failed_row: "Failed row",
  };
  return labels[code];
}

function isDuplicate(input: ReportingTreatmentInput): boolean {
  const metadata = metadataOf(input);
  return (
    input.isPossibleDuplicate === true ||
    asBoolean(metadata.is_possible_duplicate) === true ||
    Boolean(input.duplicateOfTransactionId || input.duplicate_of_transaction_id || metadata.duplicate_of_transaction_id) ||
    input.status === "possible_duplicate" ||
    input.rowStatus === "duplicate_skipped" ||
    input.row_status === "duplicate_skipped" ||
    metadata.row_status === "duplicate_skipped" ||
    normaliseReason(input.kpiExclusionReason) === "duplicate" ||
    normaliseReason(input.kpi_exclusion_reason) === "duplicate" ||
    metadata.kpi_exclusion_reason === "duplicate"
  );
}

function isFailed(input: ReportingTreatmentInput): boolean {
  const metadata = metadataOf(input);
  const parseErrors = Array.isArray(input.parseErrors)
    ? input.parseErrors
    : Array.isArray(metadata.parse_errors)
    ? metadata.parse_errors as string[]
    : [];
  return input.status === "failed" || input.rowStatus === "failed" || input.row_status === "failed" || parseErrors.length > 0;
}

function isNeedsReview(input: ReportingTreatmentInput): boolean {
  const metadata = metadataOf(input);
  const category = input.category ?? asString(metadata.category);
  const status = lower(input.status);
  const rowStatus = lower(input.rowStatus ?? input.row_status ?? asString(metadata.row_status));
  return (
    status === "needs_review" ||
    rowStatus === "needs_review" ||
    category === "Ambiguous" ||
    category === "Needs Review" ||
    category === "Uncategorised Review" ||
    category === "Uncategorised"
  );
}

function isPaymentProcessorIncome(input: ReportingTreatmentInput, text: string): boolean {
  if (directionOf(input) !== "income") return false;
  return hasAny(text, [
    "stripe",
    "stripe payments",
    "paypal",
    "shopify payments",
    "shopify payout",
    "square",
    "adyen",
    "gocardless",
    "sumup",
    "worldpay",
  ]);
}

function subscriptionCandidate(input: ReportingTreatmentInput, text: string): boolean {
  const metadata = metadataOf(input);
  return (
    input.isSubscriptionCandidate === true ||
    input.isRecurringCandidate === true ||
    input.isRecurring === true ||
    Boolean(input.subscriptionId) ||
    asBoolean(metadata.is_subscription_candidate) === true ||
    asBoolean(metadata.is_recurring_candidate) === true ||
    hasAny(text, ["subscription", "monthly plan", "annual plan", "saas"])
  );
}

function recurringRevenueCandidate(input: ReportingTreatmentInput, text: string): boolean {
  const category = lower(input.category);
  return (
    directionOf(input) === "income" &&
    (input.isRecurring === true ||
      input.isRecurringCandidate === true ||
      category.includes("recurring") ||
      hasAny(text, ["subscription revenue", "monthly subscription", "stripe"]))
  );
}

function isUserConfirmed(input: ReportingTreatmentInput): boolean {
  const metadata = metadataOf(input);
  return input.userConfirmedCategory === true || input.user_confirmed_category === true || metadata.user_confirmed_category === true;
}

export function classifyReportingTreatment(input: ReportingTreatmentInput): ReportingTreatment {
  const metadata = metadataOf(input);
  const category = input.category ?? asString(metadata.category);
  const text = textFor(input);
  const type = directionOf(input);
  const status = lower(input.status);
  const rowStatus = lower(input.rowStatus ?? input.row_status ?? asString(metadata.row_status));
  const kpiReason =
    normaliseReason(input.kpiExclusionReason) ??
    normaliseReason(input.kpi_exclusion_reason) ??
    normaliseReason(asString(metadata.kpi_exclusion_reason));
  const kpiExcluded =
    input.kpiExcluded === true ||
    input.kpi_excluded === true ||
    metadata.kpi_excluded === true ||
    input.kpiTreatment === "excluded" ||
    metadata.kpi_treatment === "excluded" ||
    isKpiExcludedCategory(category);
  const sourceEvidence = compact([
    category ? `category:${category}` : undefined,
    input.transactionType ? `transaction_type:${input.transactionType}` : undefined,
    input.merchant || input.merchantName ? `merchant:${input.merchant ?? input.merchantName}` : undefined,
    input.reference ? `reference:${input.reference}` : undefined,
    kpiReason ? `kpi_reason:${kpiReason}` : undefined,
  ]);

  if (isDuplicate(input)) {
    return buildTreatment(input, "duplicate_row", {
      dataQuality: true,
      kpiExclusionReason: "duplicate",
      sourceEvidence: compact([...sourceEvidence, "duplicate_detection"]),
      confidence: 100,
      explanation: "Duplicate rows are retained in the audit trail but excluded from database inserts and KPI calculations.",
    });
  }

  if (isFailed(input)) {
    return buildTreatment(input, "failed_row", {
      dataQuality: true,
      kpiExclusionReason: "failed_row",
      sourceEvidence: compact([...sourceEvidence, "parse_errors"]),
      confidence: 100,
      explanation: "Failed rows are audit/data-quality records only until the parse issue is resolved.",
    });
  }

  if (!isUserConfirmed(input) && isPaymentProcessorIncome(input, text)) {
    return buildTreatment(input, "payment_processor_payout", {
      category: isKpiExcludedCategory(category) || !category ? "Revenue" : category,
      operatingRevenue: true,
      recurringRevenue: recurringRevenueCandidate(input, text),
      sourceEvidence: compact([...sourceEvidence, "payment_processor_income"]),
      confidence: 95,
      explanation: "Payment processor money-in is treated as operating revenue unless explicitly corrected by the user.",
    });
  }

  const creditCardRepayment =
    input.isCreditCardRepayment === true ||
    category === "Credit Card Payment" ||
    kpiReason === "credit_card_repayment" ||
    hasAny(text, ["credit card repayment", "credit card payment", "capital on tap", "capital one", "amex", "american express", "barclaycard"]);
  if (creditCardRepayment) {
    return buildTreatment(input, "credit_card_repayment", {
      cashMovement: true,
      balanceSheet: true,
      debt: true,
      kpiExclusionReason: "credit_card_repayment",
      sourceEvidence: compact([...sourceEvidence, "debt_repayment_signal"]),
      confidence: 95,
      explanation: "Credit card repayments move cash and reduce debt; principal repayment is excluded from operating revenue, expenses, and profit.",
    });
  }

  const loanRepayment =
    category !== "Owner Drawings" &&
    (category === "Loan Repayment" ||
      kpiReason === "loan_repayment" ||
      hasAny(text, ["loan repayment", "loan payment", "moneyway", "close brothers"]));
  if (loanRepayment) {
    return buildTreatment(input, "loan_repayment", {
      cashMovement: true,
      balanceSheet: true,
      debt: true,
      kpiExclusionReason: "loan_repayment",
      sourceEvidence: compact([...sourceEvidence, "loan_repayment_signal"]),
      confidence: 94,
      explanation: "Loan repayments move cash and reduce liabilities; principal repayment is not an operating expense.",
    });
  }

  const loanFunding = category === "Loans" || (type === "income" && hasAny(text, ["loan advance", "loan funding", "business loan"]));
  if (loanFunding) {
    return buildTreatment(input, "loan_funding", {
      cashMovement: true,
      balanceSheet: true,
      debt: true,
      kpiExclusionReason: "loans",
      sourceEvidence: compact([...sourceEvidence, "loan_funding_signal"]),
      confidence: 90,
      explanation: "Loan funding increases cash and liabilities, so it belongs in cash movement and debt tracking, not operating revenue.",
    });
  }

  const ownerDrawing =
    category === "Owner Drawings" ||
    kpiReason === "owner_drawings" ||
    hasAny(text, ["owner drawing", "owner transfer", "director loan", "shareholder", "dividend"]);
  if (ownerDrawing) {
    return buildTreatment(input, "owner_drawings", {
      cashMovement: true,
      balanceSheet: true,
      owner: true,
      kpiExclusionReason: "owner_drawings",
      sourceEvidence: compact([...sourceEvidence, "owner_movement_signal"]),
      confidence: 90,
      explanation: "Owner movements are cash and equity/director-loan movements, not operating expenses or profit.",
    });
  }

  const capitalInjection =
    category === "Capital Injection" ||
    kpiReason === "capital_injection" ||
    hasAny(text, ["capital injection", "share capital", "founder capital", "owner investment"]);
  if (capitalInjection) {
    return buildTreatment(input, "capital_injection", {
      cashMovement: true,
      balanceSheet: true,
      owner: true,
      kpiExclusionReason: "capital_injection",
      sourceEvidence: compact([...sourceEvidence, "capital_movement_signal"]),
      confidence: 90,
      explanation: "Capital injections increase cash and owner equity; they are excluded from operating revenue.",
    });
  }

  const transferCode: ReportingTreatmentCode | null =
    category === "Internal Transfer" || kpiReason === "internal_transfer" || hasAny(text, ["internal transfer", "own account", "between accounts", "business savings", "currency exchange"])
      ? "internal_transfer"
      : category === "International Transfer" || kpiReason === "international_transfer"
      ? "international_transfer"
      : category === "Money Transfer" || category === "Transfers" || kpiReason === "transfer" || input.isTransfer === true || rowStatus === "transfer" || status === "transfer" || (Array.isArray(input.tags) && input.tags.includes("transfer")) || isTransferStyleCategory(category)
      ? "money_transfer"
      : null;
  if (transferCode) {
    return buildTreatment(input, transferCode, {
      cashMovement: true,
      balanceSheet: true,
      kpiExclusionReason: getKpiExclusionReasonForCategory(category) ?? (transferCode === "internal_transfer" ? "internal_transfer" : transferCode === "international_transfer" ? "international_transfer" : "transfer"),
      sourceEvidence: compact([...sourceEvidence, "transfer_signal"]),
      confidence: 90,
      explanation: "Transfers are cash movements for reconciliation, but they are excluded from operating revenue, expenses, and profit.",
    });
  }

  if (isNeedsReview(input) || kpiReason === "needs_review" || kpiExcluded) {
    return buildTreatment(input, "data_quality_review", {
      cashMovement: type === "income" || type === "expense",
      dataQuality: true,
      kpiExclusionReason: kpiReason ?? getKpiExclusionReasonForCategory(category) ?? "needs_review",
      sourceEvidence: compact([...sourceEvidence, "review_required"]),
      confidence: 75,
      explanation: "Rows needing review remain traceable and can affect cash movement, but are excluded from operating KPIs until confirmed.",
    });
  }

  const refund = category === "Refunds" || category === "Refund" || hasAny(text, ["refund", "reversal", "chargeback"]);
  if (refund) {
    return buildTreatment(input, "refund_or_adjustment", {
      operatingRevenue: type === "income",
      operatingExpense: type === "expense",
      sourceEvidence: compact([...sourceEvidence, "refund_signal"]),
      confidence: 88,
      explanation: "Refunds and reversals are included in operating P&L according to bank direction and remain visible for review.",
    });
  }

  const taxPayment = category === "Tax" || hasAny(text, ["hmrc", "vat", "paye", "corporation tax", "tax payment"]);
  if (taxPayment) {
    return buildTreatment(input, "tax_payment", {
      operatingExpense: type === "expense",
      tax: true,
      sourceEvidence: compact([...sourceEvidence, "tax_signal"]),
      confidence: 92,
      explanation: "Tax payments are operating cash outflows and tax-reporting rows.",
    });
  }

  const bankFee = category === "Bank Fees" || category === "Payment Processor Fees" || hasAny(text, ["bank fee", "card fee", "processing fee", "processor fee"]);
  if (bankFee) {
    return buildTreatment(input, "bank_fee", {
      operatingExpense: type === "expense",
      sourceEvidence: compact([...sourceEvidence, "fee_signal"]),
      confidence: 90,
      explanation: "Fees are operating expenses and remain in P&L and cash flow.",
    });
  }

  const cogs = ["COGS", "Cost of Goods Sold", "Inventory", "Shipping", "Shipping and Fulfilment", "Fulfillment", "Materials"].includes(category ?? "");
  if (cogs) {
    return buildTreatment(input, "cost_of_goods_sold", {
      operatingExpense: type === "expense",
      sourceEvidence: compact([...sourceEvidence, "cogs_category"]),
      confidence: 90,
      explanation: "Direct costs are operating expenses and feed gross-margin reporting.",
    });
  }

  const subscription = category === "Subscriptions" || (category === "Software" && subscriptionCandidate(input, text));
  if (subscription) {
    return buildTreatment(input, "subscription_expense", {
      operatingExpense: type === "expense",
      subscription: true,
      sourceEvidence: compact([...sourceEvidence, "subscription_signal"]),
      confidence: 88,
      explanation: "Subscription/tool spend is an operating expense and is also tracked for subscription reporting.",
    });
  }

  if (type === "income") {
    return buildTreatment(input, "operating_revenue", {
      operatingRevenue: true,
      recurringRevenue: recurringRevenueCandidate(input, text),
      sourceEvidence: compact([...sourceEvidence, "income_direction"]),
      confidence: 82,
      explanation: "Income row is included in operating revenue because no transfer, owner, debt, duplicate, or review exclusion was found.",
    });
  }

  if (type === "expense") {
    return buildTreatment(input, "operating_expense", {
      operatingExpense: true,
      subscription: subscriptionCandidate(input, text),
      sourceEvidence: compact([...sourceEvidence, "expense_direction"]),
      confidence: 82,
      explanation: "Expense row is included in operating expenses because no transfer, owner, debt, duplicate, or review exclusion was found.",
    });
  }

  return buildTreatment(input, "data_quality_review", {
    dataQuality: true,
    kpiExclusionReason: "needs_review",
    sourceEvidence: compact([...sourceEvidence, "unknown_direction"]),
    confidence: 50,
    explanation: "Direction could not be trusted, so the row is held out of KPI calculations for review.",
  });
}

export function getReportingTreatment(input: ReportingTreatmentInput): ReportingTreatment {
  return getStoredReportingTreatment(input) ?? classifyReportingTreatment(input);
}

export function applyReportingTreatment<T extends ReportingTreatmentInput>(input: T): T & { reportingTreatment: ReportingTreatment } {
  const treatment = classifyReportingTreatment(input);
  const mutable = input as T & {
    reportingTreatment: ReportingTreatment;
    category?: string;
    kpiTreatment?: "included" | "excluded";
    kpiExcluded?: boolean;
    kpiExclusionReason?: string;
    isTransfer?: boolean;
    rowStatus?: string;
    status?: string;
  };

  mutable.reportingTreatment = treatment;
  if (!isUserConfirmed(input) && treatment.includedInOperatingRevenue && isKpiExcludedCategory(input.category)) {
    mutable.category = treatment.category;
  }
  mutable.kpiTreatment = treatment.includedInOperatingKpis ? "included" : "excluded";
  mutable.kpiExcluded = !treatment.includedInOperatingKpis;
  mutable.kpiExclusionReason = treatment.kpiExclusionReason;

  if (
    treatment.includedInCashMovement &&
    !treatment.includedInOperatingKpis &&
    !treatment.includedInDataQualityReporting
  ) {
    mutable.isTransfer = true;
    mutable.rowStatus = "transfer";
    mutable.status = "transfer";
  } else if (treatment.includedInOperatingRevenue || treatment.includedInOperatingExpenses) {
    mutable.isTransfer = false;
    if (mutable.rowStatus === "transfer") mutable.rowStatus = undefined;
    if (mutable.status === "transfer") mutable.status = "categorised";
  }

  return mutable;
}

export function formatReportingTreatment(input: ReportingTreatmentInput | ReportingTreatment): string {
  const treatment = "includedInOperatingRevenue" in input ? input : getReportingTreatment(input);
  if (treatment.includedInOperatingKpis) return `${treatment.label}: KPI included`;
  return `${treatment.label}: KPI excluded${treatment.kpiExclusionReason ? ` (${treatment.kpiExclusionReason.replace(/_/g, " ")})` : ""}`;
}

export function isIncludedInCashMovement(input: ReportingTreatmentInput): boolean {
  return getReportingTreatment(input).includedInCashMovement;
}

export function isIncludedInCashFlow(input: ReportingTreatmentInput): boolean {
  return getReportingTreatment(input).includedInCashFlow;
}

export function isIncludedInProfitAndLoss(input: ReportingTreatmentInput): boolean {
  return getReportingTreatment(input).includedInProfitAndLoss;
}
