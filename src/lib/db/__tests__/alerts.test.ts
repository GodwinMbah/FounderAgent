import { describe, it, expect, vi, beforeEach } from "vitest";
import { createAlert } from "../alerts";

const mockFrom = vi.fn();
const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockSingle = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockFrom.mockReturnValue({
    insert: mockInsert,
  });
  mockInsert.mockReturnValue({
    select: mockSelect,
  });
  mockSelect.mockReturnValue({
    single: mockSingle,
  });
});

function mockSingleResponse(data: Record<string, unknown> | null, error: Error | null) {
  mockSingle.mockResolvedValueOnce({ data, error });
}

describe("createAlert", () => {
  it("normalises invalid severity to 'info'", async () => {
    mockSingleResponse(
      {
        id: "alert-1",
        company_id: "company-1",
        title: "Test Alert",
        description: "Test description",
        severity: "info",
        category: "spending",
        resource_type: null,
        resource_id: null,
        is_read: false,
        is_dismissed: false,
        status: "open",
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      null
    );

    const alert = await createAlert({
      companyId: "company-1",
      title: "Test Alert",
      description: "Test description",
      severity: "invalid_severity" as import("@/lib/types").AlertSeverity,
      category: "spending",
    });

    expect(alert.severity).toBe("info");
  });

  it("preserves valid severity values", async () => {
    for (const severity of ["critical", "warning", "info", "resolved"] as const) {
      vi.clearAllMocks();
      mockSingleResponse(
        {
          id: `alert-${severity}`,
          company_id: "company-1",
          title: "Test Alert",
          description: "Test description",
          severity,
          category: "spending",
          resource_type: null,
          resource_id: null,
          is_read: false,
          is_dismissed: false,
          status: "open",
          metadata: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        null
      );

      const alert = await createAlert({
        companyId: "company-1",
        title: "Test Alert",
        description: "Test description",
        severity,
        category: "spending",
      });

      expect(alert.severity).toBe(severity);
    }
  });

  it("retries with fallback category on enum violation", async () => {
    // First insert fails with enum error
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { message: "invalid input value for enum alert_category" },
    });

    // Retry succeeds
    mockSingle.mockResolvedValueOnce({
      data: {
        id: "alert-2",
        company_id: "company-1",
        title: "Test Alert",
        description: "Test description",
        severity: "warning",
        category: "spending",
        resource_type: null,
        resource_id: null,
        is_read: false,
        is_dismissed: false,
        status: "open",
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      error: null,
    });

    const alert = await createAlert({
      companyId: "company-1",
      title: "Test Alert",
      description: "Test description",
      severity: "warning",
      category: "unknown_category",
    });

    expect(alert.category).toBe("spending");
    expect(mockInsert).toHaveBeenCalledTimes(2);
  });

  it("normalises undefined severity to 'info'", async () => {
    mockSingleResponse(
      {
        id: "alert-3",
        company_id: "company-1",
        title: "Test Alert",
        description: "Test description",
        severity: "info",
        category: "spending",
        resource_type: null,
        resource_id: null,
        is_read: false,
        is_dismissed: false,
        status: "open",
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      null
    );

    const alert = await createAlert({
      companyId: "company-1",
      title: "Test Alert",
      description: "Test description",
    });

    expect(alert.severity).toBe("info");
  });
});
