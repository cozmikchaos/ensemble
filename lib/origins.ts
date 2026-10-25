/** Only explicitly configured frontends and the server's own origin may connect. */
export function originAllowed(origin: string | undefined, host: string | undefined, allowedOrigins: string[]) {
  if (!origin) return true; // Native clients and health checks do not send Origin.
  try {
    const parsed = new URL(origin);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== origin) return false;
    return parsed.host === host || allowedOrigins.includes(parsed.origin);
  } catch { return false; }
}
