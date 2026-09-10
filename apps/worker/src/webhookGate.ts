/** Whether a pipeline's webhook preferences call for a delivery on this status. */
export function shouldDeliverWebhook(pipeline: any, status: 'COMPLETED' | 'FAILED'): boolean {
  if (!pipeline?.webhook?.url || !pipeline?.webhook?.secretEncrypted) return false;
  return status === 'FAILED' ? !!pipeline.webhook.onFailure : !!pipeline.webhook.onComplete;
}
