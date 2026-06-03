"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDate } from "@/lib/utils/formatters";
import {
  Upload,
  FileText,
  Settings2,
  Eye,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Database,
  Brain,
  AlertTriangle,
  Tag,
  ArrowLeftRight,
  HelpCircle,
  CreditCard,
} from "lucide-react";
import {
  validateAndPreview,
  applyMappingOverrides,
  confirmAndProcess,
  getUploadStatus,
  refreshSession,
  loadMappingProfiles,
  saveCurrentMappingProfile,
} from "./wizard-actions";
import MerchantLogo from "@/components/features/transaction/MerchantLogo";
import { usePatternSuggestions } from "@/components/features/upload/usePatternSuggestions";
import { ApplyToSimilarConfirm } from "@/components/features/upload/ApplyToSimilarConfirm";
import { FullScreenReview } from "@/components/features/upload/FullScreenReview";
import { formatKpiExclusionReason } from "@/lib/kpi-treatment";
import type {
  WizardStep,
  SourceType,
  WizardPreview,
  MappingOverrides,
  ImportSummary,
} from "@/lib/upload/wizard-types";
import { getImportReconciliation } from "@/lib/upload/reconciliation";

const SOURCE_OPTIONS: { value: SourceType; label: string }[] = [
  { value: "auto_detect", label: "Auto Detect" },
  { value: "bank_statement_csv", label: "Bank Statement CSV" },
  { value: "generic_bank", label: "Generic Bank" },
  { value: "payment_processor_csv", label: "Payment Processor CSV" },
  { value: "accounting_export_csv", label: "Accounting Export CSV" },
  { value: "manual_csv", label: "Manual CSV" },
];

const DETECTED_PROVIDER_LABELS: Record<string, string> = {
  revolut_business_csv: "Revolut Business",
  tide: "Tide",
  monzo: "Monzo",
  starling: "Starling",
  wise: "Wise",
  barclays: "Barclays",
  hsbc: "HSBC",
  lloyds: "Lloyds",
  natwest: "NatWest",
  chase: "Chase",
  stripe_csv: "Stripe",
  paypal_csv: "PayPal",
  square_csv: "Square",
  gocardless_csv: "GoCardless",
  shopify_payouts_csv: "Shopify Payouts",
  generic_bank: "Generic Bank",
  manual_csv: "Manual CSV",
};

function buildSummaryFromStatus(status: Awaited<ReturnType<typeof getUploadStatus>>): ImportSummary {
  const rec = getImportReconciliation(status.metadata);
  const metadata = status.metadata ?? {};
  const rowsImported = rec?.rowsInserted ?? status.transactionCount ?? 0;
  return {
    success: status.status === "completed",
    uploadId: status.uploadId,
    fileName: status.fileName ?? "",
    sourceType: (status.source as SourceType | undefined) ?? "bank_statement_csv",
    rowsInFile: rec?.rowsInFile ?? rowsImported,
    rowsParsed: rec?.rowsParsed ?? rowsImported,
    rowsValid: rec?.rowsValid ?? rowsImported,
    rowsImported,
    rowsSkipped: rec?.rowsSkippedDuplicate ?? 0,
    rowsFailed: rec?.rowsFailed ?? 0,
    rowsNeedReview: rec?.rowsNeedingReview ?? 0,
    rowsUncategorised: rec?.rowsUncategorised ?? 0,
    rowsAmbiguous: rec?.rowsAmbiguous ?? 0,
    rowsCategorised: rec?.rowsCategorised ?? 0,
    rowsHighConfidence: rec?.rowsHighConfidence ?? 0,
    rowsCategorisedByUserRule: rec?.rowsCategorisedByUserRule ?? 0,
    rowsCategorisedBySystemIntelligence: rec?.rowsCategorisedBySystemIntelligence ?? 0,
    rowsIncludedInRevenue: rec?.rowsIncludedInRevenue ?? 0,
    rowsIncludedInExpenses: rec?.rowsIncludedInExpenses ?? 0,
    rowsIncludedInCashFlow: rec?.rowsIncludedInCashFlow ?? 0,
    rowsTransfer: rec?.rowsMarkedTransfer ?? 0,
    rowsDuplicate: rec?.rowsSkippedDuplicate ?? 0,
    rowsKpiExcluded: rec?.rowsExcludedFromKpis ?? 0,
    rowsLinkedToSubscriptions: rec?.rowsLinkedToSubscriptions ?? 0,
    rowsWithFees: rec?.rowsWithFees ?? 0,
    rowsWithRefunds: rec?.rowsWithRefunds ?? 0,
    rowsWithCreditCardRepaymentTreatment: rec?.rowsWithCreditCardRepaymentTreatment ?? 0,
    reconciliationBalanced: rec?.reconciliationBalanced ?? status.status === "completed",
    reconciliationExplanation: rec?.explanation,
    incomeTotal: 0,
    expenseTotal: 0,
    sourceCurrency: (metadata.detected_currency as string | undefined) ?? "",
    baseCurrency: (metadata.base_currency as string | undefined) ?? (metadata.detected_currency as string | undefined) ?? "",
    subscriptionsDetected: (metadata.subscriptions_detected as number | undefined) ?? 0,
    unknownTransactions: rec?.rowsUncategorised ?? rec?.rowsNeedingReview ?? 0,
    alertsCreated: (metadata.alerts_created as number | undefined) ?? 0,
    recommendationsCreated: (metadata.recommendations_created as number | undefined) ?? 0,
    error: status.errorMessage,
  };
}

const DATE_FORMAT_OPTIONS = [
  { value: "", label: "Auto-detected" },
  { value: "DD/MM/YYYY", label: "DD/MM/YYYY (UK/EU/AU)" },
  { value: "MM/DD/YYYY", label: "MM/DD/YYYY (US)" },
  { value: "YYYY-MM-DD", label: "YYYY-MM-DD (ISO)" },
  { value: "DD.MM.YYYY", label: "DD.MM.YYYY (European)" },
];

const SIGN_CONVENTION_OPTIONS = [
  { value: "", label: "Auto-detected (UK standard)" },
  { value: "uk_bank", label: "UK Bank — negative = expense" },
  { value: "us_bank", label: "US Bank — positive = expense" },
  { value: "accounting", label: "Accounting — positive = income" },
];

const FIELD_OPTIONS = [
  { value: "", label: "— Not mapped —" },
  { value: "date", label: "Transaction Date", required: true },
  { value: "description", label: "Description", required: true },
  { value: "merchant", label: "Merchant", required: true },
  { value: "amount", label: "Amount", required: true },
  { value: "debit", label: "Debit (Money Out)" },
  { value: "credit", label: "Credit (Money In)" },
  { value: "currency", label: "Currency" },
  { value: "balance", label: "Balance" },
  { value: "type", label: "Transaction Type" },
  { value: "reference", label: "Reference" },
  { value: "externalTransactionId", label: "External Transaction ID" },
  { value: "merchantCategoryCode", label: "Merchant Category Code (MCC)" },
  { value: "category", label: "Category" },
];

const REQUIRED_FIELDS = ["date"];
const EITHER_OR_GROUPS: string[][] = [
  ["description", "merchant"],
  ["amount", "debit", "credit"],
];

type ErrorCategory = "parse" | "validation" | "system";

interface WizardError {
  category: ErrorCategory;
  title: string;
  message: string;
}

