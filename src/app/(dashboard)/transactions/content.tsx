"use client";

import { useState, useMemo } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { MetricCard } from "@/components/ui/MetricCard";
import { DataTable } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SectionCard } from "@/components/ui/SectionCard";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";
import type { Transaction } from "@/lib/types";
import { Search, ListFilter, Tag, ArrowUpDown, CreditCard, CheckCircle2, Brain, AlertCircle } from "lucide-react";

function formatStatusLabel(status: string) {
  return status
    .split("_")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}

function getStatusVariant(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === "categorised" || normalized === "categorized") return "success";
  if (normalized === "ai_suggested") return "info";
  return "warning";
}

interface TransactionsContentProps {
  transactions: Transaction[];
  stats: { total: number; expenses: number; count: number; categorized: number; needsReview: number };
}

export default function TransactionsContent({ transactions, stats }: TransactionsContentProps) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sort, setSort] = useState("newest");

  const total = transactions.length;
  const categorised = transactions.filter((t) => t.status.toLowerCase() === "categorised" || t.status.toLowerCase() === "categorized").length;
  const aiSuggested = transactions.filter((t) => t.status.toLowerCase() === "ai_suggested").length;
  const needsReview = transactions.filter((t) => (t.confidenceScore ?? 0) < 90).length;

  const categories = useMemo(
    () => Array.from(new Set(transactions.map((t) => t.category).filter(Boolean))),
    [transactions]
  );

  const filtered = useMemo(() => {
    let data = [...transactions];

    if (search.trim()) {
      const q = search.toLowerCase();
      data = data.filter(
        (t) =>
          (t.merchant ?? "").toLowerCase().includes(q) ||
          (t.description ?? "").toLowerCase().includes(q) ||
          (t.category ?? "").toLowerCase().includes(q)
      );
    }

    if (typeFilter !== "all") {
      data = data.filter((t) => t.type === typeFilter);
    }

    if (categoryFilter !== "all") {
      data = data.filter((t) => t.category === categoryFilter);
    }

    if (sort === "newest") {
      data.sort((a, b) => +new Date(b.date) - +new Date(a.date));
    } else if (sort === "oldest") {
      data.sort((a, b) => +new Date(a.date) - +new Date(b.date));
    } else if (sort === "amount-high") {
      data.sort((a, b) => b.amount - a.amount);
    } else if (sort === "amount-low") {
      data.sort((a, b) => a.amount - b.amount);
    }

    return data;
  }, [search, typeFilter, categoryFilter, sort, transactions]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Transactions"
        subtitle="Smart transaction intelligence with AI categorisation and anomaly detection."
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Total Transactions"
          value={String(total)}
          icon={<CreditCard className="h-5 w-5" />}
          iconColor="#8B5CF6"
        />
        <MetricCard
          label="Categorised"
          value={String(categorised)}
          icon={<CheckCircle2 className="h-5 w-5" />}
          iconColor="#22C55E"
        />
        <MetricCard
          label="AI Suggested"
          value={String(aiSuggested)}
          icon={<Brain className="h-5 w-5" />}
          iconColor="#14B8A6"
        />
        <MetricCard
          label="Needs Review"
          value={String(needsReview)}
          icon={<AlertCircle className="h-5 w-5" />}
          iconColor="#FBBF24"
        />
      </div>

      {/* Filters */}
      <SectionCard>
        <div className="p-5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
              <input
                type="text"
                placeholder="Search transactions..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border bg-[#09090B] py-2 pl-9 pr-3 text-sm text-[#F1F5F9] outline-none focus:border-[#14B8A6]/50"
                style={{ borderColor: "rgba(148,163,184,0.16)" }}
              />
            </div>

            <div className="relative">
              <ListFilter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="rounded-lg border bg-[#09090B] py-2 pl-9 pr-8 text-sm text-[#F1F5F9] outline-none focus:border-[#14B8A6]/50 appearance-none"
                style={{ borderColor: "rgba(148,163,184,0.16)" }}
              >
                <option value="all">All Types</option>
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </select>
            </div>

            <div className="relative">
              <Tag className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="rounded-lg border bg-[#09090B] py-2 pl-9 pr-8 text-sm text-[#F1F5F9] outline-none focus:border-[#14B8A6]/50 appearance-none"
                style={{ borderColor: "rgba(148,163,184,0.16)" }}
              >
                <option value="all">All Categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative">
              <ArrowUpDown className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="rounded-lg border bg-[#09090B] py-2 pl-9 pr-8 text-sm text-[#F1F5F9] outline-none focus:border-[#14B8A6]/50 appearance-none"
                style={{ borderColor: "rgba(148,163,184,0.16)" }}
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="amount-high">Amount: High to Low</option>
                <option value="amount-low">Amount: Low to High</option>
              </select>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Data Table */}
      <SectionCard title="Transaction List" subtitle={`${filtered.length} transactions`}>
        <DataTable
          columns={[
            {
              key: "date",
              header: "Date",
              width: "110px",
              render: (row) => formatDate(row.date),
            },
            {
              key: "merchant",
              header: "Merchant",
              render: (row) => (
                <div>
                  <p className="text-sm font-medium text-[#F1F5F9]">{row.merchant}</p>
                  <p className="text-xs text-[#94A3B8]">{row.description}</p>
                </div>
              ),
            },
            { key: "category", header: "Category" },
            {
              key: "amount",
              header: "Amount",
              align: "right",
              width: "120px",
              render: (row) => (
                <span className={row.type === "income" ? "text-[#22C55E]" : "text-[#F1F5F9]"}>
                  {row.type === "income" ? "+" : "-"}
                  {formatCurrency(row.amount)}
                </span>
              ),
            },
            {
              key: "status",
              header: "Status",
              width: "130px",
              render: (row) => (
                <StatusBadge variant={getStatusVariant(row.status)}>
                  {formatStatusLabel(row.status)}
                </StatusBadge>
              ),
            },
            {
              key: "confidenceScore",
              header: "Confidence",
              width: "140px",
              render: (row) => (
                <div className="flex items-center gap-2">
                  <div className="h-1.5 flex-1 rounded-full bg-[#18181B] overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${row.confidenceScore ?? 0}%`,
                        background:
                          (row.confidenceScore ?? 0) >= 95
                            ? "#22C55E"
                            : (row.confidenceScore ?? 0) >= 85
                            ? "#FBBF24"
                            : "#F43F5E",
                      }}
                    />
                  </div>
                  <span className="text-xs text-[#94A3B8] w-8 text-right">{row.confidenceScore}%</span>
                </div>
              ),
            },
          ]}
          data={filtered}
          keyExtractor={(row) => row.id}
        />
      </SectionCard>
    </div>
  );
}
