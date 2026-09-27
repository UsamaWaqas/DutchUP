/**
 * React error boundaries only catch errors thrown during render/lifecycle. Errors thrown
 * from timers, native callbacks, or other code outside the React tree bypass them entirely
 * and would otherwise crash the app with no record of what happened. This installs a
 * global handler so those are at least logged before the default (fatal) handling runs.
 */
export function installGlobalErrorHandler() {
  const anyGlobal = globalThis as unknown as {
    ErrorUtils?: { getGlobalHandler(): (error: unknown, isFatal?: boolean) => void; setGlobalHandler(cb: (error: unknown, isFatal?: boolean) => void): void };
  };
  const errorUtils = anyGlobal.ErrorUtils;
  if (!errorUtils) return;

  const defaultHandler = errorUtils.getGlobalHandler();
  errorUtils.setGlobalHandler((error, isFatal) => {
    console.error(isFatal ? 'Fatal error' : 'Non-fatal error', error);
    defaultHandler(error, isFatal);
  });
}
