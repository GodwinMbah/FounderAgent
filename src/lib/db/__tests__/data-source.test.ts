import { describe, expect, it, vi } from "vitest";
import {
  applyActiveSourceFilter,
  formatCoverageDate,
  getCoverageSummary,
  getSourceBreakdown,
  type FinancialDataSourceStatus,
} from "../data-source-shared";
import {
  hasActiveAlertSource,
  hasActiveRecommendationSource,
  hasActiveSubscriptionSource,
  hasActiveTaskSource,
} from "../source-filters";
import type { AgentRecommendation, AgentTask, Alert, Subscription } from "@/lib/types";

describe("financial data source helpers", () => {
  it("limits source-backed queries to manual rows when no active uploads exist", () => {
    const query = {
      is: vi.fn(() => query),
      or: vi.fn(() => query),
    };

    applyActiveSourceFilter(query, []);

    expect(query.is).toHaveBeenCalledWith("upload_id", null);
    expect(query.or).not.toHaveBeenCalled();
  });

  it("keeps manual rows and active upload rows when active uploads exist", () => {
    const query = {
      is: vi.fn(() => query),
      or: vi.fn(() => query),
    };

    applyActiveSourceFilter(query, ["upload-1", "upload-2"]);

    expect(query.or).toHaveBeenCalledWith("upload_id.is.null,upload_id.in.(upload-1,upload-2)");
    expect(query.is).not.toHaveBeenCalled();
  });

  it("summarises active coverage without implying stale data is current", () => {
    const status: FinancialDataSourceStatus = {
      hasActiveDataSource: true,
      activeUploadCount: 1,
      activeTransactionCount: 694,
      manualTransactionCount: 0,
      activeUploadTransactionCount: 694,
      earliestTransactionDate: "2026-01-01",
      latestTransactionDate: "2026-05-24",
    };

    expect(formatCoverageDate("2026-01-01")).toBe("01 Jan 2026");
    expect(getCoverageSummary(status)).toBe(
      "Data available: 01 Jan 2026 to 24 May 2026. Source: 694 transactions from 1 upload."
    );
  });

  it("reports no active source honestly", () => {
    expect(
      getCoverageSummary({
        hasActiveDataSource: false,
        activeUploadCount: 0,
        activeTransactionCount: 0,
        manualTransactionCount: 0,
        activeUploadTransactionCount: 0,
      })
    ).toBe("Connect your bank account or upload a statement to begin.");
  });

  it("describes connected account transactions separately from uploads and manual rows", () => {
    const status: FinancialDataSourceStatus = {
      hasActiveDataSource: true,
      activeUploadCount: 1,
      activeTransactionCount: 705,
      manualTransactionCount: 5,
      activeUploadTransactionCount: 694,
      connectedTransactionCount: 6,
      connectedAccountCount: 3,
      earliestTransactionDate: "2026-01-01",
      latestTransactionDate: "2026-05-24",
    };

    expect(getCoverageSummary(status)).toBe(
      "Data available: 01 Jan 2026 to 24 May 2026. Source: 694 transactions from 1 upload, 6 connected account transactions, 5 manual transactions."
    );
    expect(getSourceBreakdown(status)).toBe("694 transactions from 1 upload, 6 connected account transactions, 5 manual transactions");
  });
});

describe("derived record active-source filters", () => {
  const activeUploads = ["upload-live"];

  it("keeps manual subscriptions and active upload subscriptions only", () => {
    expect(
      hasActiveSubscriptionSource({ id: "manual", metadata: undefined } as Subscription, activeUploads)
    ).toBe(true);
    expect(
      hasActiveSubscriptionSource(
        { id: "active", metadata: { detected_from_upload: "upload-live" } } as Subscription,
        activeUploads
      )
    ).toBe(true);
    expect(
      hasActiveSubscriptionSource(
        { id: "stale", metadata: { source_upload_id: "upload-deleted" } } as Subscription,
        activeUploads
      )
    ).toBe(false);
    expect(
      hasActiveSubscriptionSource(
        {
          id: "refreshed",
          metadata: {
            detected_from_upload: "upload-deleted",
            last_detected_from_upload: "upload-live",
          },
        } as Subscription,
        activeUploads
      )
    ).toBe(true);
    expect(
      hasActiveSubscriptionSource(
        { id: "stale-generated", metadata: { legacy_cleanup: { status: "stale" } } } as Subscription,
        activeUploads
      )
    ).toBe(false);
  });

  it("keeps explicitly manual alerts and hides unbacked or deleted-upload alerts", () => {
    expect(hasActiveAlertSource({ id: "manual", metadata: { source: "manual" } } as Alert, activeUploads)).toBe(true);
    expect(hasActiveAlertSource({ id: "legacy", metadata: {} } as Alert, activeUploads)).toBe(false);
    expect(hasActiveAlertSource({ id: "active", metadata: { upload_id: "upload-live" } } as Alert, activeUploads)).toBe(true);
    expect(hasActiveAlertSource({ id: "stale", metadata: { upload_id: "upload-deleted" } } as Alert, activeUploads)).toBe(false);
  });

  it("keeps explicitly manual AI recommendations and hides unbacked or deleted-upload recommendations", () => {
    expect(
      hasActiveRecommendationSource({ id: "manual", metadata: { source: "manual" } } as AgentRecommendation, activeUploads)
    ).toBe(true);
    expect(hasActiveRecommendationSource({ id: "legacy", metadata: undefined } as AgentRecommendation, activeUploads)).toBe(false);
    expect(
      hasActiveRecommendationSource(
        { id: "active", metadata: { upload_id: "upload-live" } } as AgentRecommendation,
        activeUploads
      )
    ).toBe(true);
    expect(
      hasActiveRecommendationSource(
        { id: "stale", metadata: { upload_id: "upload-deleted" } } as AgentRecommendation,
        activeUploads
      )
    ).toBe(false);
  });

  it("keeps explicitly manual AI tasks and hides unbacked or deleted-upload tasks", () => {
    expect(hasActiveTaskSource({ id: "manual", inputData: { source: "manual" } } as AgentTask, activeUploads)).toBe(true);
    expect(hasActiveTaskSource({ id: "legacy", inputData: undefined } as AgentTask, activeUploads)).toBe(false);
    expect(hasActiveTaskSource({ id: "active", inputData: { upload_id: "upload-live" } } as AgentTask, activeUploads)).toBe(true);
    expect(hasActiveTaskSource({ id: "stale", inputData: { upload_id: "upload-deleted" } } as AgentTask, activeUploads)).toBe(false);
  });
});
