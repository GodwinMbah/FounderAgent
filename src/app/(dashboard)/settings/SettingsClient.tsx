"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import {
  User,
  Building2,
  Bell,
  Shield,
  Database,
  Palette,
  Trash2,
  AlertTriangle,
  Briefcase,
  Check,
} from "lucide-react";
import { updateBusinessProfile } from "@/lib/actions/settings";

interface SettingsClientProps {
  profile: {
    full_name?: string | null;
    email?: string | null;
  } | null;
  company: {
    id?: string;
    name?: string | null;
    currency?: string | null;
    fiscal_year_start?: number | null;
    timezone?: string | null;
    industry?: string | null;
  } | null;
  companyId: string;
  companySettings: {
    businessModel?: string;
    revenueModels?: string[];
    costStructure?: string[];
  } | null;
}

const BUSINESS_MODEL_OPTIONS: { value: string; label: string }[] = [
  { value: "saas", label: "SaaS" },
  { value: "services", label: "Services" },
  { value: "consulting", label: "Consulting" },
  { value: "agency", label: "Agency" },
  { value: "physical_products", label: "Physical Products" },
  { value: "ecommerce", label: "E-commerce" },
  { value: "marketplace", label: "Marketplace" },
  { value: "digital_products", label: "Digital Products" },
  { value: "membership", label: "Membership" },
  { value: "mixed", label: "Mixed" },
  { value: "other", label: "Other" },
];

const REVENUE_MODEL_OPTIONS: { value: string; label: string }[] = [
  { value: "subscription", label: "Subscription" },
  { value: "one_time", label: "One-time" },
  { value: "project", label: "Project" },
  { value: "retainer", label: "Retainer" },
  { value: "marketplace_commission", label: "Marketplace Commission" },
  { value: "affiliate", label: "Affiliate" },
  { value: "digital_product", label: "Digital Product" },
  { value: "physical_product", label: "Physical Product" },
  { value: "usage_based", label: "Usage-based" },
  { value: "donation", label: "Donation" },
  { value: "mixed", label: "Mixed" },
];

const COST_STRUCTURE_OPTIONS: { value: string; label: string }[] = [
  { value: "cogs", label: "COGS" },
  { value: "inventory", label: "Inventory" },
  { value: "shipping", label: "Shipping" },
  { value: "contractors", label: "Contractors" },
  { value: "payroll", label: "Payroll" },
  { value: "advertising", label: "Advertising" },
  { value: "software", label: "Software" },
  { value: "cloud", label: "Cloud" },
  { value: "payment_fees", label: "Payment Fees" },
  { value: "office", label: "Office" },
  { value: "professional_services", label: "Professional Services" },
  { value: "other", label: "Other" },
];

