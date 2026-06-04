import { describe, expect, it } from "vitest";
import { buildSyncErrorLog, getConsentRuntimeStatus } from "../connection-status";

describe("Open Banking connection status helpers", () => {
  it("marks consent as expired when consent expiry is in the past", () => {
    expect(
      getConsentRuntimeStatus(
        {
          status: "connected",
          consentExpiresAt: "2026-06-01T00:00:00.000Z",
        },
        new Date("2026-06-04T00:00:00.000Z")
      )
    ).toBe("expired");
  });

  it("keeps reconnect status authoritative before expiry checks", () => {
    expect(
      getConsentRuntimeStatus(
        {
          status: "requires_reconnect",
          consentExpiresAt: "2026-07-01T00:00:00.000Z",
        },
        new Date("2026-06-04T00:00:00.000Z")
      )
    ).toBe("requires_reconnect");
  });

  it("creates a safe failed sync log draft without secrets", () => {
    const log = buildSyncErrorLog({
      provider: "plaid",
      event: "transactions_sync_failed",
      status: "failed",
      error: { code: "ITEM_LOGIN_REQUIRED", type: "ITEM_ERROR", message: "Reconnect required" },
    });

    expect(log.level).toBe("error");
    expect(log.providerErrorCode).toBe("ITEM_LOGIN_REQUIRED");
    expect(log.providerErrorType).toBe("ITEM_ERROR");
    expect(JSON.stringify(log)).not.toMatch(/access_token|secret/i);
  });
});

