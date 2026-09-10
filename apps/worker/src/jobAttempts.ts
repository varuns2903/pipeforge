/**
 * Whether this is the last attempt BullMQ will make at a job before giving
 * up (as opposed to a transient failure that will be retried). BullMQ
 * increments attemptsMade only after a failed attempt finishes, so during
 * processing it still reflects attempts made *before* this one.
 */
export function isFinalAttempt(job: { attemptsMade: number; opts: { attempts?: number } }): boolean {
  return job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
}
