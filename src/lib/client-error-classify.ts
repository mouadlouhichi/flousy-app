/**
 * Client-error classification shared by the error reporter and the root error
 * boundary. Pure functions, no dependencies — safe to import anywhere,
 * including the service-worker-adjacent reporting path and unit tests.
 */

/**
 * Known Chrome DevTools bug (see GoogleChrome/web-vitals#792): with DevTools
 * open, the Performance-panel integration injects its own copy of web-vitals
 * as an anonymous `VM*` script, which throws
 * `Cannot read properties of undefined (reading 'startTime')` from
 * `reportAllChanges` on soft navigations. It originates in the browser — not
 * in app code — so it must never be beaconed as an app error.
 *
 * The app's own Web Vitals (via `useReportWebVitals`) would show bundle chunk
 * filenames in the stack, never a `VM*` script.
 */
export function isDevToolsVitalsNoise(message: string, stack?: string): boolean {
  return message.includes("reading 'startTime'") && (stack?.includes('reportAllChanges') ?? false);
}

/**
 * React context-identity failures: `X must be used inside/within YProvider`.
 *
 * Every provider in this app unconditionally wraps its consumers (see
 * AppProviders/LoginProviders and the dashboard layout), so in a healthy
 * single-build module graph these errors are unreachable. The way they happen
 * in production is a corrupted module graph in a long-lived tab: the PWA stays
 * open across a redeploy, a client-side navigation loads new route chunks
 * into the old runtime, and a consumer resolves a *fresh* context object while
 * the still-mounted provider holds the old one. A full reload rebuilds one
 * coherent graph and always clears it — which is why the root error boundary
 * reloads once for this class instead of stranding the user on an error page.
 */
export function isProviderIdentityError(message: unknown): boolean {
  if (typeof message !== 'string' || message.length === 0) return false;
  return /must be used (inside|within).+provider/i.test(message);
}
