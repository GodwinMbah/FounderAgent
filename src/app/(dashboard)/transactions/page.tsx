import { getTransactions, getTransactionStats, requireAuthCompany } from "@/lib/db";
import { getGlobalDateRange } from "@/lib/date-range-server";
import { getUploads } from "@/lib/db/uploads";
import TransactionsContent from "./content";

interface Props {
  searchParams?: Promise<{ preset?: string; from?: string; to?: string }>;
}

export default async function TransactionsPage({ searchParams }: Props) {
  const { companyId } = await requireAuthCompany();

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const { preset, from, to } = await getGlobalDateRange(resolvedSearchParams);

  const [transactions, stats, uploads] = await Promise.all([
    getTransactions(companyId, { startDate: from, endDate: to, limit: 500 }),
    getTransactionStats(companyId),
    getUploads(companyId),
  ]);

  return (
    <TransactionsContent
      transactions={transactions}
      stats={stats}
      uploads={uploads.map((u) => ({ id: u.id, fileName: u.fileName, uploadedAt: u.uploadedAt }))}
      initialPreset={preset}
      initialFrom={from}
      initialTo={to}
    />
  );
}
