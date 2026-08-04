/**
 * Split out from requestSecurity.ts so modules that only need the error
 * class don't have to pull in the Supabase server client stack, which
 * depends on "server-only" and next/headers and cannot be imported from
 * a plain tsx/node script.
 */
export class RequestSecurityError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}
