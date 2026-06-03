"use client";

import { useState, useEffect } from "react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { AgentOrb } from "@/components/AgentOrb";
import { submitOnboarding, type OnboardingResult } from "./actions";
import {
  ArrowRight,
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle2,
  User,
  Building2,
  TrendingUp,
  Receipt,
  Zap,
  Crown,
} from "lucide-react";

/* ─── Step definitions ─── */

type StepId = 1 | 2 | 3 | 4 | 5;

const STEPS: { id: StepId; title: string; subtitle: string; icon: React.ElementType }[] = [
  { id: 1, title: "Founder profile", subtitle: "Tell us who you are", icon: User },
  { id: 2, title: "Business profile", subtitle: "About your company", icon: Building2 },
  { id: 3, title: "Revenue model", subtitle: "How you make money", icon: TrendingUp },
  { id: 4, title: "Expense profile", subtitle: "Where money goes", icon: Receipt },
  { id: 5, title: "Agent preferences", subtitle: "Tailor your copilot", icon: Zap },
];

/* ─── Options ─── */

const INDUSTRIES = [
  "Technology", "Finance", "Healthcare", "Retail", "Manufacturing",
  "Services", "Education", "Real Estate", "Energy", "Other",
];

const BUSINESS_STAGES = [
  "Idea stage", "Pre revenue", "Early revenue", "Growing", "Scaling", "Established",
];

const COUNTRIES = [
  { value: "GB", label: "United Kingdom" },
  { value: "US", label: "United States" },
  { value: "CA", label: "Canada" },
  { value: "AU", label: "Australia" },
  { value: "DE", label: "Germany" },
  { value: "FR", label: "France" },
  { value: "IE", label: "Ireland" },
  { value: "NL", label: "Netherlands" },
  { value: "SG", label: "Singapore" },
  { value: "JP", label: "Japan" },
  { value: "IN", label: "India" },
  { value: "Other", label: "Other" },
];

const CURRENCIES = ["GBP", "USD", "EUR", "AUD", "CAD", "JPY", "SGD"];

const TIMEZONES = [
  { value: "Europe/London", label: "London (GMT/BST)" },
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "Europe/Paris", label: "Paris (CET)" },
  { value: "Europe/Berlin", label: "Berlin (CET)" },
  { value: "Asia/Dubai", label: "Dubai (GST)" },
  { value: "Asia/Singapore", label: "Singapore (SGT)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)" },
  { value: "Australia/Sydney", label: "Sydney (AEDT)" },
  { value: "UTC", label: "UTC" },
];

const PRIMARY_GOALS = [
  "Improve cash flow",
  "Reduce costs",
  "Increase revenue",
  "Extend runway",
  "Track subscriptions",
  "Prepare for funding",
  "Understand financial health",
];

const REVENUE_MODELS = [
  "Subscriptions",
  "One-time sales",
  "Services",
  "Consulting",
  "Agency retainers",
  "Digital products",
  "Affiliate revenue",
  "Marketplace revenue",
  "Licensing",
  "Advertising revenue",
  "Usage-based revenue",
  "Mixed revenue",
  "Other",
  "Not sure yet",
];

const PAYMENT_TOOLS = [
  "Stripe", "PayPal", "Bank transfer", "Shopify",
  "WooCommerce", "GoCardless", "Square", "Wise", "Other",
];

const BIGGEST_COSTS = [
  "Software & tools", "Payroll", "Marketing & ads", "Cloud infrastructure",
  "Office & rent", "Contractors", "Legal & compliance", "Other",
];

const AGENT_FOCUS = [
  "Find cost savings", "Monitor runway", "Detect unusual transactions",
  "Improve profit margin", "Find cheaper tools", "Track subscription waste",
  "Prepare executive reports",
];

