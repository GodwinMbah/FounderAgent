import { getTransactionsPage, requireAuthCompany } from "@/lib/db";
import { getGlobalDateRange } from "@/lib/date-range-server";
import { getUploads } from "@/lib/db/uploads";
import { getFinancialDataSourceStatus } from "@/lib/db/data-source";
import { ConnectDataSourceState } from "@/components/features/shared/ConnectDataSourceState";
import TransactionsContent from "./content";

interface Props {
  searchParams?: Promise<{
    preset?: string;
    from?: string;
    to?: string;
    uploadId?: string;
    type?: string;
    category?: string;
    status?: string;
    duplicateStatus?: "all" | "duplicates" | "not_duplicates";
    kpiTreatment?: "all" | "included" | "excluded";
    currency?: string;
    sourceProvider?: string;
  }>;
}

export default async function TransactionsPage({ searchParams }: Props) {
  const { companyId } = await requireAuthCompany();

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const { preset, from, to } = await getGlobalDateRange(resolvedSearchParams);
  const dataSourceStatus = await getFinancialDataSourceStatus(companyId, { from, to });
  if (!dataSourceStatus.hasActiveDataSource) return <ConnectDataSourceState />;

  const initialFilters = {
    type: resolvedSearchParams?.type,
    uploadId: resolvedSearchParams?.uploadId,
    category: resolvedSearchParams?.category,
    status: resolvedSearchParams?.status,
    duplicateStatus: resolvedSearchParams?.duplicateStatus,
    kpiTreatment: resolvedSearchParams?.kpiTreatment,
    currency: resolvedSearchParams?.currency,
    sourceProvider: resolvedSearchParams?.sourceProvider,
  };

  const [transactionPage, uploads] = await Promise.all([
    getTransactionsPage(companyId, {
      startDate: from,
      endDate: to,
      limit: 100,
      offset: 0,
      type: initialFilters.type === "income" || initialFilters.type === "expense" ? initialFilters.type : undefined,
      uploadId: initialFilters.uploadId && initialFilters.uploadId !== "all" ? initialFilters.uploadId : undefined,
      category: initialFilters.category && initialFilters.category !== "all" ? initialFilters.category : undefined,
      status: initialFilters.status && initialFilters.status !== "all" ? initialFilters.status : undefined,
      duplicateStatus: initialFilters.duplicateStatus,
      kpiTreatment: initialFilters.kpiTreatment,
      currency: initialFilters.currency && initialFilters.currency !== "all" ? initialFilters.currency : undefined,
      sourceProvider: initialFilters.sourceProvider && initialFilters.sourceProvider !== "all" ? initialFilters.sourceProvider : undefined,
    }),
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
      initialFilters={initialFilters}
    />
  );
}
