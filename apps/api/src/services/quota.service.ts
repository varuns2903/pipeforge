import { User } from '../models/User';
import { getPlanLimits } from '../config/plans';

/** The given user's current plan-based concurrent-execution limit. */
export async function getConcurrentExecutionLimit(userId: string): Promise<number> {
  const user = await User.findById(userId).select('plan');
  return getPlanLimits(user?.plan).maxConcurrentExecutions;
}
