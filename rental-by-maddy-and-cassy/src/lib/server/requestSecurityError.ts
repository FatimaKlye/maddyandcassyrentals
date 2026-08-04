/**
 * Split out from requestSecurity.ts so modules that only need the error
 * class (e.g. src/lib/server/emailOtp.ts, and the standalone test scripts
 * that import it outside of Next's build) don't have to pull in the
 * Supabase server client stack, which depends on "server-only" and
 * next/headers and cannot be imported from a plain tsx/node script.
 */
export class RequestSecurityError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}