const AUTONOMY_LEVELS = [
  { value: "suggest_only", label: "Suggest only", desc: "FounderAgent recommends actions for you to review" },
  { value: "suggest_prepare", label: "Suggest & prepare", desc: "Agent drafts actions, you approve before execution" },
  { value: "suggest_approve", label: "Suggest, prepare & ask", desc: "Agent handles low-risk tasks, asks for big decisions" },
  { value: "autopilot_low", label: "Autopilot (low risk)", desc: "Agent auto-executes safe actions, alerts you on anything major" },
];

const REVENUE_RANGES = [
  { value: "", label: "Not sure yet" },
  { value: "pre_revenue", label: "Pre-revenue" },
  { value: "0-1000", label: "£0 – £1,000 / mo" },
  { value: "1001-5000", label: "£1,001 – £5,000 / mo" },
  { value: "5001-10000", label: "£5,001 – £10,000 / mo" },
  { value: "10001-25000", label: "£10,001 – £25,000 / mo" },
  { value: "25001-50000", label: "£25,001 – £50,000 / mo" },
  { value: "50001-100000", label: "£50,001 – £100,000 / mo" },
  { value: "100001-250000", label: "£100,001 – £250,000 / mo" },
  { value: "250001+", label: "£250,001+ / mo" },
];

const MRR_RANGES = [
  { value: "", label: "Not sure" },
  { value: "0", label: "£0" },
  { value: "1-1000", label: "£1 – £1,000" },
  { value: "1001-5000", label: "£1,001 – £5,000" },
  { value: "5001-10000", label: "£5,001 – £10,000" },
  { value: "10001-25000", label: "£10,001 – £25,000" },
  { value: "25001-50000", label: "£25,001 – £50,000" },
  { value: "50001+", label: "£50,001+" },
];

const ONE_TIME_RANGES = [
  { value: "", label: "Not sure" },
  { value: "0", label: "£0" },
  { value: "1-1000", label: "£1 – £1,000 / mo" },
  { value: "1001-5000", label: "£1,001 – £5,000 / mo" },
  { value: "5001-10000", label: "£5,001 – £10,000 / mo" },
  { value: "10001-25000", label: "£10,001 – £25,000 / mo" },
  { value: "25001+", label: "£25,001+ / mo" },
];

const EXPENSE_RANGES = [
  { value: "", label: "Not sure" },
  { value: "0-1000", label: "£0 – £1,000 / mo" },
  { value: "1001-5000", label: "£1,001 – £5,000 / mo" },
  { value: "5001-10000", label: "£5,001 – £10,000 / mo" },
  { value: "10001-25000", label: "£10,001 – £25,000 / mo" },
  { value: "25001-50000", label: "£25,001 – £50,000 / mo" },
  { value: "50001-100000", label: "£50,001 – £100,000 / mo" },
  { value: "100001+", label: "£100,001+ / mo" },
];

const SUBSCRIPTION_COUNT_RANGES = [
  { value: "", label: "Not sure" },
  { value: "0", label: "0" },
  { value: "1-3", label: "1 – 3" },
  { value: "4-10", label: "4 – 10" },
  { value: "11-25", label: "11 – 25" },
  { value: "26-50", label: "26 – 50" },
  { value: "51-100", label: "51 – 100" },
  { value: "100+", label: "100+" },
];

const PAYROLL_RANGES = [
  { value: "", label: "Not sure" },
  { value: "none", label: "None" },
  { value: "1-1000", label: "£1 – £1,000 / mo" },
  { value: "1001-5000", label: "£1,001 – £5,000 / mo" },
  { value: "5001-10000", label: "£5,001 – £10,000 / mo" },
  { value: "10001-25000", label: "£10,001 – £25,000 / mo" },
  { value: "25001-50000", label: "£25,001 – £50,000 / mo" },
  { value: "50001+", label: "£50,001+ / mo" },
];

const AD_RANGES = [
  { value: "", label: "Not sure" },
  { value: "none", label: "None" },
  { value: "1-500", label: "£1 – £500 / mo" },
  { value: "501-1000", label: "£501 – £1,000 / mo" },
  { value: "1001-5000", label: "£1,001 – £5,000 / mo" },
  { value: "5001-10000", label: "£5,001 – £10,000 / mo" },
  { value: "10001-25000", label: "£10,001 – £25,000 / mo" },
  { value: "25001+", label: "£25,001+ / mo" },
];

