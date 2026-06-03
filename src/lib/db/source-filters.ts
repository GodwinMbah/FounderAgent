import type { AgentRecommendation, AgentTask, Alert, Subscription } from "@/lib/types";

export function hasActiveSubscriptionSource(subscription: Subscription, activeUploadIds: string[]): boolean {
  const metadata = subscription.metadata ?? {};
  const detectedFromUpload = metadata.detected_from_upload;
  const sourceUploadId = metadata.source_upload_id;
  const uploadId = metadata.upload_id;
  const generatedUploadId =
    typeof detectedFromUpload === "string"
      ? detectedFromUpload
      : typeof sourceUploadId === "string"
      ? sourceUploadId
      : typeof uploadId === "string"
      ? uploadId
      : undefined;

  if (!generatedUploadId) return true;
  return activeUploadIds.includes(generatedUploadId);
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
