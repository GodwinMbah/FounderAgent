import { getTransactionsPage, requireAuthCompany } from "@/lib/db";
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

  const [transactionPage, uploads] = await Promise.all([
    getTransactionsPage(companyId, { startDate: from, endDate: to, limit: 100, offset: 0 }),
    getUploads(companyId),
  ]);

  return (
    <TransactionsContent
      transactions={transactionPage.transactions}
      totalTransactions={transactionPage.total}
      uploads={uploads.map((u) => ({ id: u.id, fileName: u.fileName, uploadedAt: u.uploadedAt }))}
      initialPreset={preset}
      initialFrom={from}
      initialTo={to}
    />
  );
}