const CLOUD_RANGES = [
  { value: "", label: "Not sure" },
  { value: "none", label: "None" },
  { value: "1-100", label: "£1 – £100 / mo" },
  { value: "101-500", label: "£101 – £500 / mo" },
  { value: "501-1000", label: "£501 – £1,000 / mo" },
  { value: "1001-5000", label: "£1,001 – £5,000 / mo" },
  { value: "5001-10000", label: "£5,001 – £10,000 / mo" },
  { value: "10001+", label: "£10,001+ / mo" },
];

const LOADING_STAGES = [
  "Creating your workspace...",
  "Saving business profile...",
  "Configuring FounderAgent...",
  "Preparing dashboard...",
  "Launching FounderAgent...",
];

/* ─── Currency symbol helper ─── */
function getCurrencySymbol(currency: string): string {
  const map: Record<string, string> = { GBP: "£", USD: "$", EUR: "€", JPY: "¥", AUD: "A$", CAD: "C$", SGD: "S$" };
  return map[currency] || "£";
}

/* ─── Component ─── */

export default function OnboardingWizard() {
  const [step, setStep] = useState<StepId>(1);
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    fullName: "",
    role: "",
    companyName: "",
    industry: "",
    businessStage: "",
    country: "",
    currency: "GBP",
    fiscalYearStart: "1",
    timezone: "Europe/London",
    primaryGoal: "",
    revenueModels: [] as string[],
    monthlyRecurringRevenue: "",
    oneTimeRevenue: "",
    revenueRange: "",
    topRevenueChannels: [] as string[],
    paymentTools: [] as string[],
    averageMonthlyExpenses: "",
    biggestCostCategory: "",
    activeSubscriptionCount: "",
    toolsUsed: [] as string[],
    payrollSpend: "",
    advertisingSpend: "",
    cloudSpend: "",
    agentFocus: [] as string[],
    alertSensitivity: "medium",
    weeklyDigestEnabled: true,
    agentAutonomyLevel: "suggest_only",
  });

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleArray(key: "revenueModels" | "topRevenueChannels" | "paymentTools" | "toolsUsed" | "agentFocus", value: string) {
    setForm((prev) => {
      const arr = prev[key] as string[];
      const exists = arr.includes(value);
      return { ...prev, [key]: exists ? arr.filter((v) => v !== value) : [...arr, value] };
    });
  }

  const hasRecurringModel = form.revenueModels.some((m) =>
    ["Subscriptions", "Agency retainers", "Usage-based revenue", "Mixed revenue"].includes(m)
  );
  const hasOneTimeModel = form.revenueModels.some((m) =>
    ["One-time sales", "Services", "Consulting", "Digital products", "Mixed revenue", "Other"].includes(m)
  );

  function canProceed(): boolean {
    switch (step) {
      case 1:
        return !!form.fullName.trim() && !!form.companyName.trim();
      case 2:
        return !!form.industry && !!form.businessStage && !!form.currency && !!form.timezone && !!form.primaryGoal;
      case 3:
      case 4:
      case 5:
        return true;
      default:
        return false;
    }
  }

  // Loading stage animation
  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => {
      setLoadingStage((s) => (s < LOADING_STAGES.length - 1 ? s + 1 : s));
    }, 1200);
    return () => clearInterval(interval);
  }, [loading]);

  async function handleSubmit() {
    setError(null);
    setLoading(true);
    setLoadingStage(0);

    const data = new FormData();
    Object.entries(form).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        data.append(key, JSON.stringify(value));
      } else if (typeof value === "boolean") {
        data.append(key, String(value));
      } else {
        data.append(key, String(value ?? ""));
      }
    });

    const result: OnboardingResult = await submitOnboarding(data);
    setLoading(false);

    if (result?.error) {
      const stepName = result.step ? ` [${result.step}]` : "";
      setError(`${result.error}${stepName}`);
    }
    // On success, server action redirects automatically
  }

  const progressPercent = ((step - 1) / (STEPS.length - 1)) * 100;
  const currencySymbol = getCurrencySymbol(form.currency);

  return (
    <div className="min-h-screen flex flex-col items-center bg-[var(--background)] relative overflow-hidden py-8 px-4">
      {/* Ambient background */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-[-10%] left-[-5%] w-[50%] h-[50%] rounded-full opacity-40"
          style={{
            background: "radial-gradient(circle, rgba(139,92,246,0.18) 0%, transparent 60%)",
            filter: "blur(100px)",
          }}
        />
        <div
          className="absolute bottom-[-10%] right-[-5%] w-[45%] h-[45%] rounded-full opacity-25"
          style={{
            background: "radial-gradient(circle, rgba(20,184,166,0.12) 0%, transparent 60%)",
            filter: "blur(100px)",
          }}
        />
      </div>

      {/* Header */}
      <div className="relative z-10 flex flex-col items-center mb-6">
        <BrandLogo className="max-w-[160px] mb-4" />
        <AgentOrb size={48} animated active showGlow />
      </div>

      {/* Wizard card */}
      <div className="relative z-10 w-full max-w-xl">
        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex justify-between mb-2">
            {STEPS.map((s) => {
              const Icon = s.icon;
              const isActive = s.id === step;
              const isDone = s.id < step;
              return (
                <div key={s.id} className="flex flex-col items-center gap-1.5">
                  <div
                    className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-all ${
                      isDone
                        ? "bg-[var(--success)] text-white"
                        : isActive
                          ? "bg-gradient-to-br from-[var(--accent)] to-[var(--highlight)] text-white ring-2 ring-[var(--highlight)]/30 shadow-lg shadow-[var(--highlight)]/20"
                          : "bg-[var(--card)] text-[var(--muted-foreground)] border border-[var(--border)]"
                    }`}
                  >
                    {isDone ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <span
                    className={`text-[10px] font-medium hidden sm:block ${
                      isActive ? "text-[var(--highlight)]" : "text-[var(--muted-foreground)]"
                    }`}
                  >
                    {s.title}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="h-1 w-full bg-[var(--border)]/40 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[var(--accent)] via-[var(--highlight)] to-[var(--accent)] transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Card */}
        <div className="relative rounded-2xl border border-[var(--border)]/60 bg-[var(--card)]/40 backdrop-blur-xl p-6 sm:p-8 shadow-2xl">
          {/* Top accent line */}
          <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-[var(--highlight)]/50 to-transparent" />

          {/* Step header */}
          <div className="mb-6">
            <h1 className="text-xl font-bold text-[var(--foreground)]">
              {STEPS[step - 1].title}
            </h1>
            <p className="text-sm text-[var(--muted-foreground)] mt-1">
              {STEPS[step - 1].subtitle}
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-5 flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3">
              <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-red-300 font-medium">Setup step failed</p>
                <p className="text-xs text-red-300/80 mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {/* Step content */}
          <div className="space-y-5">
            {step === 1 && (
              <>
                <div className="flex flex-col items-center text-center mb-6">
                  <p className="text-xs text-[var(--muted-foreground)] max-w-xs">
                    FounderAgent is learning how your business works.
                    This helps your AI finance copilot give sharper recommendations.
                  </p>
                </div>
                <Field label="Full name" required>
                  <input
                    value={form.fullName}
                    onChange={(e) => update("fullName", e.target.value)}
                    placeholder="Alex Founder"
                    className="input-field"
                  />
                </Field>
                <Field label="Your role">
                  <input
                    value={form.role}
                    onChange={(e) => update("role", e.target.value)}
                    placeholder="CEO, CTO, Founder..."
                    className="input-field"
                  />
                </Field>
                <Field label="Company name" required>
                  <input
                    value={form.companyName}
                    onChange={(e) => update("companyName", e.target.value)}
                    placeholder="Acme Labs"
                    className="input-field"
                  />
                </Field>
              </>
            )}

            {step === 2 && (
              <>
                <Field label="Industry" required>
                  <select
                    value={form.industry}
                    onChange={(e) => update("industry", e.target.value)}
                    className="input-field"
                  >
                    <option value="">Select industry</option>
                    {INDUSTRIES.map((i) => (
                      <option key={i} value={i}>{i}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Business stage" required>
                  <select
                    value={form.businessStage}
                    onChange={(e) => update("businessStage", e.target.value)}
                    className="input-field"
                  >
                    <option value="">Select stage</option>
                    {BUSINESS_STAGES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Country">
                  <select
                    value={form.country}
                    onChange={(e) => update("country", e.target.value)}
                    className="input-field"
                  >
                    <option value="">Select country</option>
                    {COUNTRIES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Currency" required>
                    <select
                      value={form.currency}
                      onChange={(e) => update("currency", e.target.value)}
                      className="input-field"
                    >
                      {CURRENCIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Fiscal year start" required>
                    <select
                      value={form.fiscalYearStart}
                      onChange={(e) => update("fiscalYearStart", e.target.value)}
                      className="input-field"
                    >
                      {Array.from({ length: 12 }, (_, i) => (
                        <option key={i + 1} value={i + 1}>
                          {new Date(2000, i, 1).toLocaleString("default", { month: "long" })}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                <Field label="Timezone" required>
                  <select
                    value={form.timezone}
                    onChange={(e) => update("timezone", e.target.value)}
                    className="input-field"
                  >
                    {TIMEZONES.map((tz) => (
                      <option key={tz.value} value={tz.value}>{tz.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Primary goal" required>
                  <select
                    value={form.primaryGoal}
                    onChange={(e) => update("primaryGoal", e.target.value)}
                    className="input-field"
                  >
                    <option value="">Select goal</option>
                    {PRIMARY_GOALS.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </Field>
              </>
            )}

            {step === 3 && (
              <>
                <Field label="How does your business make money?">
                  <p className="text-[11px] text-[var(--muted-foreground)] mb-2">Select all that apply</p>
                  <div className="flex flex-wrap gap-2">
                    {REVENUE_MODELS.map((model) => (
                      <ChipToggle
                        key={model}
                        label={model}
                        selected={form.revenueModels.includes(model)}
                        onClick={() => toggleArray("revenueModels", model)}
                      />
                    ))}
                  </div>
                </Field>

                <Field label="Estimated monthly revenue">
                  <RangeSelect
                    value={form.revenueRange}
                    onChange={(v) => update("revenueRange", v)}
                    options={REVENUE_RANGES.map((r) => ({
                      value: r.value,
                      label: r.label.replace("£", currencySymbol),
                    }))}
                  />
                </Field>

                {hasRecurringModel && (
                  <Field label="Monthly recurring revenue (MRR)">
                    <RangeSelect
                      value={form.monthlyRecurringRevenue}
                      onChange={(v) => update("monthlyRecurringRevenue", v)}
                      options={MRR_RANGES.map((r) => ({
                        value: r.value,
                        label: r.label.replace("£", currencySymbol),
                      }))}
                    />
                  </Field>
                )}

                {hasOneTimeModel && (
                  <Field label="One-time revenue (monthly average)">
                    <RangeSelect
                      value={form.oneTimeRevenue}
                      onChange={(v) => update("oneTimeRevenue", v)}
                      options={ONE_TIME_RANGES.map((r) => ({
                        value: r.value,
                        label: r.label.replace("£", currencySymbol),
                      }))}
                    />
                  </Field>
                )}

                <Field label="Payment tools used">
                  <p className="text-[11px] text-[var(--muted-foreground)] mb-2">Select all that apply</p>
                  <div className="flex flex-wrap gap-2">
                    {PAYMENT_TOOLS.map((tool) => (
                      <ChipToggle
                        key={tool}
                        label={tool}
                        selected={form.paymentTools.includes(tool)}
                        onClick={() => toggleArray("paymentTools", tool)}
                      />
                    ))}
                  </div>
                </Field>
              </>
            )}

            {step === 4 && (
              <>
                <Field label="Average monthly expenses">
                  <RangeSelect
                    value={form.averageMonthlyExpenses}
                    onChange={(v) => update("averageMonthlyExpenses", v)}
                    options={EXPENSE_RANGES.map((r) => ({
                      value: r.value,
                      label: r.label.replace("£", currencySymbol),
                    }))}
                  />
                </Field>

                <Field label="Biggest cost category">
                  <select
                    value={form.biggestCostCategory}
                    onChange={(e) => update("biggestCostCategory", e.target.value)}
                    className="input-field"
                  >
                    <option value="">Select category</option>
                    {BIGGEST_COSTS.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Number of active subscriptions">
                  <RangeSelect
                    value={form.activeSubscriptionCount}
                    onChange={(v) => update("activeSubscriptionCount", v)}
                    options={SUBSCRIPTION_COUNT_RANGES}
                  />
                </Field>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Payroll / contractor spend">
                    <RangeSelect
                      value={form.payrollSpend}
                      onChange={(v) => update("payrollSpend", v)}
                      options={PAYROLL_RANGES.map((r) => ({
                        value: r.value,
                        label: r.label.replace("£", currencySymbol),
                      }))}
                    />
                  </Field>
                  <Field label="Advertising spend">
                    <RangeSelect
                      value={form.advertisingSpend}
                      onChange={(v) => update("advertisingSpend", v)}
                      options={AD_RANGES.map((r) => ({
                        value: r.value,
                        label: r.label.replace("£", currencySymbol),
                      }))}
                    />
                  </Field>
                </div>

                <Field label="Cloud infrastructure spend">
                  <RangeSelect
                    value={form.cloudSpend}
                    onChange={(v) => update("cloudSpend", v)}
                    options={CLOUD_RANGES.map((r) => ({
                      value: r.value,
                      label: r.label.replace("£", currencySymbol),
                    }))}
                  />
                </Field>
              </>
            )}

            {step === 5 && (
              <>
                <Field label="What should FounderAgent focus on first?">
                  <p className="text-[11px] text-[var(--muted-foreground)] mb-2">Select all that apply</p>
                  <div className="flex flex-wrap gap-2">
                    {AGENT_FOCUS.map((focus) => (
                      <ChipToggle
                        key={focus}
                        label={focus}
                        selected={form.agentFocus.includes(focus)}
                        onClick={() => toggleArray("agentFocus", focus)}
                        variant="purple"
                      />
                    ))}
                  </div>
                </Field>

                <Field label="Alert sensitivity">
                  <select
                    value={form.alertSensitivity}
                    onChange={(e) => update("alertSensitivity", e.target.value)}
                    className="input-field"
                  >
                    <option value="low">Low — only major issues</option>
                    <option value="medium">Medium — balanced</option>
                    <option value="high">High — flag everything</option>
                  </select>
                </Field>

                <Field label="Agent autonomy level">
                  <div className="space-y-2">
                    {AUTONOMY_LEVELS.map((level) => (
                      <button
                        key={level.value}
                        type="button"
                        onClick={() => update("agentAutonomyLevel", level.value)}
                        className={`w-full flex items-start gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
                          form.agentAutonomyLevel === level.value
                            ? "bg-gradient-to-r from-[var(--highlight)]/10 to-transparent border-[var(--highlight)]/40 text-[var(--foreground)] shadow-sm shadow-[var(--highlight)]/10"
                            : "bg-[var(--card)] border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--highlight)]/20"
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full border-2 shrink-0 mt-0.5 ${
                            form.agentAutonomyLevel === level.value
                              ? "border-[var(--highlight)] bg-[var(--highlight)]"
                              : "border-[var(--border)]"
                          }`}
                        />
                        <div>
                          <span className="text-sm font-medium block">{level.label}</span>
                          <span className="text-[11px] opacity-70">{level.desc}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </Field>

                <label className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--card)] cursor-pointer hover:border-[var(--highlight)]/30 transition-all">
                  <input
                    type="checkbox"
                    checked={form.weeklyDigestEnabled}
                    onChange={(e) => update("weeklyDigestEnabled", e.target.checked)}
                    className="w-4 h-4 rounded border-[var(--border)] text-[var(--highlight)] focus:ring-[var(--highlight)]/20"
                  />
                  <span className="text-sm text-[var(--foreground)]">
                    Send me a weekly digest of insights and recommendations
                  </span>
                </label>
              </>
            )}
          </div>

          {/* Footer buttons */}
          <div className="mt-8 flex items-center gap-3">
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep((s) => (s - 1) as StepId)}
                disabled={loading}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm font-medium text-[var(--foreground)] hover:bg-[var(--highlight)]/5 hover:border-[var(--highlight)]/20 transition-all disabled:opacity-50"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
            )}
            <div className="flex-1" />
            {step < 5 ? (
              <button
                type="button"
                onClick={() => setStep((s) => (s + 1) as StepId)}
                disabled={!canProceed() || loading}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-[var(--accent)] to-[#0d9488] text-sm font-semibold text-white shadow-lg shadow-[var(--accent)]/20 hover:shadow-[var(--accent)]/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="group relative flex items-center gap-2.5 px-7 py-3 rounded-xl text-sm font-bold text-white overflow-hidden transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {/* Gradient background */}
                <span className="absolute inset-0 bg-gradient-to-r from-[var(--highlight)] via-[#7c3aed] to-[var(--accent)] opacity-90 group-hover:opacity-100 transition-opacity" />
                {/* Glow effect */}
                <span className="absolute inset-0 opacity-0 group-hover:opacity-40 transition-opacity duration-500 bg-[var(--highlight)] blur-xl" />
                {/* Animated border glow */}
                <span className="absolute inset-0 rounded-xl ring-1 ring-white/20 group-hover:ring-[var(--highlight)]/50 transition-all" />

                <span className="relative flex items-center gap-2.5">
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="animate-pulse">{LOADING_STAGES[loadingStage]}</span>
                    </>
                  ) : (
                    <>
                      <Crown className="h-4 w-4" />
                      Activate FounderAgent
                    </>
                  )}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Microcopy footer */}
        <p className="text-center text-[11px] text-[var(--muted-foreground)]/60 mt-4">
          Your workspace will be created securely. You can update these settings anytime.
        </p>
      </div>

      {/* Global style helper for input-field */}
      <style jsx global>{`
        .input-field {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid var(--border);
          background: #0a0a12;
          padding: 0.625rem 1rem;
          font-size: 0.875rem;
          color: var(--foreground);
          transition: all 0.15s ease;
        }
        .input-field::placeholder {
          color: var(--muted-foreground);
          opacity: 0.5;
        }
        .input-field:focus {
          outline: none;
          border-color: var(--highlight);
          box-shadow: 0 0 0 1px rgba(139, 92, 246, 0.3);
        }
        select.input-field {
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 0.75rem center;
          padding-right: 2.5rem;
        }
      `}</style>
    </div>
  );
}

/* ─── Sub-components ─── */

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}

function ChipToggle({
  label,
  selected,
  onClick,
  variant = "default",
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  variant?: "default" | "purple";
}) {
  const purpleClasses = selected
    ? "bg-[var(--highlight)]/20 border-[var(--highlight)]/40 text-[var(--highlight)] shadow-sm shadow-[var(--highlight)]/10"
    : "bg-[var(--card)] border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--highlight)]/20";

  const defaultClasses = selected
    ? "bg-[var(--accent)]/15 border-[var(--accent)]/30 text-[var(--accent)]"
    : "bg-[var(--card)] border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--accent)]/20";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
        variant === "purple" ? purpleClasses : defaultClasses
      }`}
    >
      {label}
    </button>
  );
}

function RangeSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="input-field"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
}