function ConfirmModal({
  title,
  message,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="h-8 w-8 rounded-full bg-[var(--danger)]/10 flex items-center justify-center">
            <AlertTriangle className="h-4 w-4 text-[var(--danger)]" />
          </div>
          <h3 className="text-sm font-bold text-[var(--foreground)]">{title}</h3>
        </div>
        <p className="text-xs text-[var(--muted-foreground)] mb-5">{message}</p>
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--secondary)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded-lg bg-[var(--danger)]/10 px-3 py-1.5 text-xs font-semibold text-[var(--danger)] hover:bg-[var(--danger)]/20 transition-colors border border-[var(--danger)]/20"
          >
            Delete Account
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SettingsClient({
  profile,
  company,
  companyId,
  companySettings,
}: SettingsClientProps) {
  const fullName = profile?.full_name ?? "";
  const email = profile?.email ?? "";
  const companyName = company?.name ?? "";
  const currency = company?.currency ?? "GBP";
  const fiscalStart = company?.fiscal_year_start ?? 1;
  const timezone = company?.timezone ?? "America/New_York";
  const [notifications, setNotifications] = useState<Record<string, boolean>>({
    "Weekly summary email": true,
    "Real-time anomaly alerts": true,
    "Subscription renewal reminders": true,
    "Report generation complete": true,
  });
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const [businessModel, setBusinessModel] = useState(
    companySettings?.businessModel ?? ""
  );
  const [revenueModels, setRevenueModels] = useState<string[]>(
    companySettings?.revenueModels ?? []
  );
  const [costStructure, setCostStructure] = useState<string[]>(
    companySettings?.costStructure ?? []
  );
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const monthValue = fiscalStart.toString().padStart(2, "0");

  function toggleRevenueModel(value: string) {
    setRevenueModels((prev) =>
      prev.includes(value)
        ? prev.filter((v) => v !== value)
        : [...prev, value]
    );
  }

  function toggleCostStructure(value: string) {
    setCostStructure((prev) =>
      prev.includes(value)
        ? prev.filter((v) => v !== value)
        : [...prev, value]
    );
  }

  function handleSaveBusinessProfile() {
    setSaveMessage(null);
    startTransition(async () => {
      try {
        await updateBusinessProfile(companyId, {
          businessModel,
          revenueModels,
          costStructure,
        });
        setSaveMessage("Business profile saved successfully.");
        router.refresh();
      } catch {
        setSaveMessage("Failed to save business profile.");
      }
    });
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Settings"
        subtitle="Manage company profile, fiscal settings, notifications, and preferences."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column */}
        <div className="space-y-6 lg:col-span-2">
          {/* Profile */}
          <Card padding="none">
            <div className="px-5 py-4 border-b border-[var(--border)] flex items-center gap-2">
              <User className="h-4 w-4 text-[#14B8A6]" />
              <h3 className="text-sm font-bold text-[#F1F5F9]">Profile</h3>
            </div>
            <div className="p-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-[#94A3B8] mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  defaultValue={fullName}
                  className="w-full rounded-lg border bg-[#09090B] px-3 py-2 text-sm text-[#F1F5F9] outline-none focus:border-[#14B8A6]/50"
                  style={{ borderColor: "rgba(148,163,184,0.16)" }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#94A3B8] mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  defaultValue={email}
                  className="w-full rounded-lg border bg-[#09090B] px-3 py-2 text-sm text-[#F1F5F9] outline-none focus:border-[#14B8A6]/50"
                  style={{ borderColor: "rgba(148,163,184,0.16)" }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#94A3B8] mb-1.5">
                  Company
                </label>
                <input
                  type="text"
                  defaultValue={companyName}
                  className="w-full rounded-lg border bg-[#09090B] px-3 py-2 text-sm text-[#F1F5F9] outline-none focus:border-[#14B8A6]/50"
                  style={{ borderColor: "rgba(148,163,184,0.16)" }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#94A3B8] mb-1.5">
                  Role
                </label>
                <input
                  type="text"
                  defaultValue="CEO / Founder"
                  className="w-full rounded-lg border bg-[#09090B] px-3 py-2 text-sm text-[#F1F5F9] outline-none focus:border-[#14B8A6]/50"
                  style={{ borderColor: "rgba(148,163,184,0.16)" }}
                />
              </div>
            </div>
          </Card>

          {/* Company & Fiscal */}
          <Card padding="none">
            <div className="px-5 py-4 border-b border-[var(--border)] flex items-center gap-2">
              <Building2 className="h-4 w-4 text-[#8B5CF6]" />
              <h3 className="text-sm font-bold text-[#F1F5F9]">Company & Fiscal</h3>
            </div>
            <div className="p-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-[#94A3B8] mb-1.5">
                  Base Currency
                </label>
                <select
                  defaultValue={currency}
                  className="w-full rounded-lg border bg-[#09090B] px-3 py-2 text-sm text-[#F1F5F9] outline-none focus:border-[#14B8A6]/50"
                  style={{ borderColor: "rgba(148,163,184,0.16)" }}
                >
                  <option value="USD">USD — US Dollar</option>
                  <option value="EUR">EUR — Euro</option>
                  <option value="GBP">GBP — British Pound</option>
                  <option value="AUD">AUD — Australian Dollar</option>
                  <option value="CAD">CAD — Canadian Dollar</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#94A3B8] mb-1.5">
                  Fiscal Year Start
                </label>
                <select
                  defaultValue={monthValue}
                  className="w-full rounded-lg border bg-[#09090B] px-3 py-2 text-sm text-[#F1F5F9] outline-none focus:border-[#14B8A6]/50"
                  style={{ borderColor: "rgba(148,163,184,0.16)" }}
                >
                  {Array.from({ length: 12 }, (_, i) => {
                    const val = (i + 1).toString().padStart(2, "0");
                    const label = new Date(2000, i, 1).toLocaleString("default", {
                      month: "long",
                    });
                    return (
                      <option key={val} value={val}>
                        {label}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#94A3B8] mb-1.5">
                  Tax Region
                </label>
                <input
                  type="text"
                  defaultValue="United States"
                  className="w-full rounded-lg border bg-[#09090B] px-3 py-2 text-sm text-[#F1F5F9] outline-none focus:border-[#14B8A6]/50"
                  style={{ borderColor: "rgba(148,163,184,0.16)" }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#94A3B8] mb-1.5">
                  Timezone
                </label>
                <select
                  defaultValue={timezone}
                  className="w-full rounded-lg border bg-[#09090B] px-3 py-2 text-sm text-[#F1F5F9] outline-none focus:border-[#14B8A6]/50"
                  style={{ borderColor: "rgba(148,163,184,0.16)" }}
                >
                  <option value="America/New_York">America/New York</option>
                  <option value="America/Los_Angeles">America/Los Angeles</option>
                  <option value="Europe/London">Europe/London</option>
                  <option value="Asia/Tokyo">Asia/Tokyo</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>
            </div>
          </Card>

          {/* Business Profile */}
          <Card padding="none">
            <div className="px-5 py-4 border-b border-[var(--border)] flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-[#F97316]" />
              <h3 className="text-sm font-bold text-[#F1F5F9]">Business Profile</h3>
            </div>
            <div className="p-5 space-y-5">
              <div>
                <label className="block text-xs font-semibold text-[#94A3B8] mb-1.5">
                  Business Model
                </label>
                <select
                  value={businessModel}
                  onChange={(e) => setBusinessModel(e.target.value)}
                  className="w-full rounded-lg border bg-[#09090B] px-3 py-2 text-sm text-[#F1F5F9] outline-none focus:border-[#14B8A6]/50"
                  style={{ borderColor: "rgba(148,163,184,0.16)" }}
                >
                  <option value="">Select business model</option>
                  {BUSINESS_MODEL_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#94A3B8] mb-2">
                  Revenue Models
                </label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {REVENUE_MODEL_OPTIONS.map((opt) => (
                    <label
                      key={opt.value}
                      className="flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer hover:bg-[var(--secondary)]/30 transition-colors"
                      style={{ borderColor: "rgba(148,163,184,0.16)" }}
                    >
                      <input
                        type="checkbox"
                        checked={revenueModels.includes(opt.value)}
                        onChange={() => toggleRevenueModel(opt.value)}
                        className="h-4 w-4 rounded border-[#94A3B8]/30 bg-[#09090B] text-[#14B8A6] focus:ring-[#14B8A6]"
                      />
                      <span className="text-xs text-[#F1F5F9]">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#94A3B8] mb-2">
                  Cost Structure
                </label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {COST_STRUCTURE_OPTIONS.map((opt) => (
                    <label
                      key={opt.value}
                      className="flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer hover:bg-[var(--secondary)]/30 transition-colors"
                      style={{ borderColor: "rgba(148,163,184,0.16)" }}
                    >
                      <input
                        type="checkbox"
                        checked={costStructure.includes(opt.value)}
                        onChange={() => toggleCostStructure(opt.value)}
                        className="h-4 w-4 rounded border-[#94A3B8]/30 bg-[#09090B] text-[#14B8A6] focus:ring-[#14B8A6]"
                      />
                      <span className="text-xs text-[#F1F5F9]">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={handleSaveBusinessProfile}
                  disabled={isPending}
                  className="rounded-lg bg-[#14B8A6] px-4 py-2 text-sm font-semibold text-white hover:bg-[#14B8A6]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPending ? "Saving..." : "Save Business Profile"}
                </button>
                {saveMessage && (
                  <span className="flex items-center gap-1 text-xs font-medium text-[#22C55E]">
                    <Check className="h-3.5 w-3.5" />
                    {saveMessage}
                  </span>
                )}
              </div>
            </div>
          </Card>

          {/* Security */}
          <Card padding="none">
            <div className="px-5 py-4 border-b border-[var(--border)] flex items-center gap-2">
              <Shield className="h-4 w-4 text-[#FBBF24]" />
              <h3 className="text-sm font-bold text-[#F1F5F9]">Security</h3>
            </div>
            <div className="divide-y divide-[var(--border)]">
              {[
                { label: "Change Password", desc: "Last updated 14 days ago" },
                { label: "Two-Factor Authentication", desc: "Enabled via authenticator app" },
                { label: "Active Sessions", desc: "3 devices currently signed in" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between px-5 py-4"
                >
                  <div>
                    <p className="text-sm font-medium text-[#F1F5F9]">{item.label}</p>
                    <p className="text-xs text-[#94A3B8]">{item.desc}</p>
                  </div>
                  <button
                    disabled
                    title="Coming soon"
                    className="rounded-lg border px-3 py-1.5 text-xs font-semibold text-[var(--muted-foreground)] transition-colors cursor-not-allowed opacity-50"
                    style={{ borderColor: "rgba(148,163,184,0.16)" }}
                  >
                    Manage
                  </button>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Notifications */}
          <Card padding="none">
            <div className="px-5 py-4 border-b border-[var(--border)] flex items-center gap-2">
              <Bell className="h-4 w-4 text-[#22C55E]" />
              <h3 className="text-sm font-bold text-[#F1F5F9]">Notifications</h3>
            </div>
            <div className="divide-y divide-[var(--border)]">
              {[
                "Weekly summary email",
                "Real-time anomaly alerts",
                "Subscription renewal reminders",
                "Report generation complete",
              ].map((label) => (
                <div
                  key={label}
                  className="flex items-center justify-between px-5 py-3.5"
                >
                  <span className="text-sm text-[#F1F5F9]">{label}</span>
                  <button
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      notifications[label] ? "bg-[#14B8A6]" : "bg-[var(--muted)]"
                    }`}
                    onClick={() =>
                      setNotifications((prev) => ({
                        ...prev,
                        [label]: !prev[label],
                      }))
                    }
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                        notifications[label]
                          ? "translate-x-4"
                          : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          </Card>

          {/* Data */}
          <Card padding="none">
            <div className="px-5 py-4 border-b border-[var(--border)] flex items-center gap-2">
              <Database className="h-4 w-4 text-[#38BDF8]" />
              <h3 className="text-sm font-bold text-[#F1F5F9]">Data</h3>
            </div>
            <div className="p-5 space-y-3">
              <button
                disabled
                title="Export feature coming soon"
                className="w-full rounded-lg border px-3 py-2.5 text-left text-sm font-medium text-[var(--muted-foreground)] transition-colors cursor-not-allowed opacity-50"
                style={{ borderColor: "rgba(148,163,184,0.16)" }}
              >
                Export All Data
              </button>
            </div>
          </Card>

          {/* Preferences */}
          <Card padding="none">
            <div className="px-5 py-4 border-b border-[var(--border)] flex items-center gap-2">
              <Palette className="h-4 w-4 text-[#8B5CF6]" />
              <h3 className="text-sm font-bold text-[#F1F5F9]">Preferences</h3>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#F1F5F9]">Dark Mode</span>
                <span className="text-xs font-semibold text-[#14B8A6]">On</span>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#94A3B8] mb-1.5">
                  Display Currency
                </label>
                <select
                  defaultValue={currency}
                  className="w-full rounded-lg border bg-[#09090B] px-3 py-2 text-sm text-[#F1F5F9] outline-none focus:border-[#14B8A6]/50"
                  style={{ borderColor: "rgba(148,163,184,0.16)" }}
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#94A3B8] mb-1.5">
                  Language
                </label>
                <select
                  defaultValue="en"
                  className="w-full rounded-lg border bg-[#09090B] px-3 py-2 text-sm text-[#F1F5F9] outline-none focus:border-[#14B8A6]/50"
                  style={{ borderColor: "rgba(148,163,184,0.16)" }}
                >
                  <option value="en">English</option>
                  <option value="es">Español</option>
                  <option value="fr">Français</option>
                </select>
              </div>
            </div>
          </Card>

          {/* Danger Zone */}
          <Card padding="none" className="border-[#F43F5E]/30">
            <div className="px-5 py-4 border-b border-[#F43F5E]/20 flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-[#F43F5E]" />
              <h3 className="text-sm font-bold text-[#F43F5E]">Danger Zone</h3>
            </div>
            <div className="p-5">
              <p className="text-xs text-[#94A3B8] mb-3">
                Deleting your account will permanently remove all data. This action
                cannot be undone.
              </p>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="w-full rounded-lg bg-[#F43F5E]/10 px-3 py-2 text-sm font-semibold text-[#F43F5E] transition-colors hover:bg-[#F43F5E]/20 border border-[#F43F5E]/20"
              >
                Delete Account
              </button>
            </div>
          </Card>
        </div>
      </div>

      {showDeleteModal && (
        <ConfirmModal
          title="Delete Account"
          message="Deleting your account will permanently remove all data including transactions, subscriptions, and company settings. This action cannot be undone."
          onConfirm={() => {
            setShowDeleteModal(false);
            alert("Account deletion request submitted.");
          }}
          onCancel={() => setShowDeleteModal(false)}
        />
      )}
    </div>
  );
}
