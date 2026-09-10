/** Whether a pipeline's notification preferences call for an email on this status. */
export function shouldNotify(pipeline: any, status: 'COMPLETED' | 'FAILED'): boolean {
  return status === 'FAILED'
    ? !!pipeline?.notifications?.onFailure
    : !!pipeline?.notifications?.onComplete;
}
