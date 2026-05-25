"use client";

import { useState, useCallback, useEffect, useRef } from "react";
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
} from "lucide-react";
import {
  validateAndPreview,
  applyMappingOverrides,
  confirmAndProcess,
  getUploadStatus,
  loadMappingProfiles,
  saveCurrentMappingProfile,
} from "./wizard-actions";
import type {
  WizardStep,
  SourceType,
  WizardPreview,
  MappingOverrides,
  ImportSummary,
} from "@/lib/upload/wizard-types";

const SOURCE_OPTIONS: { value: SourceType; label: string }[] = [
  { value: "auto_detect", label: "Auto Detect" },
  { value: "bank_statement_csv", label: "Bank Statement CSV" },
  { value: "revolut_business_csv", label: "Revolut Business" },
  { value: "stripe", label: "Stripe Export" },
  { value: "paypal", label: "PayPal Export" },
  { value: "quickbooks", label: "QuickBooks Export" },
  { value: "xero", label: "Xero Export" },
  { value: "manual_csv", label: "Manual CSV" },
];

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
  { value: "category", label: "Category" },
];

const REQUIRED_FIELDS = ["date", "amount"];
const EITHER_OR_GROUPS: string[][] = [
  ["description", "merchant"],
  ["amount", "debit"],
];

type ErrorCategory = "parse" | "validation" | "system";

interface WizardError {
  category: ErrorCategory;
  title: string;
  message: string;
}

