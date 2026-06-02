import { describe, it, expect, vi, beforeEach } from "vitest";
import { confirmAndProcess } from "../wizard-actions";

const mockRequireAuthCompany = vi.fn();
const mockGetUploadSession = vi.fn();
const mockDeleteUploadSession = vi.fn();
const mockSmartMapCsv = vi.fn();
const mockCreateUpload = vi.fn();
const mockRunUploadPipeline = vi.fn();
const mockGetCompanySettings = vi.fn();
const mockStorageFrom = vi.fn();
const mockDownload = vi.fn();

vi.mock("@/lib/db/company", () => ({
  requireAuthCompany: (...args: Parameters<typeof mockRequireAuthCompany>) =>
    mockRequireAuthCompany(...args),
}));

vi.mock("@/lib/db/upload-sessions", () => ({
  getUploadSession: (...args: Parameters<typeof mockGetUploadSession>) =>
    mockGetUploadSession(...args),
  deleteUploadSession: (...args: Parameters<typeof mockDeleteUploadSession>) =>
    mockDeleteUploadSession(...args),
}));

vi.mock("@/lib/upload/smart-mapper", () => ({
  smartMapCsv: (...args: Parameters<typeof mockSmartMapCsv>) =>
    mockSmartMapCsv(...args),
}));

vi.mock("@/lib/db/uploads", () => ({
  createUpload: (...args: Parameters<typeof mockCreateUpload>) =>
    mockCreateUpload(...args),
}));

vi.mock("@/lib/upload/pipeline", () => ({
  runUploadPipeline: (...args: Parameters<typeof mockRunUploadPipeline>) =>
    mockRunUploadPipeline(...args),
}));

vi.mock("@/lib/db/company_settings", () => ({
  getCompanySettings: (...args: Parameters<typeof mockGetCompanySettings>) =>
    mockGetCompanySettings(...args),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    storage: {
      from: mockStorageFrom,
    },
  })),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuthCompany.mockResolvedValue({ companyId: "company-1", userId: "user-1" });
  mockGetCompanySettings.mockResolvedValue(null);
  mockStorageFrom.mockReturnValue({
    download: mockDownload,
  });
  mockDownload.mockResolvedValue({
    data: {
      text: vi.fn().mockResolvedValue("Date,Description,Amount\n2024-01-15,Test,-100"),
    },
    error: null,
  });
  mockSmartMapCsv.mockResolvedValue({
    previewRows: [
      { date: "2024-01-15", description: "Test", amount: -100, category: "Uncategorised Review" },
    ],
    failedRows: [],
    columnMappings: [{ field: "date", header: "Date", index: 0 }],
    mappingConfidence: 95,
    detectedCurrency: "GBP",
    detectedDateFormat: "YYYY-MM-DD",
    detectedDelimiter: ",",
    detectedProvider: "generic_bank",
    providerConfidence: 80,
    sourceType: "generic_bank",
    incomeTotal: 0,
    expenseTotal: 100,
    parsedHeaders: ["Date", "Description", "Amount"],
    columnSamples: [],
  });
  mockCreateUpload.mockResolvedValue({
    id: "upload-1",
    companyId: "company-1",
    fileName: "test.csv",
    status: "pending",
  });
});

describe("confirmAndProcess", () => {
  it("does NOT delete upload session when pipeline fails", async () => {
    mockGetUploadSession.mockResolvedValue({
      id: "session-1",
      companyId: "company-1",
      filePath: "test.csv",
      fileName: "test.csv",
      mimeType: "text/csv",
    });

    mockRunUploadPipeline.mockResolvedValue({
      success: false,
      uploadId: "upload-1",
      companyId: "company-1",
      transactionsInserted: 0,
      transactionsFailed: 0,
      subscriptionsDetected: 0,
      subscriptionsCreated: 0,
      alertsCreated: 0,
      recommendationsCreated: 0,
      tasksCreated: 0,
      error: "Pipeline error",
    });

    const result = await confirmAndProcess("session-1");

    expect(result.success).toBe(false);
    expect(mockDeleteUploadSession).not.toHaveBeenCalled();
  });

  it("deletes upload session when pipeline succeeds", async () => {
    mockGetUploadSession.mockResolvedValue({
      id: "session-1",
      companyId: "company-1",
      filePath: "test.csv",
      fileName: "test.csv",
      mimeType: "text/csv",
    });

    mockRunUploadPipeline.mockResolvedValue({
      success: true,
      uploadId: "upload-1",
      companyId: "company-1",
      transactionsInserted: 1,
      transactionsFailed: 0,
      subscriptionsDetected: 0,
      subscriptionsCreated: 0,
      alertsCreated: 0,
      recommendationsCreated: 0,
      tasksCreated: 0,
    });

    const result = await confirmAndProcess("session-1");

    expect(result.success).toBe(true);
    expect(mockDeleteUploadSession).toHaveBeenCalledWith("session-1", "company-1");
  });

  it("returns session expired error when session is not found", async () => {
    mockGetUploadSession.mockResolvedValue(null);

    const result = await confirmAndProcess("session-missing");

    expect(result.success).toBe(false);
    expect(result.error).toContain("Session expired");
    expect(mockDeleteUploadSession).not.toHaveBeenCalled();
  });
});
