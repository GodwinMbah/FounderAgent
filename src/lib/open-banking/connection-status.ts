import type { OpenBankingSyncStatus, ProviderConsent } from "./types";

export interface SyncLogDraft {
  level: "info" | "warning" | "error";
  event: string;
  message: string;
  providerErrorCode?: string;
  providerErrorType?: string;
  rawPayload: Record<string, unknown>;
}

export function getConsentRuntimeStatus(
  consent: Pick<ProviderConsent, "status" | "consentExpiresAt">,
  now: Date = new Date()
): ProviderConsent["status"] {
  if (consent.status === "disconnected" || consent.status === "error" || consent.status === "requires_reconnect") {
    return consent.status;
  }

  if (consent.consentExpiresAt && new Date(consent.consentExpiresAt).getTime() <= now.getTime()) {
    return "expired";
  }

  return consent.status;
}

export function buildSyncErrorLog(input: {
  provider: string;
  event: string;
  error: unknown;
  status?: OpenBankingSyncStatus;
}): SyncLogDraft {
  const message = input.error instanceof Error ? input.error.message : String(input.error);
  const rawPayload: Record<string, unknown> =
    input.error && typeof input.error === "object"
      ? { ...(input.error as Record<string, unknown>), status: input.status }
      : { error: message, status: input.status };

  return {
    level: "error",
    event: input.event,
    message,
    providerErrorCode: typeof rawPayload.code === "string" ? rawPayload.code : undefined,
    providerErrorType: typeof rawPayload.type === "string" ? rawPayload.type : undefined,
    rawPayload,
  };
}
