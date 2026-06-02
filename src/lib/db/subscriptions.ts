"use server";

import { createClient as createServerClient } from "@/lib/supabase/server";
import { getActiveCompanyForUser } from "./company";
import type { Subscription } from "@/lib/types";
import { toMonthly } from "@/lib/reporting/subscriptions";

function mapRow(row: Record<string, unknown>): Subscription {
  return {
    id: row.id as string,
    companyId: row.company_id as string,
    name: row.name as string,
    vendor: row.vendor as string | undefined,
    category: row.category as string | undefined,
    amount: Number(row.amount),
    billingCycle: row.billing_cycle as string,
    nextBillingDate: row.next_billing_date as string,
    status: row.status as string,
    startDate: row.start_date as string,
    endDate: row.end_date as string | undefined,
    notes: row.notes as string | undefined,
    isFlagged: row.is_flagged as boolean,
    flagReason: row.flag_reason as string | undefined,
    metadata: row.metadata as Record<string, unknown> | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function getSubscriptions(companyId?: string): Promise<Subscription[]> {
  const ctx = await getActiveCompanyForUser();
  if (!ctx) throw new Error("Unauthorized");
  const effectiveCompanyId = companyId ?? ctx.companyId;
  if (effectiveCompanyId !== ctx.companyId) throw new Error("Forbidden: company mismatch");

  const supabase = await createServerClient();
  if (!supabase) throw new Error("Supabase not configured");

  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("company_id", effectiveCompanyId)
    .order("amount", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapRow);
}

export async function getSubscriptionStats(companyId?: string) {
  const subs = await getSubscriptions(companyId);
  const monthlySpend = subs
    .filter((s) => s.status === "active")
    .reduce((s, sub) => {
      if (sub.billingCycle === "monthly") return s + sub.amount;
      if (sub.billingCycle === "quarterly") return s + sub.amount / 3;
      if (sub.billingCycle === "yearly") return s + sub.amount / 12;
      return s + sub.amount;
    }, 0);
  const annualized = monthlySpend * 12;
  const flagged = subs.filter((s) => s.isFlagged).length;
  const potentialSavings = subs
    .filter((s) => s.isFlagged)
    .reduce((s, sub) => s + toMonthly(sub), 0);
  return { monthlySpend, annualized, flagged, potentialSavings, count: subs.length };
}

/* ─── Write helpers (admin client — server-only) ─── */

import { createAdminClient } from "@/lib/supabase/admin";

export interface SubscriptionInsert {
  companyId: string;
  name: string;
  vendor?: string;
  category?: string;
  amount: number;
  billingCycle?: string;
  nextBillingDate?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  notes?: string;
  isFlagged?: boolean;
  flagReason?: string;
  metadata?: Record<string, unknown>;
}

export async function createSubscription(data: SubscriptionInsert): Promise<Subscription> {
  const admin = createAdminClient();
  if (!admin) throw new Error("Admin client not available");

  const { data: row, error } = await admin
    .from("subscriptions")
    .insert({
      company_id: data.companyId,
      name: data.name,
      vendor: data.vendor,
      category: data.category,
      amount: data.amount,
      billing_cycle: data.billingCycle ?? "monthly",
      next_billing_date: data.nextBillingDate ?? new Date().toISOString().slice(0, 10),
      status: data.status ?? "active",
      start_date: data.startDate ?? new Date().toISOString().slice(0, 10),
      end_date: data.endDate,
      notes: data.notes,
      is_flagged: data.isFlagged ?? false,
      flag_reason: data.flagReason,
      metadata: data.metadata ?? {},
    })
    .select("*")
    .single();

  if (error || !row) throw new Error(`Failed to create subscription: ${error?.message}`);
  return mapRow(row as Record<string, unknown>);
}

export async function findSubscriptionByVendor(
  companyId: string,
  vendor: string
): Promise<Subscription | null> {
  const admin = createAdminClient();
  if (!admin) return null;

  const { data, error } = await admin
    .from("subscriptions")
    .select("*")
    .eq("company_id", companyId)
    .ilike("vendor", vendor)
    .maybeSingle();

  if (error || !data) return null;
  return mapRow(data as Record<string, unknown>);
}

export async function updateSubscription(
  subscriptionId: string,
  companyId: string,
  updates: {
    amount?: number;
    nextBillingDate?: string;
    status?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<Subscription | null> {
  const admin = createAdminClient();
  if (!admin) return null;

  const dbUpdates: Record<string, unknown> = {};
  if (updates.amount !== undefined) dbUpdates.amount = updates.amount;
  if (updates.nextBillingDate !== undefined) dbUpdates.next_billing_date = updates.nextBillingDate;
  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.metadata !== undefined) dbUpdates.metadata = updates.metadata;

  const { data, error } = await admin
    .from("subscriptions")
    .update(dbUpdates)
    .eq("id", subscriptionId)
    .eq("company_id", companyId)
    .select("*")
    .single();

  if (error || !data) {
    console.error("[subscriptions] Update failed:", error?.message);
    return null;
  }
  return mapRow(data as Record<string, unknown>);
}
