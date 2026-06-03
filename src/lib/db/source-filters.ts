import type { AgentRecommendation, AgentTask, Alert, Subscription } from "@/lib/types";

function stringUploadIds(...values: unknown[]): string[] {
  return values.filter((value): value is string => typeof value === "string" && value.length > 0);
}

export function hasActiveSubscriptionSource(subscription: Subscription, activeUploadIds: string[]): boolean {
  const metadata = subscription.metadata ?? {};
  if (metadata.source === "manual" || metadata.created_by === "user" || metadata.user_created === true || metadata.manual === true) {
    return true;
  }

  const generatedUploadIds = stringUploadIds(
    metadata.detected_from_upload,
    metadata.last_detected_from_upload,
    metadata.source_upload_id,
    metadata.upload_id
  );

  if (generatedUploadIds.length === 0) {
    return (metadata.legacy_cleanup as { status?: string } | undefined)?.status !== "stale";
  }

  return generatedUploadIds.some((uploadId) => activeUploadIds.includes(uploadId));
}

export function hasActiveAlertSource(alert: Alert, activeUploadIds: string[]): boolean {
  if (alert.metadata?.source === "manual") return true;
  const uploadId = alert.metadata?.upload_id;
  if (typeof uploadId !== "string") return false;
  return activeUploadIds.includes(uploadId);
}

export function hasActiveRecommendationSource(recommendation: AgentRecommendation, activeUploadIds: string[]): boolean {
  if (recommendation.metadata?.source === "manual") return true;
  const uploadId = recommendation.metadata?.upload_id;
  if (typeof uploadId !== "string") return false;
  return activeUploadIds.includes(uploadId);
}

export function hasActiveTaskSource(task: AgentTask, activeUploadIds: string[]): boolean {
  if (task.inputData?.source === "manual") return true;
  const uploadId = task.inputData?.upload_id;
  if (typeof uploadId !== "string") return false;
  return activeUploadIds.includes(uploadId);
}
