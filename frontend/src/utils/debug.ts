/** Pretty-print any value as JSON for debug logging, falling back to String() on cycles. */
export function toDebugJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