export default function UploadWizard() {
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
  const hasResumedRef = useRef(false);
  const [profiles, setProfiles] = useState<{ id: string; name: string; sourceType: string }[]>([]);
  const [showSaveProfile, setShowSaveProfile] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileDefault, setProfileDefault] = useState(false);

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
    };
  }, []);

  function startPolling(id: string) {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    pollIntervalRef.current = setInterval(async () => {
      const status = await getUploadStatus(id);
      if (status.pipelineStage) setPipelineStage(status.pipelineStage);
      if (status.pipelineProgress !== undefined) setPipelineProgress(status.pipelineProgress);

      if (status.status === "completed" || status.status === "completed_with_warnings") {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        // We don't have the summary here, user will see generic completion
        setSummary({
          success: true,
          fileName: "",
          sourceType: "bank_statement_csv",
          rowsProcessed: status.transactionCount ?? 0,
          rowsImported: status.transactionCount ?? 0,
          rowsSkipped: 0,
          rowsFailed: 0,
          incomeTotal: 0,
          expenseTotal: 0,
          subscriptionsDetected: 0,
          unknownTransactions: 0,
          alertsCreated: 0,
          recommendationsCreated: 0,
        });
        setStep("summary");
        // Clean URL
        window.history.replaceState({}, "", window.location.pathname);
      } else if (status.status === "failed") {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
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

  const handleConfirmImport = async () => {
    if (!preview || !sessionId) return;

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

    const result = await confirmAndProcess(sessionId, mappingOverrides);

    if (result.success && result.summary && result.uploadId) {
      setUploadId(result.uploadId);
      // Set URL for resumption
      window.history.replaceState({}, "", `?upload=${result.uploadId}`);
      startPolling(result.uploadId);
    } else {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      setError({
        category: "system",
        title: "Import failed",
        message: result.error ?? "Import failed",
      });
      setStep("preview");
    }
  };

  /* ─── Reset ─── */

  const handleReset = () => {
    setStep("upload");
    setPreview(null);
    setSummary(null);
    setError(null);
    setMappingOverrides({});
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
      {step === "upload" && (
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
          onMappingChange={handleMappingChange}
          onDateFormatChange={handleDateFormatChange}
          onSignConventionChange={handleSignConventionChange}
          onLoadProfiles={handleLoadProfiles}
          onLoadProfile={handleLoadProfile}
          onToggleSaveProfile={() => setShowSaveProfile((v) => !v)}
          onProfileNameChange={setProfileName}
          onProfileDefaultChange={setProfileDefault}
          onSaveProfile={handleSaveProfile}
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
        />
      )}

      {step === "preview" && preview && (
        <PreviewStep
          preview={preview}
          fileName={fileName}
          currencySymbol={getCurrencySymbol()}
          onConfirm={handleConfirmImport}
          onBack={() => setStep("mapping")}
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
            className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 text-center transition-colors ${
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
  onMappingChange,
  onDateFormatChange,
  onSignConventionChange,
  onLoadProfiles,
  onLoadProfile,
  onToggleSaveProfile,
  onProfileNameChange,
  onProfileDefaultChange,
  onSaveProfile,
  onContinue,
  onBack,
  isLoading,
  isValid,
  missingFields,
}: {
  preview: WizardPreview;
  fileName: string;
  overrides: MappingOverrides;
  profiles: { id: string; name: string; sourceType: string }[];
  showSaveProfile: boolean;
  profileName: string;
  profileDefault: boolean;
  onMappingChange: (field: string, header: string) => void;
  onDateFormatChange: (format: string) => void;
  onSignConventionChange: (convention: string) => void;
  onLoadProfiles: () => void;
  onLoadProfile: (profileId: string) => void;
  onToggleSaveProfile: () => void;
  onProfileNameChange: (name: string) => void;
  onProfileDefaultChange: (v: boolean) => void;
  onSaveProfile: () => void;
  onContinue: () => void;
  onBack: () => void;
  isLoading: boolean;
  isValid: boolean;
  missingFields: string[];
}) {
  const allHeaders = preview.previewRows[0]?.rawData
    ? Object.keys(preview.previewRows[0].rawData)
    : [];

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

  return (
    <div className="space-y-5">
      <div className="rounded-xl border p-5" style={{ borderColor: "rgba(148,163,184,0.16)", background: "#111827" }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-[var(--foreground)]">Column Mapping</h3>
            <p className="text-xs text-[var(--muted-foreground)]">
              {fileName} · {preview.detectedDelimiter === "\t" ? "Tab" : preview.detectedDelimiter === ";" ? "Semicolon" : "Comma"} separated · {allHeaders.length} columns
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
                Set as default for {preview.sourceType.replace(/_/g, " ")}
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

        <div className="space-y-3">
          {FIELD_OPTIONS.filter((f) => f.value).map((fieldOpt) => {
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

        <div className="flex items-center justify-between mt-6 pt-4" style={{ borderTop: "1px solid rgba(148,163,184,0.16)" }}>
          <button onClick={onBack} className="btn-secondary text-sm">
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <button onClick={onContinue} className="btn-primary text-sm">
            Preview Import
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function PreviewStep({
  preview,
  fileName,
  currencySymbol,
  onConfirm,
  onBack,
  isLoading,
}: {
  preview: WizardPreview;
  fileName: string;
  currencySymbol: string;
  onConfirm: () => void;
  onBack: () => void;
  isLoading: boolean;
}) {
  const readyCount = preview.previewRows.filter((r) => r.issues.length === 0).length;
  const warningCount = preview.previewRows.filter((r) => r.issues.length > 0).length;
  const hasCriticalErrors = preview.failedRows.length > 0 && preview.previewRows.length === 0;

  // Build dynamic columns from mapped fields
  const mappedFields = preview.columnMappings.map((m) => m.field);
  const extraFields = mappedFields.filter(
    (f) => !["date", "merchant", "description", "amount", "type", "category"].includes(f)
  );

  const isRevolut = preview.sourceType === "revolut_business_csv";

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

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Rows Detected" value={String(preview.previewRows.length + preview.failedRows.length)} icon={<FileText className="h-4 w-4" />} />
        <StatCard label="Ready" value={String(readyCount)} icon={<CheckCircle2 className="h-4 w-4" />} color="text-emerald-400" />
        <StatCard label="Warnings" value={String(warningCount)} icon={<AlertCircle className="h-4 w-4" />} color="text-amber-400" />
        <StatCard label="Failed" value={String(preview.failedRows.length)} icon={<AlertCircle className="h-4 w-4" />} color="text-rose-400" />
      </div>

      {/* Cash Movement */}
      <div className="grid grid-cols-3 gap-3">
        <CashCard label="Income" amount={preview.incomeTotal} icon={<TrendingUp className="h-4 w-4" />} color="text-emerald-400" currencySymbol={currencySymbol} />
        <CashCard label="Expenses" amount={preview.expenseTotal} icon={<TrendingDown className="h-4 w-4" />} color="text-rose-400" currencySymbol={currencySymbol} />
        <CashCard label="Net" amount={preview.netMovement} icon={<Sparkles className="h-4 w-4" />} color={preview.netMovement >= 0 ? "text-emerald-400" : "text-rose-400"} currencySymbol={currencySymbol} />
      </div>

      {/* Preview Table */}
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "rgba(148,163,184,0.16)" }}>
        <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: "rgba(148,163,184,0.16)", background: "#111827" }}>
          <h3 className="text-sm font-semibold text-[var(--foreground)]">Preview</h3>
          <span className="text-xs text-[var(--muted-foreground)]">{fileName}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[var(--muted-foreground)]" style={{ background: "rgba(17,24,39,0.8)" }}>
                <th className="px-3 py-2 font-medium">Row</th>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Merchant</th>
                <th className="px-3 py-2 font-medium">Description</th>
                <th className="px-3 py-2 font-medium text-right">Amount</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Category</th>
                {extraFields.includes("reference") && <th className="px-3 py-2 font-medium">Ref</th>}
                {extraFields.includes("balance") && <th className="px-3 py-2 font-medium text-right">Balance</th>}
                {extraFields.includes("currency") && <th className="px-3 py-2 font-medium">Cur</th>}
                <th className="px-3 py-2 font-medium">Conf</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {preview.previewRows.map((row) => (
                <tr
                  key={row.rowNumber}
                  className="border-t transition-colors hover:bg-[rgba(148,163,184,0.04)]"
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
                  <td className="px-3 py-2 text-[var(--foreground)] max-w-[120px] truncate">{row.merchant}</td>
                  <td className="px-3 py-2 text-[var(--foreground)] max-w-[160px] truncate">{row.description}</td>
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
                  <td className="px-3 py-2 text-[var(--foreground)]">{row.category}</td>
                  {extraFields.includes("reference") && (
                    <td className="px-3 py-2 text-[var(--foreground)] max-w-[80px] truncate">
                      {row.rawData[Object.keys(row.rawData).find((k) => k.toLowerCase().includes("ref")) || ""] || "-"}
                    </td>
                  )}
                  {extraFields.includes("balance") && (
                    <td className="px-3 py-2 text-right font-mono text-[var(--muted-foreground)]">
                      {row.rawData[Object.keys(row.rawData).find((k) => k.toLowerCase().includes("balance")) || ""] || "-"}
                    </td>
                  )}
                  {extraFields.includes("currency") && (
                    <td className="px-3 py-2 text-[var(--foreground)]">{row.currency || "-"}</td>
                  )}
                  <td className="px-3 py-2">
                    <span className={row.confidenceScore >= 85 ? "text-emerald-400" : row.confidenceScore >= 60 ? "text-amber-400" : "text-rose-400"}>
                      {row.confidenceScore}%
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge
                      variant={
                        row.status === "Categorised"
                          ? "success"
                          : row.status === "Needs Review"
                          ? "warning"
                          : "neutral"
                      }
                    >
                      {row.status}
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
  onUploadAnother,
}: {
  summary: ImportSummary;
  currencySymbol: string;
  onUploadAnother: () => void;
}) {
  return (
    <div className="space-y-5">
      <div
        className="rounded-xl border p-6 text-center"
        style={{
          borderColor: summary.success ? "rgba(20,184,166,0.3)" : "rgba(244,63,94,0.3)",
          background: summary.success ? "rgba(20,184,166,0.06)" : "rgba(244,63,94,0.06)",
        }}
      >
        <div className="flex flex-col items-center gap-3">
          {summary.success ? (
            <CheckCircle2 className="h-10 w-10 text-emerald-400" />
          ) : (
            <AlertCircle className="h-10 w-10 text-rose-400" />
          )}
          <div>
            <h3 className="text-lg font-semibold text-[var(--foreground)]">
              {summary.success ? "Import Complete" : "Import Failed"}
            </h3>
            <p className="text-sm text-[var(--muted-foreground)]">
              {summary.fileName} · {summary.sourceType.replace(/_/g, " ")}
            </p>
          </div>
        </div>
      </div>

      {summary.success && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Rows Imported" value={String(summary.rowsImported)} icon={<Database className="h-4 w-4" />} />
          <StatCard label="Subscriptions" value={String(summary.subscriptionsDetected)} icon={<RefreshCw className="h-4 w-4" />} />
          <StatCard label="Alerts" value={String(summary.alertsCreated)} icon={<AlertCircle className="h-4 w-4" />} />
          <StatCard label="Recommendations" value={String(summary.recommendationsCreated)} icon={<Sparkles className="h-4 w-4" />} />
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
        <a href="/transactions" className="btn-secondary text-sm">
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
