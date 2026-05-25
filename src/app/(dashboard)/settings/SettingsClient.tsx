"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import { SectionCard } from "@/components/ui/SectionCard";
import { Card } from "@/components/ui/Card";
import { User, Building2, Bell, Shield, Database, Palette, Trash2 } from "lucide-react";

interface SettingsClientProps {
  profile: {
    full_name?: string | null;
    email?: string | null;
  } | null;
  company: {
    name?: string | null;
    currency?: string | null;
    fiscal_year_start?: number | null;
    timezone?: string | null;
    industry?: string | null;
  } | null;
}

export default function SettingsClient({ profile, company }: SettingsClientProps) {
  const fullName = profile?.full_name ?? "";
  const email = profile?.email ?? "";
  const companyName = company?.name ?? "";
  const currency = company?.currency ?? "USD";
  const fiscalStart = company?.fiscal_year_start ?? 1;
  const timezone = company?.timezone ?? "America/New_York";

  const monthValue = fiscalStart.toString().padStart(2, "0");
  const monthLabel = new Date(2000, fiscalStart - 1, 1).toLocaleString("default", { month: "long" });

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
                <label className="block text-xs font-semibold text-[#94A3B8] mb-1.5">Full Name</label>
                <input
                  type="text"
                  defaultValue={fullName}
                  className="w-full rounded-lg border bg-[#09090B] px-3 py-2 text-sm text-[#F1F5F9] outline-none focus:border-[#14B8A6]/50"
                  style={{ borderColor: "rgba(148,163,184,0.16)" }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#94A3B8] mb-1.5">Email</label>
                <input
                  type="email"
                  defaultValue={email}
                  className="w-full rounded-lg border bg-[#09090B] px-3 py-2 text-sm text-[#F1F5F9] outline-none focus:border-[#14B8A6]/50"
                  style={{ borderColor: "rgba(148,163,184,0.16)" }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#94A3B8] mb-1.5">Company</label>
                <input
                  type="text"
                  defaultValue={companyName}
                  className="w-full rounded-lg border bg-[#09090B] px-3 py-2 text-sm text-[#F1F5F9] outline-none focus:border-[#14B8A6]/50"
                  style={{ borderColor: "rgba(148,163,184,0.16)" }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#94A3B8] mb-1.5">Role</label>
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
                <label className="block text-xs font-semibold text-[#94A3B8] mb-1.5">Base Currency</label>
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
                <label className="block text-xs font-semibold text-[#94A3B8] mb-1.5">Fiscal Year Start</label>
                <select
                  defaultValue={monthValue}
                  className="w-full rounded-lg border bg-[#09090B] px-3 py-2 text-sm text-[#F1F5F9] outline-none focus:border-[#14B8A6]/50"
                  style={{ borderColor: "rgba(148,163,184,0.16)" }}
                >
                  {Array.from({ length: 12 }, (_, i) => {
                    const val = (i + 1).toString().padStart(2, "0");
                    const label = new Date(2000, i, 1).toLocaleString("default", { month: "long" });
                    return (
                      <option key={val} value={val}>
                        {label}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#94A3B8] mb-1.5">Tax Region</label>
                <input
                  type="text"
                  defaultValue="United States"
                  className="w-full rounded-lg border bg-[#09090B] px-3 py-2 text-sm text-[#F1F5F9] outline-none focus:border-[#14B8A6]/50"
                  style={{ borderColor: "rgba(148,163,184,0.16)" }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#94A3B8] mb-1.5">Timezone</label>
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
                <div key={item.label} className="flex items-center justify-between px-5 py-4">
                  <div>
                    <p className="text-sm font-medium text-[#F1F5F9]">{item.label}</p>
                    <p className="text-xs text-[#94A3B8]">{item.desc}</p>
                  </div>
                  <button className="rounded-lg border px-3 py-1.5 text-xs font-semibold text-[#F1F5F9] transition-colors hover:bg-[#18181B]"
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
                <div key={label} className="flex items-center justify-between px-5 py-3.5">
                  <span className="text-sm text-[#F1F5F9]">{label}</span>
                  <button
                    className="relative inline-flex h-5 w-9 items-center rounded-full bg-[#14B8A6]"
                    onClick={() => {}}
                  >
                    <span className="inline-block h-3.5 w-3.5 translate-x-4 rounded-full bg-white" />
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
              <button className="w-full rounded-lg border px-3 py-2.5 text-left text-sm font-medium text-[#F1F5F9] transition-colors hover:bg-[#18181B]"
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
                <label className="block text-xs font-semibold text-[#94A3B8] mb-1.5">Display Currency</label>
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
                <label className="block text-xs font-semibold text-[#94A3B8] mb-1.5">Language</label>
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
                Deleting your account will permanently remove all data. This action cannot be undone.
              </p>
              <button className="w-full rounded-lg bg-[#F43F5E]/10 px-3 py-2 text-sm font-semibold text-[#F43F5E] transition-colors hover:bg-[#F43F5E]/20 border border-[#F43F5E]/20">
                Delete Account
              </button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