export default function UploadWizard() {
  const searchParams = useSearchParams();
  const isSetupMode = searchParams.get("setup") === "true";

  const [uploadId, setUploadId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      return params.get("upload") || "";
    }
    return "";
  });
  const [step, setStep] = useState<WizardStep>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      return params.get("upload") ? "processing" : "upload";
    }
    return "upload";
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<WizardError | null>(null);
  const [sourceType, setSourceType] = useState<SourceType>("auto_detect");
  const [dragActive, setDragActive] = useState(false);
  const [preview, setPreview] = useState<WizardPreview | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [mappingOverrides, setMappingOverrides] = useState<MappingOverrides>({});
  const [fileName, setFileName] = useState<string>("");
  const [sessionId, setSessionId] = useState<string>("");
  const [pipelineStage, setPipelineStage] = useState<string>("");
  const [pipelineProgress, setPipelineProgress] = useState<number>(0);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasResumedRef = useRef(false);
  const isSubmittingRef = useRef(false);
  const [profiles, setProfiles] = useState<{ id: string; name: string; sourceType: string }[]>([]);
  const [showSaveProfile, setShowSaveProfile] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileDefault, setProfileDefault] = useState(false);
  const [providerConfirmed, setProviderConfirmed] = useState(false);
  const [editedCategories, setEditedCategories] = useState<Record<number, string>>({});

  function startPolling(id: string) {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    pollIntervalRef.current = setInterval(async () => {
      const status = await getUploadStatus(id);
      if (status.pipelineStage) setPipelineStage(status.pipelineStage);
      if (status.pipelineProgress !== undefined) setPipelineProgress(status.pipelineProgress);

      if (status.status === "completed") {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        setSummary(buildSummaryFromStatus(status));
        setStep("summary");
        // Clean URL
        window.history.replaceState({}, "", window.location.pathname);
      } else if (status.status === "failed") {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        const failedSummary = buildSummaryFromStatus(status);
        if (failedSummary.rowsInFile > 0 || failedSummary.reconciliationExplanation) {
          setSummary(failedSummary);
          setStep("summary");
          window.history.replaceState({}, "", window.location.pathname);
          return;
        }
        setError({
          category: "system",
          title: "Import failed",
          message: status.errorMessage || "The import process failed. Please try again.",
        });
        setStep("preview");
        window.history.replaceState({}, "", window.location.pathname);
      }
    }, 2000);
  }

  // Resume polling from URL on mount
  useEffect(() => {
    if (hasResumedRef.current) return;
    hasResumedRef.current = true;

    if (uploadId) {
      startPolling(uploadId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, []);

  // Session heartbeat: refresh expiry every 5 minutes while on preview/mapping
  useEffect(() => {
    if ((step === "preview" || step === "mapping") && sessionId) {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      heartbeatRef.current = setInterval(async () => {
        try {
          await refreshSession(sessionId);
        } catch (e) {
          console.warn("[upload] Session heartbeat failed:", e);
        }
      }, 5 * 60 * 1000); // 5 minutes
      return () => {
        if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      };
    }
  }, [step, sessionId]);

  /* ─── Step 1: Upload ─── */

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleFileUpload = async (file: File) => {
    setIsLoading(true);
    setError(null);
    setFileName(file.name);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("sourceType", sourceType);

    const result = await validateAndPreview(formData);
    setIsLoading(false);

    if (!result.success) {
      setError({
        category: "parse",
        title: "Could not read file",
        message: result.error ?? "Preview failed",
      });
      return;
    }

    if (result.preview && result.sessionId) {
      setPreview(result.preview);
      setSessionId(result.sessionId);
      if (sourceType === "auto_detect" && result.preview.sourceType) {
        const confidence = result.preview.providerConfidence ?? 0;
        if (confidence >= 85) {
          setSourceType(result.preview.sourceType);
        } else if (confidence >= 50) {
          setSourceType(result.preview.sourceType);
        } else {
          setSourceType("bank_statement_csv");
        }
      }
      // Initialise mapping overrides from detected mappings
      const overrides: MappingOverrides = {};
      for (const m of result.preview.columnMappings) {
        const key = `${m.field}Column` as Extract<keyof MappingOverrides, `${string}Column`>;
        overrides[key] = m.header;
      }
      setMappingOverrides(overrides);
      setStep("mapping");
    }
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFileUpload(e.dataTransfer.files[0]);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sourceType]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  /* ─── Step 2: Mapping ─── */

  const handleMappingChange = async (field: string, headerValue: string) => {
    const newOverrides = { ...mappingOverrides };
    const key = `${field}Column` as Extract<keyof MappingOverrides, `${string}Column`>;
    if (headerValue) {
      newOverrides[key] = headerValue;
    } else {
      delete newOverrides[key];
    }
    setMappingOverrides(newOverrides);

    // Re-preview with new mapping
    setIsLoading(true);
    const result = await applyMappingOverrides(sessionId, newOverrides, sourceType);
    setIsLoading(false);

    if (result.success && result.preview) {
      setPreview(result.preview);
    } else if (result.error) {
      setError({
        category: "validation",
        title: "Mapping error",
        message: result.error,
      });
    }
  };

  const handleDateFormatChange = async (format: string) => {
    const newOverrides = { ...mappingOverrides, dateFormat: format || undefined };
    setMappingOverrides(newOverrides);

    setIsLoading(true);
    const result = await applyMappingOverrides(sessionId, newOverrides, sourceType);
    setIsLoading(false);

    if (result.success && result.preview) {
      setPreview(result.preview);
    }
  };

  const handleSignConventionChange = async (convention: string) => {
    const newOverrides = { ...mappingOverrides, signConvention: (convention || undefined) as MappingOverrides["signConvention"] };
    setMappingOverrides(newOverrides);

    setIsLoading(true);
    const result = await applyMappingOverrides(sessionId, newOverrides, sourceType);
    setIsLoading(false);

    if (result.success && result.preview) {
      setPreview(result.preview);
    }
  };

  const handleSourceTypeChange = async (newSourceType: SourceType) => {
    setSourceType(newSourceType);
    setProviderConfirmed(false);
    if (!sessionId) return;
    setIsLoading(true);
    const result = await applyMappingOverrides(sessionId, mappingOverrides, newSourceType);
    setIsLoading(false);
    if (result.success && result.preview) {
      setPreview(result.preview);
    } else if (result.error) {
      setError({
        category: "validation",
        title: "Source type error",
        message: result.error,
      });
    }
  };

  /* ─── Mapping Profiles ─── */

  const handleLoadProfiles = async () => {
    const result = await loadMappingProfiles(sourceType);
    if (result.success && result.profiles) {
      setProfiles(result.profiles);
    }
  };

  const handleLoadProfile = async (profileId: string) => {
    const profile = profiles.find((p) => p.id === profileId);
    if (!profile) return;

    setIsLoading(true);
    const result = await applyMappingOverrides(sessionId, mappingOverrides, sourceType);
    setIsLoading(false);

    if (result.success && result.preview) {
      setPreview(result.preview);
      // Re-derive overrides from the loaded profile's mappings
      const newOverrides: MappingOverrides = {};
      for (const m of result.preview.columnMappings) {
        const key = `${m.field}Column` as Extract<keyof MappingOverrides, `${string}Column`>;
        newOverrides[key] = m.header;
      }
      setMappingOverrides(newOverrides);
    }
  };

  const handleSaveProfile = async () => {
    if (!preview || !profileName.trim()) return;
    const result = await saveCurrentMappingProfile(profileName.trim(), preview, mappingOverrides, profileDefault);
    if (result.success) {
      setShowSaveProfile(false);
      setProfileName("");
      setProfileDefault(false);
      await handleLoadProfiles();
    }
  };

  /* ─── Validation ─── */

  const isMappingValid = (): { valid: boolean; missing: string[] } => {
    if (!preview) return { valid: false, missing: [] };

    const mappedFields = new Set(preview.columnMappings.map((m) => m.field));
    const missing: string[] = [];

    for (const req of REQUIRED_FIELDS) {
      if (!mappedFields.has(req)) missing.push(req);
    }

    for (const group of EITHER_OR_GROUPS) {
      const hasAny = group.some((f) => mappedFields.has(f));
      if (!hasAny) missing.push(group.join(" or "));
    }

    return { valid: missing.length === 0, missing };
  };

  /* ─── Step 3: Preview → Step 4: Processing ─── */

  const handleConfirmImport = async (categoryOverrides?: Record<number, string>) => {
    if (isSubmittingRef.current) return;
    if (!preview || !sessionId) return;

    isSubmittingRef.current = true;
    setIsLoading(true);

    try {
      const { valid, missing } = isMappingValid();
      if (!valid) {
        setError({
          category: "validation",
          title: "Required fields missing",
          message: `Please map the following fields before importing: ${missing.join(", ")}`,
        });
        return;
      }

      setStep("processing");
      setError(null);

      const result = await confirmAndProcess(sessionId, mappingOverrides, categoryOverrides);

      if (result.success && result.summary && result.uploadId) {
        setUploadId(result.uploadId);
        // Set URL for resumption
        window.history.replaceState({}, "", `?upload=${result.uploadId}`);
        startPolling(result.uploadId);
      } else if (result.summary) {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        setSummary(result.summary);
        setStep("summary");
      } else {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        setError({
          category: "system",
          title: "Import failed",
          message: result.error ?? "Import failed",
        });
        setStep("preview");
      }
    } finally {
      setIsLoading(false);
      isSubmittingRef.current = false;
    }
  };

  /* ─── Reset ─── */

  const handleReset = () => {
    setStep("upload");
    setPreview(null);
    setSummary(null);
    setError(null);
    setMappingOverrides({});
    setEditedCategories({});
    setFileName("");
    setSessionId("");
    setUploadId("");
    setPipelineStage("");
    setPipelineProgress(0);
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    window.history.replaceState({}, "", window.location.pathname);
  };

  /* ─── Currency symbol helper ─── */

  const getCurrencySymbol = (): string => {
    const map: Record<string, string> = {
      GBP: "£",
      USD: "$",
      EUR: "€",
      JPY: "¥",
      INR: "₹",
      AUD: "A$",
      CAD: "C$",
    };
    return map[preview?.detectedCurrency || ""] || "£";
  };

  /* ─── Render ─── */

  return (
    <div className="space-y-6">
      <PageHeader
        title="Upload Centre"
        subtitle="Upload financial documents and let FounderAgent intelligently map, preview, and import everything."
      />

      {/* Progress Steps */}
      <StepIndicator step={step} />

      {/* Error Banner */}
      {error && (
        <div
          className={`rounded-xl border p-4 flex items-start gap-3 ${
            error.category === "system"
              ? "border-rose-500/30 bg-rose-500/10"
              : error.category === "parse"
              ? "border-amber-500/30 bg-amber-500/10"
              : "border-orange-500/30 bg-orange-500/10"
          }`}
        >
          <AlertCircle
            className={`h-5 w-5 shrink-0 mt-0.5 ${
              error.category === "system" ? "text-rose-400" : "text-amber-400"
            }`}
          />
          <div>
            <p
              className={`text-sm font-semibold ${
                error.category === "system" ? "text-rose-300" : "text-amber-300"
              }`}
            >
              {error.title}
            </p>
            <p
              className={`text-xs mt-0.5 ${
                error.category === "system" ? "text-rose-200/80" : "text-amber-200/80"
              }`}
            >
              {error.message}
            </p>
          </div>
        </div>
      )}

      {/* Step Content */}
      {step === "upload" && isSetupMode && (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
          <div className="w-20 h-20 rounded-full bg-[var(--highlight)]/10 flex items-center justify-center">
            <Upload className="w-10 h-10 text-[var(--highlight)]" />
          </div>
          <h2 className="text-2xl font-bold">Connect your first financial data source</h2>
          <p className="text-[var(--muted-foreground)] max-w-md">
            Upload your bank statement so FounderAgent can build your dashboard,
            categorise your spending, calculate your runway, and generate insights.
          </p>
          <button
            onClick={() => {
              // Remove setup param from URL without reloading
              const url = new URL(window.location.href);
              url.searchParams.delete("setup");
              window.history.replaceState({}, "", url.toString());
              setStep("upload");
            }}
            className="btn-primary text-sm"
          >
            <Upload className="h-4 w-4" />
            Upload Statement
          </button>
        </div>
      )}

      {step === "upload" && !isSetupMode && (
        <UploadStep
          dragActive={dragActive}
          isLoading={isLoading}
          sourceType={sourceType}
          setSourceType={setSourceType}
          onDrag={handleDrag}
          onDrop={handleDrop}
          onFileChange={handleFileChange}
        />
      )}

      {step === "mapping" && preview && (
        <MappingStep
          preview={preview}
          fileName={fileName}
          overrides={mappingOverrides}
          profiles={profiles}
          showSaveProfile={showSaveProfile}
          profileName={profileName}
          profileDefault={profileDefault}
          sourceType={sourceType}
          currencySymbol={getCurrencySymbol()}
          onMappingChange={handleMappingChange}
          onDateFormatChange={handleDateFormatChange}
          onSignConventionChange={handleSignConventionChange}
          onSourceTypeChange={handleSourceTypeChange}
          onLoadProfiles={handleLoadProfiles}
          onLoadProfile={handleLoadProfile}
          onToggleSaveProfile={() => setShowSaveProfile((v) => !v)}
          onProfileNameChange={setProfileName}
          onProfileDefaultChange={setProfileDefault}
          onSaveProfile={handleSaveProfile}
          onConfirmProvider={() => setProviderConfirmed(true)}
          onContinue={() => {
            const { valid, missing } = isMappingValid();
            if (!valid) {
              setError({
                category: "validation",
                title: "Required fields missing",
                message: `Please map: ${missing.join(", ")}`,
              });
              return;
            }
            setError(null);
            setStep("preview");
          }}
          onBack={handleReset}
          isLoading={isLoading}
          isValid={isMappingValid().valid}
          missingFields={isMappingValid().missing}
          providerConfirmed={providerConfirmed}
        />
      )}

      {step === "preview" && preview && (
        <PreviewStep
          preview={preview}
          fileName={fileName}
          currencySymbol={getCurrencySymbol()}
          onConfirm={() => handleConfirmImport(editedCategories)}
          onBack={() => setStep("mapping")}
          editedCategories={editedCategories}
          onEditCategory={setEditedCategories}
          isLoading={isLoading}

        />
      )}

      {step === "processing" && (
        <ProcessingStep
          fileName={fileName}
          stage={pipelineStage}
          progress={pipelineProgress}
        />
      )}

      {step === "summary" && summary && (
        <SummaryStep summary={summary} currencySymbol={getCurrencySymbol()} onUploadAnother={handleReset} />
      )}
    </div>
  );
}

/* ─── Sub-components ─── */

function StepIndicator({ step }: { step: WizardStep }) {
  const steps: { id: WizardStep; label: string; icon: React.ReactNode }[] = [
    { id: "upload", label: "Upload", icon: <Upload className="h-4 w-4" /> },
    { id: "mapping", label: "Map", icon: <Settings2 className="h-4 w-4" /> },
    { id: "preview", label: "Preview", icon: <Eye className="h-4 w-4" /> },
    { id: "processing", label: "Import", icon: <RefreshCw className="h-4 w-4" /> },
    { id: "summary", label: "Summary", icon: <CheckCircle2 className="h-4 w-4" /> },
  ];

  const currentIndex = steps.findIndex((s) => s.id === step);

  return (
    <div className="flex items-center justify-between gap-2">
      {steps.map((s, idx) => {
        const isActive = idx === currentIndex;
        const isDone = idx < currentIndex;
        return (
          <div key={s.id} className="flex items-center gap-2 flex-1">
            <div
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                isActive
                  ? "bg-[rgba(20,184,166,0.15)] text-[var(--accent)]"
                  : isDone
                  ? "bg-[rgba(20,184,166,0.08)] text-[var(--accent)]/70"
                  : "bg-[rgba(148,163,184,0.08)] text-[var(--muted-foreground)]"
              }`}
            >
              {isDone ? <CheckCircle2 className="h-3.5 w-3.5" /> : s.icon}
              <span className="hidden sm:inline">{s.label}</span>
            </div>
            {idx < steps.length - 1 && (
              <div
                className={`h-px flex-1 ${
                  isDone ? "bg-[var(--accent)]/30" : "bg-[rgba(148,163,184,0.16)]"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function UploadStep({
  dragActive,
  isLoading,
  sourceType,
  setSourceType,
  onDrag,
  onDrop,
  onFileChange,
}: {
  dragActive: boolean;
  isLoading: boolean;
  sourceType: SourceType;
  setSourceType: (v: SourceType) => void;
  onDrag: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="rounded-xl border p-6" style={{ borderColor: "rgba(148,163,184,0.16)", background: "#111827" }}>
      <div className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
            Source Type
          </label>
          <select
            value={sourceType}
            onChange={(e) => setSourceType(e.target.value as SourceType)}
            className="input-field w-full max-w-xs"
          >
            {SOURCE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-[var(--muted-foreground)] mt-1.5">
            Select the source or let FounderAgent auto-detect.
          </p>
        </div>

        <form
          onDragEnter={onDrag}
          onDragLeave={onDrag}
          onDragOver={onDrag}
          onDrop={onDrop}
        >
          <label
            className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 sm:p-12 text-center transition-colors ${
              dragActive ? "border-[#14B8A6]/60" : ""
            } hover:border-[#14B8A6]/40`}
            style={{
              borderColor: dragActive
                ? "rgba(20,184,166,0.5)"
                : "rgba(148,163,184,0.24)",
              background: "rgba(17,24,39,0.5)",
            }}
          >
            <div
              className="flex h-16 w-16 items-center justify-center rounded-full"
              style={{
                background:
                  "linear-gradient(135deg, rgba(20,184,166,0.15) 0%, rgba(139,92,246,0.1) 100%)",
              }}
            >
              {isLoading ? (
                <Loader2 className="h-7 w-7 text-[var(--accent)] animate-spin" />
              ) : (
                <Upload className="h-7 w-7 text-[var(--accent)]" />
              )}
            </div>
            <p className="mt-4 text-sm font-semibold text-[var(--foreground)]">
              {isLoading ? "Analysing your file..." : "Click or drag CSV to upload"}
            </p>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              Supports CSV, TXT, TSV, XLSX up to 20MB
            </p>
            <input
              type="file"
              className="hidden"
              accept=".csv,.txt,.tsv,.xlsx,.xls"
              onChange={onFileChange}
              disabled={isLoading}
            />
          </label>
        </form>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Bank CSV", icon: <FileText className="h-4 w-4" /> },
            { label: "Stripe", icon: <TrendingUp className="h-4 w-4" /> },
            { label: "PayPal", icon: <TrendingDown className="h-4 w-4" /> },
            { label: "QuickBooks", icon: <Database className="h-4 w-4" /> },
          ].map((s) => (
            <div
              key={s.label}
              className="flex items-center gap-2 rounded-lg border px-3 py-2"
              style={{ borderColor: "rgba(148,163,184,0.16)" }}
            >
              <span className="text-[var(--muted-foreground)]">{s.icon}</span>
              <span className="text-xs text-[var(--muted-foreground)]">{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MappingStep({
  preview,
  fileName,
  overrides,
  profiles,
  showSaveProfile,
  profileName,
  profileDefault,
  sourceType,
  currencySymbol,
  onMappingChange,
  onDateFormatChange,
  onSignConventionChange,
  onSourceTypeChange,
  onLoadProfiles,
  onLoadProfile,
  onToggleSaveProfile,
  onProfileNameChange,
  onProfileDefaultChange,
  onSaveProfile,
  onConfirmProvider,
  onContinue,
  onBack,
  isLoading,
  isValid,
  missingFields,
  providerConfirmed,
}: {
  preview: WizardPreview;
  fileName: string;
  overrides: MappingOverrides;
  profiles: { id: string; name: string; sourceType: string }[];
  showSaveProfile: boolean;
  profileName: string;
  profileDefault: boolean;
  sourceType: SourceType;
  currencySymbol: string;
  onMappingChange: (field: string, header: string) => void;
  onDateFormatChange: (format: string) => void;
  onSignConventionChange: (convention: string) => void;
  onSourceTypeChange: (v: SourceType) => void;
  onLoadProfiles: () => void;
  onLoadProfile: (profileId: string) => void;
  onToggleSaveProfile: () => void;
  onProfileNameChange: (name: string) => void;
  onProfileDefaultChange: (v: boolean) => void;
  onSaveProfile: () => void;
  onConfirmProvider: () => void;
  onContinue: () => void;
  onBack: () => void;
  isLoading: boolean;
  isValid: boolean;
  missingFields: string[];
  providerConfirmed: boolean;
}) {
  const allHeaders = useMemo(() => {
    return preview.previewRows[0]?.rawData
      ? Object.keys(preview.previewRows[0].rawData)
      : (preview.parsedHeaders ?? []);
  }, [preview]);

  const getMappedHeader = (field: string): string => {
    const mapping = preview.columnMappings.find((m) => m.field === field);
    return mapping?.header ?? "";
  };

  const getConfidenceColor = (score: number): string => {
    if (score >= 85) return "text-emerald-400";
    if (score >= 60) return "text-amber-400";
    return "text-rose-400";
  };

  const getSamplesForHeader = (header: string): string[] => {
    const sample = preview.columnSamples.find((s) => s.header === header);
    return sample?.samples ?? [];
  };

  const autoMappedFieldsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const mappedFields = new Set(preview.columnMappings.map((m) => m.field));
    const headers = allHeaders;

    let field = "";
    let header = "";

    if (preview.detectedProvider === "revolut_business_csv") {
      if (!mappedFields.has("amount") && !autoMappedFieldsRef.current.has("amount")) {
        const candidates = ["Amount", "Total Amount", "Orig Amount"];
        for (const c of candidates) {
          if (headers.includes(c)) {
            field = "amount";
            header = c;
            break;
          }
        }
      }
    } else {
      if (!mappedFields.has("amount") && !autoMappedFieldsRef.current.has("amount") && !mappedFields.has("debit") && !mappedFields.has("credit")) {
        const amountLike = headers.filter((h) => /amount|total|sum|value/i.test(h));
        if (amountLike.length === 1) {
          field = "amount";
          header = amountLike[0];
        }
      }

      if (!field) {
        const debitHeader = headers.find((h) => /^(debit|money out|out)$/i.test(h));
        const creditHeader = headers.find((h) => /^(credit|money in|in)$/i.test(h));
        if (debitHeader && creditHeader) {
          if (!mappedFields.has("debit") && !autoMappedFieldsRef.current.has("debit")) {
            field = "debit";
            header = debitHeader;
          } else if (!mappedFields.has("credit") && !autoMappedFieldsRef.current.has("credit")) {
            field = "credit";
            header = creditHeader;
          }
        }
      }
    }

    if (field && header) {
      onMappingChange(field, header);
      autoMappedFieldsRef.current.add(field);
    }
  }, [preview, allHeaders, onMappingChange]);

  return (
    <div className="space-y-5">
      <div className="rounded-xl border p-5" style={{ borderColor: "rgba(148,163,184,0.16)", background: "#111827" }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-[var(--foreground)]">Column Mapping</h3>
            <p className="text-xs text-[var(--muted-foreground)]">
              {fileName} · {preview.detectedDelimiter === "\t" ? "Tab" : preview.detectedDelimiter === ";" ? "Semicolon" : "Comma"} separated · {allHeaders.length} columns
              {preview.detectedProvider && preview.providerConfidence !== undefined && (
                <> · Provider: {DETECTED_PROVIDER_LABELS[preview.detectedProvider] || preview.detectedProvider} ({preview.providerConfidence}%)</>
              )}
              {preview.latestBalance !== undefined && (
                <> · Balance: {currencySymbol}{preview.latestBalance.toFixed(2)}</>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--muted-foreground)]">Mapping confidence</span>
            <span className={`text-xs font-bold ${getConfidenceColor(preview.mappingConfidence)}`}>
              {preview.mappingConfidence}%
            </span>
          </div>
        </div>

        {/* Profile controls */}
        <div className="mb-4 pb-4 flex items-center gap-3" style={{ borderBottom: "1px solid rgba(148,163,184,0.16)" }}>
          <div className="flex items-center gap-2">
            <button
              onClick={onLoadProfiles}
              className="btn-secondary text-xs px-2 py-1"
              type="button"
            >
              <RefreshCw className="h-3 w-3" />
              Load Profile
            </button>
            {profiles.length > 0 && (
              <select
                onChange={(e) => onLoadProfile(e.target.value)}
                className="input-field text-xs w-auto"
                defaultValue=""
              >
                <option value="">Select profile...</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <button
            onClick={onToggleSaveProfile}
            className="btn-secondary text-xs px-2 py-1"
            type="button"
          >
            Save as Profile
          </button>
        </div>

        {showSaveProfile && (
          <div className="mb-4 rounded-lg border border-[rgba(148,163,184,0.24)] p-3 bg-[rgba(17,24,39,0.5)]">
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Profile name"
                value={profileName}
                onChange={(e) => onProfileNameChange(e.target.value)}
                className="input-field text-sm w-full"
              />
              <label className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                <input
                  type="checkbox"
                  checked={profileDefault}
                  onChange={(e) => onProfileDefaultChange(e.target.checked)}
                  className="rounded"
                />
                Set as default for {(preview.detectedProvider || preview.sourceType).replace(/_/g, " ")}
              </label>
              <div className="flex items-center gap-2">
                <button onClick={onSaveProfile} className="btn-primary text-xs px-2 py-1">
                  Save
                </button>
                <button onClick={onToggleSaveProfile} className="btn-secondary text-xs px-2 py-1">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Provider Detection Banner — 3-tier confidence UX */}
        {preview.detectedProvider && preview.providerConfidence !== undefined && (
          (() => {
            const confidence = preview.providerConfidence;
            const providerLabel = DETECTED_PROVIDER_LABELS[preview.detectedProvider] || preview.detectedProvider;
            const matched = preview.matchedHeaders ?? [];
            const missing = preview.missingHeaders ?? [];
            const totalHeaders = preview.parsedHeaders?.length ?? 0;
            const matchedCount = matched.length;

            const headerDetails = (
              <div className="space-y-1">
                {matchedCount > 0 && (
                  <p className="text-[11px] text-[var(--muted-foreground)]">
                    Matched headers: {matched.join(", ")} ({matchedCount}/{totalHeaders})
                  </p>
                )}
                {missing.length > 0 && (
                  <p className="text-[11px] text-rose-300/80">
                    Missing important headers: {missing.join(", ")}
                  </p>
                )}
              </div>
            );

            if (confidence >= 85) {
              // HIGH CONFIDENCE — auto-accept
              return (
                <div className="mb-4 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 flex items-start gap-3">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-2">
                    <p className="text-xs font-medium text-emerald-300">
                      FounderAgent detected <span className="font-bold">{providerLabel}</span> with high confidence ({confidence}%).
                    </p>
                    {headerDetails}
                    <select
                      value={sourceType}
                      onChange={(e) => onSourceTypeChange(e.target.value as SourceType)}
                      className="input-field text-xs w-auto"
                    >
                      {SOURCE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              );
            } else if (confidence >= 50) {
              // MEDIUM CONFIDENCE — ask to confirm
              return (
                <div className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 flex items-start gap-3">
                  <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-xs font-medium text-amber-300">
                        FounderAgent thinks this may be <span className="font-bold">{providerLabel}</span> ({confidence}% confidence). Please confirm before importing.
                      </p>
                      {!providerConfirmed && (
                        <button
                          onClick={onConfirmProvider}
                          className="btn-primary text-xs px-3 py-1.5 whitespace-nowrap shrink-0"
                          type="button"
                        >
                          Confirm Provider
                        </button>
                      )}
                      {providerConfirmed && (
                        <span className="flex items-center gap-1 text-xs font-medium text-emerald-400 whitespace-nowrap shrink-0">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Provider confirmed
                        </span>
                      )}
                    </div>
                    {headerDetails}
                    <select
                      value={sourceType}
                      onChange={(e) => onSourceTypeChange(e.target.value as SourceType)}
                      className="input-field text-xs w-auto border-amber-500/40"
                    >
                      {SOURCE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              );
            } else {
              // LOW CONFIDENCE — default to generic bank
              return (
                <div className="mb-4 rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 flex items-start gap-3">
                  <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-2">
                    <p className="text-xs font-medium text-rose-300">
                      FounderAgent could not confidently identify this file. We will treat it as <span className="font-bold">Generic Bank CSV</span> unless you choose a provider.
                    </p>
                    {headerDetails}
                    <select
                      value={sourceType}
                      onChange={(e) => onSourceTypeChange(e.target.value as SourceType)}
                      className="input-field text-xs w-auto border-rose-500/40"
                    >
                      {SOURCE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              );
            }
          })()
        )}

        {/* Date format override */}
        <div className="mb-4 pb-4" style={{ borderBottom: "1px solid rgba(148,163,184,0.16)" }}>
          <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1.5">
            Date Format Override
          </label>
          <div className="flex items-center gap-2">
            <select
              value={overrides.dateFormat || ""}
              onChange={(e) => onDateFormatChange(e.target.value)}
              className="input-field text-sm w-auto"
            >
              {DATE_FORMAT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <span className="text-xs text-[var(--muted-foreground)]">
              Detected: {preview.detectedDateFormat || "unknown"}
            </span>
          </div>
        </div>

        {/* Sign convention override */}
        <div className="mb-4 pb-4" style={{ borderBottom: "1px solid rgba(148,163,184,0.16)" }}>
          <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1.5">
            Sign Convention
          </label>
          <div className="flex items-center gap-2">
            <select
              value={overrides.signConvention || ""}
              onChange={(e) => onSignConventionChange(e.target.value)}
              className="input-field text-sm w-auto"
            >
              {SIGN_CONVENTION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <span className="text-xs text-[var(--muted-foreground)]">
              {overrides.signConvention === "us_bank"
                ? "Positive amounts = expense"
                : overrides.signConvention === "accounting"
                ? "Positive amounts = income"
                : "Negative amounts = expense (UK)"}
            </span>
          </div>
        </div>

        {/* Diagnostic banner when parsing produced no rows but has failures */}
        {preview.failedRows.length > 0 && preview.previewRows.length === 0 && (
          <div className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-amber-300">Could not match columns</p>
              <p className="text-[11px] text-amber-200/70 mt-0.5">
                Try selecting a different source type or check your CSV headers.
              </p>
            </div>
          </div>
        )}

        {/* Required fields warning */}
        {!isValid && missingFields.length > 0 && (
          <div className="mb-4 rounded-lg border border-orange-500/20 bg-orange-500/10 p-3 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-orange-300">
                {missingFields.length} required field{missingFields.length > 1 ? "s" : ""} unmapped
              </p>
              <p className="text-[11px] text-orange-200/70 mt-0.5">
                {missingFields.join(", ")}
              </p>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="flex items-center gap-2 py-4 text-xs text-[var(--muted-foreground)]">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Re-analysing with your changes...
          </div>
        )}

        {/* Smart field visibility: show only relevant mapping fields */}
        {(() => {
          const mappedFields = preview.columnMappings.map((m) => m.field);
          const hasAmount = mappedFields.includes("amount") || !!overrides.amountColumn;
          const hasDebitCredit =
            mappedFields.includes("debit") ||
            mappedFields.includes("credit") ||
            !!overrides.debitColumn ||
            !!overrides.creditColumn;

          const visibleOptions = FIELD_OPTIONS.filter((f) => {
            if (!f.value) return false; // Skip "not mapped" placeholder
            if (f.value === "debit" || f.value === "credit") {
              return hasDebitCredit || !hasAmount;
            }
            if (f.value === "amount") {
              return hasAmount || !hasDebitCredit;
            }
            return true;
          });

          return (
            <div className="space-y-3">
              {visibleOptions.map((fieldOpt) => {
            const field = fieldOpt.value;
            const mapping = preview.columnMappings.find((m) => m.field === field);
            const isRequired = fieldOpt.required;
            const currentValue = getMappedHeader(field);
            const samples = currentValue ? getSamplesForHeader(currentValue) : [];

            return (
              <div key={field} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
                <div className="flex items-center gap-2 pt-2">
                  <span className="text-sm text-[var(--foreground)]">{fieldOpt.label}</span>
                  {isRequired && <span className="text-rose-400 text-xs">*</span>}
                  {mapping && (
                    <span className={`text-[10px] font-medium ${getConfidenceColor(mapping.confidence)}`}>
                      {mapping.confidence}%
                    </span>
                  )}
                </div>
                <div className="sm:col-span-2 space-y-1">
                  <select
                    value={currentValue}
                    onChange={(e) => onMappingChange(field, e.target.value)}
                    className={`input-field text-sm w-full ${
                      isRequired && !currentValue ? "border-rose-500/50" : ""
                    }`}
                  >
                    <option value="">— Not mapped —</option>
                    {allHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                  {samples.length > 0 && (
                    <p className="text-[11px] text-[var(--muted-foreground)] truncate">
                      e.g. {samples.join(" · ")}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
            </div>
          );
        })()}

        <div className="flex items-center justify-between mt-6 pt-4" style={{ borderTop: "1px solid rgba(148,163,184,0.16)" }}>
          <button onClick={onBack} className="btn-secondary text-sm">
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          {(() => {
            const confidence = preview.providerConfidence ?? 0;
            const previewEnabled =
              confidence >= 85 ? true : confidence >= 50 ? providerConfirmed : isValid;
            return (
              <button
                onClick={onContinue}
                disabled={!previewEnabled || isLoading}
                className="btn-primary text-sm disabled:opacity-50"
              >
                Preview Import
                <ArrowRight className="h-4 w-4" />
              </button>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

import { ALL_CATEGORIES } from "@/lib/categories";

function PreviewStep({
  preview,
  fileName,
  currencySymbol,
  onConfirm,
  onBack,
  editedCategories,
  onEditCategory,
  isLoading,
}: {
  preview: WizardPreview;
  fileName: string;
  currencySymbol: string;
  onConfirm: () => void;
  onBack: () => void;
  editedCategories: Record<number, string>;
  onEditCategory: (updates: Record<number, string>) => void;
  isLoading: boolean;
}) {
  const [showFullScreenReview, setShowFullScreenReview] = useState(false);
  const [appliedMessages, setAppliedMessages] = useState<Record<number, string>>({});
  const [highlightedRows, setHighlightedRows] = useState<Set<number>>(new Set());
  const [applyToSimilarState, setApplyToSimilarState] = useState<{
    open: boolean;
    sourceRow: typeof preview.previewRows[0] | null;
    affectedRows: typeof preview.previewRows[0][];
    matchType: "merchant" | "keyword";
    matchValue: string;
  }>({ open: false, sourceRow: null, affectedRows: [], matchType: "merchant", matchValue: "" });
  const [handledSuggestions, setHandledSuggestions] = useState<Set<string>>(new Set());

  const { suggestions: allSuggestions } = usePatternSuggestions(preview.previewRows);

  const readyCount = preview.previewRows.filter((r) => r.issues.length === 0).length;
  const warningCount = preview.previewRows.filter((r) => r.issues.length > 0).length;
  const hasCriticalErrors = preview.failedRows.length > 0 && preview.previewRows.length === 0;
  const reviewCategories = new Set(["Uncategorised Review", "Needs Review", "Ambiguous"]);
  const transferCategories = new Set(["Transfers", "Internal Transfer", "International Transfer", "Money Transfer", "Credit Card Payment", "Loan Repayment"]);

  const getRowCategory = (row: typeof preview.previewRows[0]) => {
    return editedCategories[row.rowNumber] ?? row.category;
  };

  const rowCategory = (row: typeof preview.previewRows[0]) => getRowCategory(row);

  const isNeedsReviewRow = (row: typeof preview.previewRows[0]) => {
    const category = rowCategory(row);
    const status = row.status.toLowerCase();
    return status === "needs_review" || reviewCategories.has(category) || (row.categoryConfidence ?? row.confidenceScore) < 70;
  };

  const isSuggestedRow = (row: typeof preview.previewRows[0]) => {
    if (isNeedsReviewRow(row)) return false;
    const status = row.status.toLowerCase();
    const confidence = row.categoryConfidence ?? row.confidenceScore;
    return status === "ai_suggested" || (confidence >= 70 && confidence < 90);
  };

  const isAutoCategorisedRow = (row: typeof preview.previewRows[0]) => {
    if (isNeedsReviewRow(row) || isSuggestedRow(row)) return false;
    const status = row.status.toLowerCase();
    const confidence = row.categoryConfidence ?? row.confidenceScore;
    return status === "categorised" || confidence >= 90;
  };

  const getDisplayStatus = (row: typeof preview.previewRows[0]) => {
    if (row.isPossibleDuplicate) return "Possible Duplicate";
    if (transferCategories.has(rowCategory(row)) || row.status === "transfer") return "Transfer";
    if (isNeedsReviewRow(row)) return "Needs Review";
    if (isSuggestedRow(row)) return "Suggested";
    return "Categorised";
  };

  const handleCategoryChange = (rowNumber: number, newCategory: string) => {
    onEditCategory({ ...editedCategories, [rowNumber]: newCategory });
  };

  const saveCategoryRule = async (merchant: string, category: string) => {
    try {
      await fetch("/api/settings/category-rule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ merchant, category }),
      });
    } catch (e) {
      console.error("Failed to save category rule:", e);
    }
  };

  const handleApplyToSimilar = (sourceRow: typeof preview.previewRows[0]) => {
    const newCategory = editedCategories[sourceRow.rowNumber];
    if (!newCategory) return;

    const sourceMerchant = sourceRow.merchant?.toLowerCase().trim();
    const sourceDesc = sourceRow.description?.toLowerCase().trim();
    const firstWord = sourceDesc?.split(/\s+/)[0];

    const affected: typeof preview.previewRows[0][] = [];
    let matchType: "merchant" | "keyword" = "merchant";
    let matchValue = sourceRow.merchant || "";

    for (const row of preview.previewRows) {
      if (row.rowNumber === sourceRow.rowNumber) continue;
      const rowMerchant = row.merchant?.toLowerCase().trim();
      const rowDesc = row.description?.toLowerCase().trim();

      if (sourceMerchant && rowMerchant && rowMerchant === sourceMerchant) {
        affected.push(row);
      } else if (firstWord && rowDesc && rowDesc.startsWith(firstWord)) {
        affected.push(row);
        if (!sourceMerchant) {
          matchType = "keyword";
          matchValue = firstWord;
        }
      }
    }

    if (affected.length === 0) return;

    setApplyToSimilarState({
      open: true,
      sourceRow,
      affectedRows: affected,
      matchType,
      matchValue,
    });
  };

  const handleConfirmApplyToSimilar = (saveAsRule: boolean) => {
    const { sourceRow, affectedRows } = applyToSimilarState;
    if (!sourceRow) return;
    const newCategory = editedCategories[sourceRow.rowNumber];
    if (!newCategory) return;

    const updates: Record<number, string> = { ...editedCategories };
    for (const row of affectedRows) {
      updates[row.rowNumber] = newCategory;
    }
    onEditCategory(updates);

    const highlighted = new Set<number>();
    for (const row of affectedRows) {
      highlighted.add(row.rowNumber);
    }
    setHighlightedRows(highlighted);
    setTimeout(() => setHighlightedRows(new Set()), 2000);

    if (saveAsRule && sourceRow.merchant) {
      saveCategoryRule(sourceRow.merchant, newCategory);
    }

    setAppliedMessages((prev) => ({
      ...prev,
      [sourceRow.rowNumber]: `Applied to ${affectedRows.length} similar row${affectedRows.length > 1 ? "s" : ""}`,
    }));
    setTimeout(() => {
      setAppliedMessages((prev) => {
        const next = { ...prev };
        delete next[sourceRow.rowNumber];
        return next;
      });
    }, 3000);

    setApplyToSimilarState({ open: false, sourceRow: null, affectedRows: [], matchType: "merchant", matchValue: "" });
  };

  const handleApproveSuggestion = (id: string) => {
    const suggestion = allSuggestions.find((s) => s.id === id);
    if (!suggestion) return;
    const newEdits = { ...editedCategories };
    for (const rowNum of suggestion.affectedRowIds) {
      newEdits[rowNum] = suggestion.suggestedCategory;
    }
    onEditCategory(newEdits);
    setHandledSuggestions((prev) => new Set(prev).add(id));
  };

  const handleRejectSuggestion = (id: string) => {
    setHandledSuggestions((prev) => new Set(prev).add(id));
  };

  const handleApproveAll = () => {
    const newEdits = { ...editedCategories };
    for (const s of allSuggestions) {
      if (handledSuggestions.has(s.id)) continue;
      for (const rowNum of s.affectedRowIds) {
        newEdits[rowNum] = s.suggestedCategory;
      }
    }
    onEditCategory(newEdits);
    setHandledSuggestions(new Set(allSuggestions.map((s) => s.id)));
  };

  const visibleSuggestions = allSuggestions.filter((s) => !handledSuggestions.has(s.id));
  const reviewRows = preview.previewRows.filter(isNeedsReviewRow);
  const summary = preview.intelligenceSummary;
  const kpiExcludedCount = summary?.kpiExcludedRows ?? preview.previewRows.filter((row) => row.kpiTreatment === "excluded").length;
  const groupedCount = summary?.intelligenceGroups ?? new Set(preview.previewRows.map((row) => row.intelligenceGroupId).filter(Boolean)).size;

  // Build dynamic columns from mapped fields
  const mappedFields = preview.columnMappings.map((m) => m.field);
  const extraFields = mappedFields.filter(
    (f) => !["date", "merchant", "description", "amount", "type", "category", "reference"].includes(f)
  );

  const isRevolut = preview.detectedProvider === "revolut_business_csv";

  return (
    <div className="space-y-5">
      {/* Source Detection Banner */}
      {isRevolut && (
        <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 px-4 py-3 flex items-center gap-3">
          <Database className="h-5 w-5 text-purple-400 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-purple-300">Detected Revolut Business CSV</p>
            <p className="text-xs text-purple-200/80">
              {preview.previewRows.length + preview.failedRows.length} rows · {preview.detectedCurrency} · Smart mapping applied
            </p>
          </div>
        </div>
      )}

      {/* Top Actions Bar */}
      <div className="sticky top-0 z-10 flex items-center justify-between rounded-xl border px-4 py-3" style={{ borderColor: "rgba(148,163,184,0.16)", background: "rgba(9,9,11,0.95)", backdropFilter: "blur(12px)" }}>
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-[var(--foreground)]">{fileName}</span>
          <span className="text-xs text-[var(--muted-foreground)]">
            {preview.previewRows.length + preview.failedRows.length} rows
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="btn-secondary text-xs px-3 py-1.5">
            <ArrowLeft className="h-3.5 w-3.5" />
            Adjust Mapping
          </button>
          <button
            onClick={onConfirm}
            disabled={hasCriticalErrors || isLoading}
            className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                Confirm & Import
                <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Rows Detected" value={String(preview.previewRows.length + preview.failedRows.length)} icon={<FileText className="h-4 w-4" />} />
        <StatCard label="Ready" value={String(readyCount)} icon={<CheckCircle2 className="h-4 w-4" />} color="text-emerald-400" />
        <StatCard label="Warnings" value={String(warningCount)} icon={<AlertCircle className="h-4 w-4" />} color="text-amber-400" />
        <StatCard label="Failed" value={String(preview.failedRows.length)} icon={<AlertCircle className="h-4 w-4" />} color="text-rose-400" />
      </div>

      {/* Intelligence Summary */}
      {(() => {
        const categorised = summary?.rowsAutoCategorised ?? preview.previewRows.filter(isAutoCategorisedRow).length;
        const suggested = summary?.rowsSuggested ?? preview.previewRows.filter(isSuggestedRow).length;
        const review = summary?.rowsNeedingReview ?? reviewRows.length;
        const ambiguous = summary?.rowsAmbiguous ?? preview.previewRows.filter((r) => rowCategory(r) === "Ambiguous").length;
        const transfers = summary?.transfersDetected ?? preview.previewRows.filter((r) => transferCategories.has(rowCategory(r)) || r.status === "transfer").length;
        const creditCards = summary?.creditCardPaymentsDetected ?? preview.previewRows.filter((r) => r.isCreditCardRepayment || rowCategory(r) === "Credit Card Payment").length;
        const recurring = summary?.recurringGroupsDetected ?? preview.previewRows.filter((r) => r.isRecurringCandidate).length;
        const subscriptions = summary?.subscriptionsDetected ?? preview.previewRows.filter((r) => r.isSubscriptionCandidate).length;
        const total = preview.previewRows.length;
        const pct = total > 0 ? Math.round((categorised / total) * 100) : 0;
        return (
          <div className="rounded-xl border px-4 py-3" style={{ borderColor: "rgba(148,163,184,0.16)", background: "#111827" }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-[var(--foreground)]">Intelligence Summary</span>
              <span className="text-xs text-[var(--muted-foreground)]">{pct}% auto-categorised · {groupedCount} groups</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
              <MiniIntel label="Auto categorised" value={categorised} tone="text-emerald-400" />
              <MiniIntel label="Suggested" value={suggested} tone="text-amber-300" />
              <MiniIntel label="Needs review" value={review} tone="text-rose-300" />
              <MiniIntel label="Ambiguous" value={ambiguous} tone="text-orange-300" />
              <MiniIntel label="Transfers" value={transfers} tone="text-violet-300" />
              <MiniIntel label="Card payments" value={creditCards} tone="text-violet-300" />
              <MiniIntel label="Recurring groups" value={recurring} tone="text-sky-300" />
              <MiniIntel label="Subscriptions" value={subscriptions} tone="text-sky-300" />
              <MiniIntel label="KPI excluded" value={kpiExcludedCount} tone="text-violet-300" />
              <MiniIntel label="Groups" value={groupedCount} tone="text-[var(--muted-foreground)]" />
            </div>
            <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(148,163,184,0.12)" }}>
              <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500" style={{ width: `${total > 0 ? 100 : 0}%`, opacity: 0.7 }} />
            </div>
          </div>
        );
      })()}

      {/* Diagnostic banner for critical parse failures */}
      {hasCriticalErrors && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-300">Could not match columns</p>
            <p className="text-xs text-amber-200/70 mt-0.5">
              Try selecting a different source type or check your CSV headers.
            </p>
          </div>
        </div>
      )}

      {/* Cash Movement */}
      <div className="grid grid-cols-3 gap-3">
        <CashCard label="Income" amount={preview.incomeTotal} icon={<TrendingUp className="h-4 w-4" />} color="text-emerald-400" currencySymbol={currencySymbol} />
        <CashCard label="Expenses" amount={preview.expenseTotal} icon={<TrendingDown className="h-4 w-4" />} color="text-rose-400" currencySymbol={currencySymbol} />
        <CashCard label="Net" amount={preview.netMovement} icon={<Sparkles className="h-4 w-4" />} color={preview.netMovement >= 0 ? "text-emerald-400" : "text-rose-400"} currencySymbol={currencySymbol} />
      </div>

      {/* Estimated Impact */}
      {preview.estimatedImpact && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">Estimated Impact</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <ImpactCard
              label="💰 Income to add"
              value={`+${currencySymbol}${preview.estimatedImpact.incomeToAdd.toFixed(2)}`}
              icon={<TrendingUp className="h-4 w-4" />}
              color="text-emerald-400"
              valueColor="text-emerald-400"
            />
            <ImpactCard
              label="💸 Expenses to add"
              value={`-${currencySymbol}${preview.estimatedImpact.expensesToAdd.toFixed(2)}`}
              icon={<TrendingDown className="h-4 w-4" />}
              color="text-rose-400"
              valueColor="text-rose-400"
            />
            <ImpactCard
              label="📊 Net movement"
              value={`${preview.estimatedImpact.netMovement >= 0 ? "+" : "-"}${currencySymbol}${Math.abs(preview.estimatedImpact.netMovement).toFixed(2)}`}
              icon={<Sparkles className="h-4 w-4" />}
              color={preview.estimatedImpact.netMovement >= 0 ? "text-emerald-400" : "text-rose-400"}
              valueColor={preview.estimatedImpact.netMovement >= 0 ? "text-emerald-400" : "text-rose-400"}
            />
            <ImpactCard
              label="🔄 Duplicates to skip"
              value={String(preview.estimatedImpact.duplicatesToSkip)}
              icon={<RefreshCw className="h-4 w-4" />}
              color="text-slate-400"
              valueColor="text-slate-400"
            />
            {preview.estimatedImpact.failedRows > 0 && (
              <ImpactCard
                label="⚠️ Failed rows"
                value={String(preview.estimatedImpact.failedRows)}
                icon={<AlertTriangle className="h-4 w-4" />}
                color="text-amber-400"
                valueColor="text-amber-400"
              />
            )}
            <ImpactCard
              label="📝 Subscriptions detected"
              value={String(preview.estimatedImpact.subscriptionsDetected)}
              icon={<FileText className="h-4 w-4" />}
              color="text-blue-400"
              valueColor="text-blue-400"
            />
            {preview.estimatedImpact.latestBalanceDetected !== undefined && (
              <ImpactCard
                label="💳 Latest balance detected"
                value={`${currencySymbol}${preview.estimatedImpact.latestBalanceDetected.toFixed(2)}`}
                icon={<Database className="h-4 w-4" />}
                color="text-[var(--muted-foreground)]"
                valueColor="text-[var(--foreground)]"
              />
            )}
          </div>
          <p className="text-[11px] text-[var(--muted-foreground)]">
            Estimated impact before import. After import, FounderAgent will recalculate your dashboard using the final saved transactions.
          </p>
        </div>
      )}

      <div className="rounded-xl border p-4" style={{ borderColor: "rgba(148,163,184,0.16)", background: "#111827" }}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[var(--foreground)]">Review Remaining Items</h3>
            <p className="text-xs text-[var(--muted-foreground)]">
              {reviewRows.length} row{reviewRows.length === 1 ? "" : "s"} need attention. {visibleSuggestions.length} intelligence group{visibleSuggestions.length === 1 ? "" : "s"} can be inspected if needed.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowFullScreenReview(true)}
              className="btn-secondary text-xs px-3 py-1.5"
            >
              <Eye className="h-3.5 w-3.5" />
              Intelligence Review
            </button>
            {visibleSuggestions.length > 0 && (
              <button onClick={handleApproveAll} className="btn-secondary text-xs px-3 py-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Approve safe groups
              </button>
            )}
          </div>
        </div>
        {reviewRows.length > 0 ? (
          <div className="mt-3 grid gap-2">
            {reviewRows.slice(0, 8).map((row) => (
              <div key={row.rowNumber} className="flex flex-col gap-2 rounded-lg border border-[var(--border)] px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-[var(--foreground)] truncate">
                    Row {row.rowNumber} · {row.merchant || row.reference || row.description || "Unknown"}
                  </p>
                  <p className="text-[11px] text-[var(--muted-foreground)] line-clamp-2">
                    {row.reviewReason || row.categoryReason || "Needs review because the available merchant/reference evidence is not strong enough."}
                  </p>
                </div>
                <select
                  value={getRowCategory(row)}
                  onChange={(e) => handleCategoryChange(row.rowNumber, e.target.value)}
                  className="text-xs bg-transparent border border-[var(--border)] rounded px-2 py-1.5 text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)] min-h-[36px]"
                >
                  {ALL_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            ))}
            {reviewRows.length > 8 && (
              <button onClick={() => setShowFullScreenReview(true)} className="text-xs font-medium text-[var(--accent)] hover:underline">
                Review all {reviewRows.length} items
              </button>
            )}
          </div>
        ) : (
          <p className="mt-3 text-xs text-emerald-300">No unresolved rows detected in the preview.</p>
        )}
      </div>

      <FullScreenReview
        open={showFullScreenReview}
        onClose={() => setShowFullScreenReview(false)}
        suggestions={allSuggestions}
        previewRows={preview.previewRows}
        onApprove={handleApproveSuggestion}
        onReject={handleRejectSuggestion}
        onApproveAll={handleApproveAll}
        onDismissAll={() => setHandledSuggestions(new Set(allSuggestions.map((s) => s.id)))}
      />

      {/* Preview Table */}
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "rgba(148,163,184,0.16)" }}>
        <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: "rgba(148,163,184,0.16)", background: "#111827" }}>
          <h3 className="text-sm font-semibold text-[var(--foreground)]">Preview</h3>
          <span className="text-xs text-[var(--muted-foreground)]">{fileName}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[1320px]">
            <thead>
              <tr className="text-left text-[var(--muted-foreground)]" style={{ background: "rgba(17,24,39,0.8)" }}>
                <th className="px-3 py-2 font-medium">Row</th>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Merchant</th>
                <th className="px-3 py-2 font-medium">Reference</th>
                <th className="px-3 py-2 font-medium">Counterparty</th>
                <th className="px-3 py-2 font-medium">Bank Type</th>
                <th className="px-3 py-2 font-medium text-right">Amount</th>
                <th className="px-3 py-2 font-medium">Direction</th>
                <th className="px-3 py-2 font-medium">Category</th>
                {extraFields.includes("balance") && <th className="px-3 py-2 font-medium text-right">Balance</th>}
                {extraFields.includes("currency") && <th className="px-3 py-2 font-medium">Cur</th>}
                <th className="px-3 py-2 font-medium">Reason</th>
                <th className="px-3 py-2 font-medium">Conf</th>
                <th className="px-3 py-2 font-medium">KPI Treatment</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {preview.previewRows.map((row) => (
                <tr
                  key={row.rowNumber}
                  className={`border-t transition-colors hover:bg-[rgba(148,163,184,0.04)] ${
                    highlightedRows.has(row.rowNumber) ? "bg-yellow-50 transition-colors duration-500" : ""
                  }`}
                  style={{ borderColor: "rgba(148,163,184,0.08)" }}
                >
                  <td className="px-3 py-2 text-[var(--muted-foreground)]">
                    <div className="flex items-center gap-1">
                      {row.issues.length > 0 && (
                        <span title={row.issues.join("; ")}>
                          <AlertTriangle className="h-3 w-3 text-amber-400" />
                        </span>
                      )}
                      {row.rowNumber}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-[var(--foreground)]">{formatDate(row.date)}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <MerchantLogo name={row.merchant || ""} size="sm" />
                      <div className="min-w-0">
                        <span className="block text-xs text-[var(--foreground)] max-w-[140px] truncate">{row.merchant || "—"}</span>
                        {row.intelligenceGroupLabel && (
                          <span className="block text-[10px] text-[var(--muted-foreground)] max-w-[140px] truncate">
                            Group: {row.intelligenceGroupLabel}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-[var(--foreground)] max-w-[220px]">
                    <div className="truncate">{row.reference || "—"}</div>
                    <details className="mt-0.5">
                      <summary className="cursor-pointer text-[10px] text-[var(--muted-foreground)]">Row details</summary>
                      <div className="mt-1 space-y-0.5 text-[10px] text-[var(--muted-foreground)]">
                        {row.description && <p>Description: {row.description}</p>}
                        {row.bankDescription && <p>Bank description: {row.bankDescription}</p>}
                        {row.externalTransactionId && <p>External ID: {row.externalTransactionId}</p>}
                        {row.merchantCategoryCode && <p>MCC: {row.merchantCategoryCode}</p>}
                        {row.accountName && <p>Account: {row.accountName}</p>}
                        {row.payer && <p>Payer: {row.payer}</p>}
                      </div>
                    </details>
                  </td>
                  <td className="px-3 py-2 text-[var(--foreground)] max-w-[150px] truncate">{row.counterparty || row.payer || "—"}</td>
                  <td className="px-3 py-2 text-[var(--muted-foreground)] max-w-[100px] truncate">{row.transactionType || "—"}</td>
                  <td className="px-3 py-2 text-right font-mono">
                    <span className={row.type === "income" ? "text-emerald-400" : "text-rose-400"}>
                      {row.type === "income" ? "+" : "-"}
                      {currencySymbol}{row.amount.toFixed(2)}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge variant={row.type === "income" ? "success" : "danger"}>
                      {row.type}
                    </StatusBadge>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <select
                        value={getRowCategory(row)}
                        onChange={(e) => handleCategoryChange(row.rowNumber, e.target.value)}
                        className="text-xs bg-transparent border border-[var(--border)] rounded px-2 py-1.5 text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)] min-h-[36px]"
                      >
                        {ALL_CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                      {editedCategories[row.rowNumber] && editedCategories[row.rowNumber] !== row.category && (
                        <button
                          onClick={() => handleApplyToSimilar(row)}
                          className="text-[10px] text-[var(--accent)] hover:underline whitespace-nowrap px-2 py-1.5 rounded min-h-[36px]"
                          title="Apply this category to rows with the same merchant or description"
                        >
                          Apply to similar
                        </button>
                      )}
                      {appliedMessages[row.rowNumber] && (
                        <span className="text-[10px] text-emerald-400 whitespace-nowrap">{appliedMessages[row.rowNumber]}</span>
                      )}
                    </div>
                  </td>
                  {extraFields.includes("balance") && (
                    <td className="px-3 py-2 text-right font-mono text-[var(--muted-foreground)]">
                      {row.runningBalance !== undefined ? row.runningBalance.toFixed(2) : row.rawData[Object.keys(row.rawData).find((k) => k.toLowerCase().includes("balance")) || ""] || "-"}
                    </td>
                  )}
                  {extraFields.includes("currency") && (
                    <td className="px-3 py-2 text-[var(--foreground)]">{row.currency || "-"}</td>
                  )}
                  <td className="px-3 py-2 max-w-[260px]">
                    <div className="text-[var(--foreground)] line-clamp-2">
                      {row.categoryReason || row.reviewReason || "No category reason available"}
                    </div>
                    {row.intelligenceGroupReason && (
                      <div className="mt-0.5 text-[10px] text-[var(--muted-foreground)] line-clamp-1">
                        {row.intelligenceGroupReason}
                      </div>
                    )}
                    <div className="mt-1 flex flex-wrap gap-1">
                      {row.kpiTreatment && (
                        <span className={`rounded border px-1.5 py-0.5 text-[10px] ${
                          row.kpiTreatment === "included"
                            ? "border-emerald-500/30 text-emerald-300"
                            : "border-violet-500/30 text-violet-300"
                        }`}>
                          KPI {row.kpiTreatment}
                        </span>
                      )}
                      {row.subcategory && (
                        <span className="rounded border border-slate-500/25 px-1.5 py-0.5 text-[10px] text-[var(--muted-foreground)]">
                          {row.subcategory}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <span className={(row.categoryConfidence ?? row.confidenceScore) >= 85 ? "text-emerald-400" : (row.categoryConfidence ?? row.confidenceScore) >= 60 ? "text-amber-400" : "text-rose-400"}>
                      {row.categoryConfidence ?? row.confidenceScore}%
                    </span>
                  </td>
                  <td className="px-3 py-2 max-w-[150px]">
                    {row.kpiTreatment === "excluded" ? (
                      <span className="rounded border border-violet-500/30 px-2 py-1 text-[10px] text-violet-300">
                        {formatKpiExclusionReason(row.kpiExclusionReason, row.category)}
                      </span>
                    ) : (
                      <span className="rounded border border-emerald-500/30 px-2 py-1 text-[10px] text-emerald-300">
                        Included
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge
                      variant={
                        getDisplayStatus(row) === "Categorised"
                          ? "success"
                          : getDisplayStatus(row) === "Needs Review"
                          ? "warning"
                          : "neutral"
                      }
                    >
                      {getDisplayStatus(row)}
                    </StatusBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Failed Rows */}
      {preview.failedRows.length > 0 && (
        <div className="rounded-xl border p-4" style={{ borderColor: "rgba(244,63,94,0.2)", background: "rgba(244,63,94,0.04)" }}>
          <h4 className="text-sm font-semibold text-rose-300 mb-2 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            Failed Rows ({preview.failedRows.length})
          </h4>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {preview.failedRows.map((f) => (
              <div key={f.rowNumber} className="text-xs text-rose-200/80">
                <span className="font-mono text-rose-300">Row {f.rowNumber}:</span>{" "}
                {f.errors.join("; ")}
              </div>
            ))}
          </div>
        </div>
      )}

      {applyToSimilarState.open && applyToSimilarState.sourceRow && (
        <ApplyToSimilarConfirm
          category={editedCategories[applyToSimilarState.sourceRow.rowNumber] || ""}
          count={applyToSimilarState.affectedRows.length}
          matchType={applyToSimilarState.matchType}
          matchValue={applyToSimilarState.matchValue}
          affectedRows={applyToSimilarState.affectedRows}
          onApply={(saveAsRule) => handleConfirmApplyToSimilar(saveAsRule)}
          onCancel={() => setApplyToSimilarState({ open: false, sourceRow: null, affectedRows: [], matchType: "merchant", matchValue: "" })}
        />
      )}

      {/* Actions */}
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="btn-secondary text-sm">
          <ArrowLeft className="h-4 w-4" />
          Adjust Mapping
        </button>
        <button
          onClick={onConfirm}
          disabled={hasCriticalErrors || isLoading}
          className="btn-primary text-sm disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Importing...
            </>
          ) : (
            <>
              Confirm & Import
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
function ProcessingStep({
  fileName,
  stage,
  progress,
}: {
  fileName: string;
  stage: string;
  progress: number;
}) {
  const stages = [
    { key: "reading", label: "Reading file", icon: <FileText className="h-4 w-4" /> },
    { key: "mapping", label: "Mapping columns", icon: <Settings2 className="h-4 w-4" /> },
    { key: "validating", label: "Validating rows", icon: <Eye className="h-4 w-4" /> },
    { key: "importing", label: "Importing transactions", icon: <Database className="h-4 w-4" /> },
    { key: "categorising", label: "Categorising", icon: <Brain className="h-4 w-4" /> },
    { key: "detecting_subscriptions", label: "Detecting subscriptions", icon: <RefreshCw className="h-4 w-4" /> },
    { key: "detecting_anomalies", label: "Detecting anomalies", icon: <AlertCircle className="h-4 w-4" /> },
    { key: "generating_recommendations", label: "Generating insights", icon: <Sparkles className="h-4 w-4" /> },
    { key: "updating_dashboard", label: "Updating dashboard", icon: <TrendingUp className="h-4 w-4" /> },
  ];

  const currentIdx = stages.findIndex((s) => stage.startsWith(s.key));
  const resolvedIdx = currentIdx >= 0 ? currentIdx : -1;

  return (
    <div className="rounded-xl border p-10 text-center" style={{ borderColor: "rgba(148,163,184,0.16)", background: "#111827" }}>
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-full animate-pulse"
            style={{
              background: "linear-gradient(135deg, rgba(20,184,166,0.2) 0%, rgba(139,92,246,0.15) 100%)",
            }}
          >
            <Loader2 className="h-8 w-8 text-[var(--accent)] animate-spin" />
          </div>
        </div>
        <div>
          <h3 className="text-base font-semibold text-[var(--foreground)]">
            Importing {fileName}
          </h3>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            {stage ? stage.replace(/_/g, " ") : "Starting..."}
          </p>
        </div>

        {/* Real progress bar */}
        <div className="w-full max-w-md">
          <div className="h-2 rounded-full bg-[rgba(148,163,184,0.16)] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.max(progress, 5)}%`,
                background: "linear-gradient(90deg, #14B8A6, #8B5CF6)",
              }}
            />
          </div>
          <p className="text-xs text-[var(--muted-foreground)] mt-1 text-right">{progress}%</p>
        </div>

        <div className="w-full max-w-md space-y-2 mt-4">
          {stages.map((s, idx) => {
            const isDone = resolvedIdx > idx;
            const isActive = resolvedIdx === idx;
            return (
              <div
                key={s.key}
                className="flex items-center gap-3 rounded-lg px-3 py-2"
                style={{
                  background: isDone || isActive ? "rgba(20,184,166,0.06)" : "rgba(148,163,184,0.04)",
                }}
              >
                <span className={isDone || isActive ? "text-[var(--accent)]" : "text-[var(--muted-foreground)]"}>
                  {isDone ? <CheckCircle2 className="h-4 w-4" /> : s.icon}
                </span>
                <span className={`text-xs ${isDone || isActive ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]"}`}>
                  {s.label}
                </span>
                {isActive && <Loader2 className="h-3 w-3 text-[var(--accent)] animate-spin ml-auto" />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SummaryStep({
  summary,
  currencySymbol,
  onUploadAnother,
}: {
  summary: ImportSummary;
  currencySymbol: string;
  onUploadAnother: () => void;
}) {
  const completed = summary.success && summary.reconciliationBalanced;
  const netMovement = summary.incomeTotal - summary.expenseTotal;

  return (
    <div className="space-y-5">
      <div
        className="rounded-xl border p-6 text-center"
        style={{
          borderColor: completed ? "rgba(20,184,166,0.3)" : "rgba(244,63,94,0.3)",
          background: completed ? "rgba(20,184,166,0.06)" : "rgba(244,63,94,0.06)",
        }}
      >
        <div className="flex flex-col items-center gap-3">
          {completed ? (
            <CheckCircle2 className="h-10 w-10 text-emerald-400" />
          ) : (
            <AlertCircle className="h-10 w-10 text-rose-400" />
          )}
          <div>
            <h3 className="text-lg font-semibold text-[var(--foreground)]">
              {completed ? "Import Complete" : "Import Needs Attention"}
            </h3>
            <p className="text-sm text-[var(--muted-foreground)]">
              {summary.fileName} · {summary.sourceType.replace(/_/g, " ")}
            </p>
          </div>
        </div>
      </div>

      {/* Full Reconciliation Table */}
      {(summary.rowsInFile > 0 || summary.reconciliationExplanation) && (
        <div className="rounded-xl border p-5 space-y-4" style={{ borderColor: "rgba(148,163,184,0.16)", background: "#111827" }}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="text-sm font-semibold text-[var(--foreground)]">Import Reconciliation</h4>
              {summary.reconciliationExplanation && (
                <p className={`mt-1 text-xs ${summary.reconciliationBalanced ? "text-emerald-300" : "text-rose-300"}`}>
                  {summary.reconciliationExplanation}
                </p>
              )}
            </div>
            <StatusBadge variant={summary.reconciliationBalanced ? "success" : "danger"}>
              {summary.reconciliationBalanced ? "Balanced" : "Mismatch"}
            </StatusBadge>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatCard label="Rows in File" value={String(summary.rowsInFile)} icon={<Database className="h-4 w-4" />} />
            <StatCard label="Rows Parsed" value={String(summary.rowsParsed)} icon={<Brain className="h-4 w-4" />} />
            <StatCard label="Rows Valid" value={String(summary.rowsValid)} icon={<CheckCircle2 className="h-4 w-4" />} color="text-emerald-400" />
            <StatCard label="Rows Imported" value={String(summary.rowsImported)} icon={<CheckCircle2 className="h-4 w-4" />} color="text-emerald-400" />
            <StatCard label="Duplicates Skipped" value={String(summary.rowsDuplicate)} icon={<RefreshCw className="h-4 w-4" />} color="text-amber-400" />
            <StatCard label="Failed" value={String(summary.rowsFailed)} icon={<AlertCircle className="h-4 w-4" />} color="text-rose-400" />
            <StatCard label="Needs Review" value={String(summary.rowsNeedReview)} icon={<Eye className="h-4 w-4" />} color="text-sky-400" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3 border-t" style={{ borderColor: "rgba(148,163,184,0.12)" }}>
            <StatCard label="Categorised" value={String(summary.rowsCategorised)} icon={<Tag className="h-4 w-4" />} color="text-emerald-400" />
            <StatCard label="High Confidence" value={String(summary.rowsHighConfidence)} icon={<CheckCircle2 className="h-4 w-4" />} color="text-emerald-400" />
            <StatCard label="Transfers" value={String(summary.rowsTransfer)} icon={<ArrowLeftRight className="h-4 w-4" />} color="text-violet-400" />
            <StatCard label="Excluded from KPIs" value={String(summary.rowsKpiExcluded)} icon={<Database className="h-4 w-4" />} color="text-violet-400" />
            <StatCard label="Linked to Subs" value={String(summary.rowsLinkedToSubscriptions)} icon={<RefreshCw className="h-4 w-4" />} color="text-sky-400" />
            <StatCard label="Uncategorised" value={String(summary.rowsUncategorised)} icon={<HelpCircle className="h-4 w-4" />} color="text-slate-400" />
            <StatCard label="Ambiguous" value={String(summary.rowsAmbiguous)} icon={<AlertTriangle className="h-4 w-4" />} color="text-amber-400" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3 border-t" style={{ borderColor: "rgba(148,163,184,0.12)" }}>
            <StatCard label="Revenue Rows" value={String(summary.rowsIncludedInRevenue)} icon={<TrendingUp className="h-4 w-4" />} color="text-emerald-400" />
            <StatCard label="Expense Rows" value={String(summary.rowsIncludedInExpenses)} icon={<TrendingDown className="h-4 w-4" />} color="text-rose-400" />
            <StatCard label="Cash Flow Rows" value={String(summary.rowsIncludedInCashFlow)} icon={<Database className="h-4 w-4" />} color="text-sky-400" />
            <StatCard label="User Rule" value={String(summary.rowsCategorisedByUserRule)} icon={<Tag className="h-4 w-4" />} color="text-sky-400" />
            <StatCard label="System Intel" value={String(summary.rowsCategorisedBySystemIntelligence)} icon={<Brain className="h-4 w-4" />} color="text-violet-400" />
            <StatCard label="Fee Rows" value={String(summary.rowsWithFees)} icon={<Database className="h-4 w-4" />} color="text-amber-400" />
            <StatCard label="Refund Rows" value={String(summary.rowsWithRefunds)} icon={<RefreshCw className="h-4 w-4" />} color="text-emerald-400" />
            <StatCard label="Card Repayments" value={String(summary.rowsWithCreditCardRepaymentTreatment)} icon={<CreditCard className="h-4 w-4" />} color="text-violet-400" />
          </div>
          {(summary.sourceCurrency || summary.baseCurrency) && (
            <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)] pt-2">
              <span>Source: {summary.sourceCurrency}</span>
              {summary.baseCurrency && summary.baseCurrency !== summary.sourceCurrency && (
                <span>· Base: {summary.baseCurrency}</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Intelligence Results */}
      {summary.success && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Subscriptions" value={String(summary.subscriptionsDetected)} icon={<RefreshCw className="h-4 w-4" />} />
          <StatCard label="Alerts" value={String(summary.alertsCreated)} icon={<AlertCircle className="h-4 w-4" />} />
          <StatCard label="Recommendations" value={String(summary.recommendationsCreated)} icon={<Sparkles className="h-4 w-4" />} />
          <StatCard label="Net Movement" value={`${netMovement >= 0 ? "+" : "-"}${currencySymbol}${Math.abs(netMovement).toFixed(0)}`} icon={<TrendingUp className="h-4 w-4" />} />
        </div>
      )}

      {summary.rowsFailed > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
          <p className="text-sm text-amber-300">
            {summary.rowsFailed} row{summary.rowsFailed > 1 ? "s" : ""} failed to import. Check the failed rows log for details.
          </p>
        </div>
      )}

      {summary.error && (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4">
          <p className="text-sm text-rose-300">{summary.error}</p>
        </div>
      )}

      <div className="flex items-center justify-center gap-3">
        <a href={summary.uploadId ? `/transactions?preset=allTime&uploadId=${summary.uploadId}` : "/transactions"} className="btn-secondary text-sm">
          <Eye className="h-4 w-4" />
          View Transactions
        </a>
        <button onClick={onUploadAnother} className="btn-primary text-sm">
          <Upload className="h-4 w-4" />
          Upload Another
        </button>
      </div>
    </div>
  );
}

/* ─── Helper components ─── */

function StatCard({
  label,
  value,
  icon,
  color = "text-[var(--muted-foreground)]",
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color?: string;
}) {
  return (
    <div
      className="rounded-xl border p-4"
      style={{ borderColor: "rgba(148,163,184,0.16)", background: "#111827" }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className={color}>{icon}</span>
        <span className="text-xs text-[var(--muted-foreground)]">{label}</span>
      </div>
      <p className="text-xl font-bold text-[var(--foreground)]">{value}</p>
    </div>
  );
}

function MiniIntel({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] px-2.5 py-2">
      <p className={`text-sm font-semibold ${tone}`}>{value}</p>
      <p className="text-[10px] uppercase text-[var(--muted-foreground)]">{label}</p>
    </div>
  );
}

function CashCard({
  label,
  amount,
  icon,
  color,
  currencySymbol,
}: {
  label: string;
  amount: number;
  icon: React.ReactNode;
  color: string;
  currencySymbol: string;
}) {
  return (
    <div
      className="rounded-xl border p-4"
      style={{ borderColor: "rgba(148,163,184,0.16)", background: "#111827" }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className={color}>{icon}</span>
        <span className="text-xs text-[var(--muted-foreground)]">{label}</span>
      </div>
      <p className={`text-lg font-bold ${color}`}>
        {amount >= 0 ? "" : "-"}{currencySymbol}{Math.abs(amount).toFixed(2)}
      </p>
    </div>
  );
}

function ImpactCard({
  label,
  value,
  icon,
  color = "text-[var(--muted-foreground)]",
  valueColor = "text-[var(--foreground)]",
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color?: string;
  valueColor?: string;
}) {
  return (
    <div
      className="rounded-xl border p-4"
      style={{ borderColor: "rgba(148,163,184,0.16)", background: "#111827" }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className={color}>{icon}</span>
        <span className="text-xs text-[var(--muted-foreground)]">{label}</span>
      </div>
      <p className={`text-xl font-bold ${valueColor}`}>{value}</p>
    </div>
  );
}
