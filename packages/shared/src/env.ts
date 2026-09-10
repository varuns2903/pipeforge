import type { ZodType } from 'zod';

/**
 * Parses `source` against `schema` and throws one aggregated, human-readable
 * error listing every problem at once — rather than the process dying on
 * whichever env var happens to be read first — so a misconfigured deploy
 * fails fast with a complete list of what to fix.
 */
export function loadEnv<T>(schema: ZodType<T>, source: NodeJS.ProcessEnv = process.env): T {
  const result = schema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map(issue => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(
      `Invalid environment configuration:\n${issues}\n\nSee .env.example for the expected variables.`
    );
  }
  return result.data;
}
